import type {
  Request,
  Response,
} from "express";

import {
  FieldValue,
} from "firebase-admin/firestore";

import { db } from "../config/firebase.js";
import { REGISTRATION_PRICE } from "../config/pricing.js";

import {
  generateCustomerId,
  generateOrderId,
} from "../utils/order-id.js";

import {
  createHdfcSession,
  getHdfcOrderStatus,
} from "../services/hdfc.service.js";

import {
  createPendingApplication,
  getApplication,
  markPaymentSessionCreated,
  markPaymentSessionFailed,
} from "../services/application.service.js";

import {
  applicationSchema,
} from "../validators/application.validator.js";

function getRequiredEnvironmentVariable(
  name: string
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} environment variable is required`
    );
  }

  return value;
}

function normalizeStringValue(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

const frontendUrl =
  getRequiredEnvironmentVariable("FRONTEND_URL");

const backendUrl =
  getRequiredEnvironmentVariable("BACKEND_URL");

export async function createPayment(
  request: Request,
  response: Response
) {
  const validation =
    applicationSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Invalid application details",
      errors:
        validation.error.flatten().fieldErrors,
    });
  }

  const application = validation.data;

  const orderId = generateOrderId();
  const customerId = generateCustomerId();

  const {
    baseAmount,
    gstRate,
    gstAmount,
    totalAmount,
    currency,
  } = REGISTRATION_PRICE;

  try {
    await createPendingApplication({
      application,
      orderId,
      customerId,
      baseAmount,
      gstRate,
      gstAmount,
      totalAmount,
    });

    try {
      const hdfcResponse =
        await createHdfcSession({
          order_id: orderId,
          amount: totalAmount.toFixed(2),
          currency,

          customer_id: customerId,
          customer_first_name:
            application.name,

          customer_email:
            application.email.toLowerCase(),

          customer_phone:
            application.phone,

          return_url:
            `${backendUrl}/api/payment/payment-return` +
            `?orderId=${encodeURIComponent(orderId)}`,

          description:
            `ILS 2026 registration ${orderId}`,
        });

      const paymentUrl =
        hdfcResponse.payment_links?.web;

      if (!paymentUrl) {
        throw new Error(
          "HDFC did not return payment_links.web"
        );
      }

      await markPaymentSessionCreated(
        orderId,
        paymentUrl,
        hdfcResponse
      );

      return response.status(200).json({
        success: true,
        orderId,

        pricing: {
          baseAmount,
          gstRate,
          gstAmount,
          totalAmount,
          currency,
        },

        paymentUrl,
      });
    } catch (gatewayError) {
      const message =
        gatewayError instanceof Error
          ? gatewayError.message
          : "HDFC session creation failed";

      console.error(
        "HDFC session creation failed:",
        gatewayError
      );

      await markPaymentSessionFailed(
        orderId,
        message
      );

      return response.status(502).json({
        success: false,
        orderId,
        applicationSaved: true,
        message:
          "Application was saved, but payment could not be initiated.",
      });
    }
  } catch (error) {
    console.error(
      "Create payment failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to save application and create payment",
    });
  }
}

export async function paymentReturn(
  request: Request,
  response: Response
) {
  console.log("HDFC callback received:", {
    method: request.method,
    query: request.query,
    body: request.body,
  });

  /*
   * HDFC normally sends the callback as a POST form.
   * Support both body and query parameters.
   */
  const callbackOrderId =
    request.body?.orderId ??
    request.body?.order_id ??
    request.query.orderId ??
    request.query.order_id;

  const orderId = normalizeStringValue(
    callbackOrderId as
      | string
      | string[]
      | undefined
  );

  const attendUrl = `${frontendUrl}/attend`;

  if (!orderId) {
    console.error(
      "HDFC callback missing order ID",
      {
        query: request.query,
        body: request.body,
      }
    );

    return response.redirect(
      `${attendUrl}?payment=cancelled`
    );
  }

  const applicationReference = db
    .collection("summitApplications")
    .doc(orderId);

  try {
    const application =
      await getApplication(orderId);

    if (!application) {
      console.error(
        "Application not found:",
        orderId
      );

      return response.redirect(
        `${attendUrl}` +
          `?payment=cancelled` +
          `&orderId=${encodeURIComponent(orderId)}`
      );
    }

    /*
     * Always verify the payment through the
     * HDFC status API using the callback order ID.
     */
    const gatewayOrder =
      await getHdfcOrderStatus(orderId);

    const localData = application as {
      pricing?: {
        totalAmount?: number;
        currency?: string;
      };
    };

    const gatewayStatus = String(
      gatewayOrder.status ?? ""
    )
      .trim()
      .toUpperCase();

    const gatewayStatusId = Number(
      gatewayOrder.status_id
    );

    const returnedOrderId = String(
      gatewayOrder.order_id ??
        gatewayOrder.id ??
        ""
    ).trim();

    const orderIdValid =
      returnedOrderId === orderId;

    const localAmount = Number(
      localData.pricing?.totalAmount
    );

    const gatewayAmount = Number(
      gatewayOrder.amount
    );

    const amountValid =
      Number.isFinite(localAmount) &&
      Number.isFinite(gatewayAmount) &&
      Math.abs(
        gatewayAmount - localAmount
      ) < 0.01;

    const localCurrency = String(
      localData.pricing?.currency ?? "INR"
    )
      .trim()
      .toUpperCase();

    const gatewayCurrency = String(
      gatewayOrder.currency ?? "INR"
    )
      .trim()
      .toUpperCase();

    const currencyValid =
      gatewayCurrency === localCurrency;

    const transactionId = String(
      gatewayOrder.txn_id ??
        gatewayOrder.transaction_id ??
        ""
    ).trim();

    const responseCategory = String(
      gatewayOrder.resp_category ?? ""
    )
      .trim()
      .toUpperCase();

    /*
     * Confirmed successful payment.
     */
    const isSuccessful =
      gatewayStatus === "CHARGED" &&
      gatewayStatusId === 21 &&
      orderIdValid &&
      amountValid &&
      currencyValid &&
      Boolean(transactionId);

    /*
     * Final failed or cancelled statuses.
     */
    const failedStatuses = new Set([
      "FAILED",
      "FAILURE",
      "DECLINED",

      "JUSPAY_DECLINED",

      "CANCELLED",
      "CANCELED",
      "CANCELLED_BY_USER",
      "CANCELED_BY_USER",

      "AUTHENTICATION_FAILED",
      "AUTHORIZATION_FAILED",

      "PAYMENT_FAILED",
      "CARD_DECLINED",
      "BANK_DECLINED",
      "TRANSACTION_FAILED",
      "GATEWAY_ERROR",
    ]);

    /*
     * HDFC/Juspay status IDs shared in your responses:
     *
     * 22 = JUSPAY_DECLINED
     * 26 = AUTHENTICATION_FAILED
     * 27 = AUTHORIZATION_FAILED
     */
    const failedStatusIds = new Set([
      22,
      26,
      27,
    ]);

    const isFailedOrCancelled =
      failedStatuses.has(gatewayStatus) ||
      failedStatusIds.has(gatewayStatusId) ||
      responseCategory === "PAYMENT_FAILURE";

    /*
     * Any status that is neither successful nor
     * explicitly failed is treated as pending.
     */
    const isPending =
      !isSuccessful &&
      !isFailedOrCancelled;

    console.log(
      "HDFC PAYMENT VERIFICATION RESULT:",
      {
        callbackOrderId: orderId,
        returnedOrderId,

        gatewayStatus,
        gatewayStatusId,
        responseCategory,

        localAmount,
        gatewayAmount,

        localCurrency,
        gatewayCurrency,

        transactionId,

        checks: {
          statusMatched:
            gatewayStatus === "CHARGED",

          statusIdMatched:
            gatewayStatusId === 21,

          orderIdValid,
          amountValid,
          currencyValid,

          transactionIdPresent:
            Boolean(transactionId),

          isSuccessful,
          isPending,
          isFailedOrCancelled,
        },
      }
    );

    /*
     * Prevent a single transaction ID from being
     * used for multiple orders.
     */
    if (transactionId) {
      const duplicateTransaction =
        await db
          .collection(
            "summitApplications"
          )
          .where(
            "payment.transactionId",
            "==",
            transactionId
          )
          .limit(1)
          .get();

      const usedByAnotherOrder =
        duplicateTransaction.docs.some(
          (document) =>
            document.id !== orderId
        );

      if (usedByAnotherOrder) {
        await applicationReference.update({
          "payment.status":
            "DUPLICATE_TRANSACTION",

          "payment.transactionId":
            transactionId,

          "payment.gatewayStatus":
            gatewayStatus || null,

          "payment.statusId":
            Number.isFinite(gatewayStatusId)
              ? gatewayStatusId
              : null,

          statusResponse:
            gatewayOrder,

          updatedAt:
            FieldValue.serverTimestamp(),
        });

        return response.redirect(
          `${attendUrl}` +
            `?payment=pending` +
            `&orderId=${encodeURIComponent(orderId)}`
        );
      }
    }

    const finalStatus = isSuccessful
      ? "SUCCESS"
      : isFailedOrCancelled
        ? "CANCELLED_OR_FAILED"
        : "PENDING";

    await applicationReference.update({
      "payment.status":
        finalStatus,

      "payment.paidAmount":
        isSuccessful
          ? gatewayAmount
          : null,

      "payment.transactionId":
        transactionId || null,

      "payment.gatewayOrderId":
        gatewayOrder.id || null,

      "payment.paymentMethod":
        gatewayOrder.payment_method_type ||
        null,

      "payment.gatewayStatus":
        gatewayStatus || null,

      "payment.statusId":
        Number.isFinite(gatewayStatusId)
          ? gatewayStatusId
          : null,

      "payment.responseCategory":
        responseCategory || null,

      "payment.failureMessage":
        gatewayOrder.actionables
          ?.display_message ||
        gatewayOrder.bank_error_message ||
        null,

      "payment.failureRecommendation":
        gatewayOrder.actionables
          ?.recommendation ||
        null,

      "payment.isRetriable":
        typeof gatewayOrder.actionables
          ?.is_retriable === "boolean"
          ? gatewayOrder.actionables
              .is_retriable
          : null,

      "payment.amountMatched":
        amountValid,

      "payment.orderIdMatched":
        orderIdValid,

      "payment.currencyMatched":
        currencyValid,

      statusResponse:
        gatewayOrder,

      verifiedAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    /*
     * Successful payment.
     */
    if (isSuccessful) {
      return response.redirect(
        `${attendUrl}` +
          `?payment=success` +
          `&orderId=${encodeURIComponent(orderId)}`
      );
    }

    /*
     * Explicitly failed or cancelled payment.
     */
    if (isFailedOrCancelled) {
      return response.redirect(
        `${attendUrl}` +
          `?payment=cancelled` +
          `&orderId=${encodeURIComponent(orderId)}`
      );
    }

    /*
     * Payment is still processing/on hold.
     */
    return response.redirect(
      `${attendUrl}` +
        `?payment=pending` +
        `&orderId=${encodeURIComponent(orderId)}`
    );
  } catch (error) {
    console.error(
      "Payment verification failed:",
      {
        orderId,

        error:
          error instanceof Error
            ? error.message
            : error,
      }
    );

    /*
     * A temporary HDFC status API or network
     * error must not be shown as cancellation.
     */
    await applicationReference
      .update({
        "payment.status":
          "PENDING",

        "payment.verificationError":
          error instanceof Error
            ? error.message
            : "Payment verification pending",

        updatedAt:
          FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    return response.redirect(
      `${attendUrl}` +
        `?payment=pending` +
        `&orderId=${encodeURIComponent(orderId)}`
    );
  }
}

export async function paymentStatus(
  request: Request,
  response: Response
) {
  const orderId = normalizeStringValue(
    request.params.orderId as
      | string
      | string[]
      | undefined
  );

  if (!orderId) {
    return response.status(400).json({
      success: false,
      message: "orderId is required",
    });
  }

  try {
    const application =
      await getApplication(orderId);

    if (!application) {
      return response.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const data = application as {
      applicant?: {
        name?: string;
        email?: string;
      };

      pricing?: {
        baseAmount?: number;
        gstRate?: number;
        gstAmount?: number;
        totalAmount?: number;
        currency?: string;
      };

      payment?: {
        status?: string;
        paidAmount?: number | null;
        transactionId?: string | null;
        gatewayOrderId?: string | null;
        paymentMethod?: string | null;
      };
    };

    return response.status(200).json({
      success: true,
      orderId,

      applicant: {
        name:
          data.applicant?.name || "",

        email:
          data.applicant?.email || "",
      },

      pricing: {
        baseAmount:
          data.pricing?.baseAmount ?? null,

        gstRate:
          data.pricing?.gstRate ?? null,

        gstAmount:
          data.pricing?.gstAmount ?? null,

        totalAmount:
          data.pricing?.totalAmount ?? null,

        currency:
          data.pricing?.currency || "INR",
      },

      payment: {
        status:
          data.payment?.status ||
          "UNKNOWN",

        paidAmount:
          data.payment?.paidAmount ??
          null,

        transactionId:
          data.payment?.transactionId ??
          null,

        gatewayOrderId:
          data.payment?.gatewayOrderId ??
          null,

        paymentMethod:
          data.payment?.paymentMethod ??
          null,
      },
    });
  } catch (error) {
    console.error(
      "Unable to retrieve payment status:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to retrieve payment status",
    });
  }
}