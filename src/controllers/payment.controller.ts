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

const frontendUrl = process.env.FRONTEND_URL;
const backendUrl = process.env.BACKEND_URL;

if (!frontendUrl || !backendUrl) {
  throw new Error(
    "FRONTEND_URL and BACKEND_URL are required"
  );
}

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
            `${backendUrl}/api/routes/payment-return` +
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
  const orderId =
    typeof request.query.orderId === "string"
      ? request.query.orderId
      : "";

  if (!orderId) {
    return response.redirect(
      `${frontendUrl}/payment-result?status=INVALID_ORDER`
    );
  }

  const applicationReference = db
    .collection("summitApplications")
    .doc(orderId);

  try {
    const application =
      await getApplication(orderId);

    if (!application) {
      return response.redirect(
        `${frontendUrl}/payment-result?status=ORDER_NOT_FOUND`
      );
    }

    const gatewayOrder =
      await getHdfcOrderStatus(orderId);

    const localData = application as {
      pricing?: {
        totalAmount?: number;
        currency?: string;
      };

      payment?: {
        status?: string;
      };
    };

    const statusValid =
      String(gatewayOrder.status).toUpperCase() ===
        "CHARGED" &&
      Number(gatewayOrder.status_id) === 21;

    const orderIdValid =
      String(gatewayOrder.order_id) === orderId;

    const amountValid =
      Number(gatewayOrder.amount) ===
      Number(localData.pricing?.totalAmount);

    const currencyValid =
      String(gatewayOrder.currency).toUpperCase() ===
      String(
        localData.pricing?.currency
      ).toUpperCase();

    const transactionId =
      typeof gatewayOrder.txn_id === "string"
        ? gatewayOrder.txn_id
        : null;

    if (!transactionId && statusValid) {
      throw new Error(
        "Successful payment is missing txn_id"
      );
    }

    if (transactionId) {
      const duplicateTransaction = await db
        .collection("summitApplications")
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
          statusResponse: gatewayOrder,
          updatedAt:
            FieldValue.serverTimestamp(),
        });

        return response.redirect(
          `${frontendUrl}/payment-result` +
            `?orderId=${encodeURIComponent(orderId)}` +
            `&status=DUPLICATE_TRANSACTION`
        );
      }
    }

    const paymentValid =
      statusValid &&
      orderIdValid &&
      amountValid &&
      currencyValid &&
      Boolean(transactionId);

    const finalStatus = paymentValid
      ? "SUCCESS"
      : "FAILED_OR_TAMPERED";

    await applicationReference.update({
      "payment.status": finalStatus,

      "payment.paidAmount": paymentValid
        ? Number(gatewayOrder.amount)
        : null,

      "payment.transactionId":
        transactionId,

      "payment.gatewayOrderId":
        gatewayOrder.id || null,

      "payment.paymentMethod":
        gatewayOrder.payment_method_type || null,

      statusResponse: gatewayOrder,

      verifiedAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return response.redirect(
      `${frontendUrl}/payment-result` +
        `?orderId=${encodeURIComponent(orderId)}` +
        `&status=${encodeURIComponent(finalStatus)}`
    );
  } catch (error) {
    console.error(
      "Payment verification failed:",
      error
    );

    await applicationReference
      .update({
        "payment.status":
          "VERIFICATION_FAILED",

        updatedAt:
          FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    return response.redirect(
      `${frontendUrl}/payment-result` +
        `?orderId=${encodeURIComponent(orderId)}` +
        `&status=VERIFICATION_FAILED`
    );
  }
}

export async function paymentStatus(
  request: Request,
  response: Response
) {
  const { orderId } = request.params;

  if (!orderId) {
    return response.status(400).json({
      success: false,
      message: "orderId is required",
    });
  }

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
      gstAmount?: number;
      totalAmount?: number;
      currency?: string;
    };

    payment?: {
      status?: string;
      paidAmount?: number;
      transactionId?: string;
      paymentMethod?: string;
    };
  };

  return response.status(200).json({
    success: true,
    orderId,

    applicant: {
      name: data.applicant?.name || "",
      email: data.applicant?.email || "",
    },

    pricing: data.pricing,

    payment: {
      status:
        data.payment?.status || "UNKNOWN",

      paidAmount:
        data.payment?.paidAmount || null,

      transactionId:
        data.payment?.transactionId || null,

      paymentMethod:
        data.payment?.paymentMethod || null,
    },
  });
}