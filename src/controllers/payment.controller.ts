import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../config/firebase.js";
import { REGISTRATION_PRICE } from "../config/pricing.js";
import { applicationSchema } from "../validators/application.validator.js";
import { generateCustomerId, generateOrderId } from "../utils/order-id.js";
import { createPendingApplication, getApplication, markPaymentSessionCreated, markPaymentSessionFailed } from "../services/application.service.js";
import {
  createRazorpayOrder, fetchRazorpayOrderPayments, fetchRazorpayPayment, getRazorpayKeyId,
  verifyCheckoutSignature, verifyWebhookSignature, type RazorpayPayment, type RazorpayRefund,
} from "../services/razorpay.service.js";
import {
  sendPaymentSuccessEmailOnce,
  sendTeamRegistrationEmailOnce,
} from "../services/payment-email.service.js";

const verificationSchema = z.object({
  orderId: z.string().trim().min(1), razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1), razorpay_signature: z.string().trim().min(1),
});
const cancellationSchema = z.object({ orderId: z.string().trim().min(1), reason: z.string().trim().max(300).optional() });

type PaymentStatus = "CREATED" | "SESSION_CREATED" | "SESSION_FAILED" | "PENDING" | "AUTHORIZED" | "FAILED" | "CANCELLED" | "SUCCESS" | "PARTIALLY_REFUNDED" | "REFUNDED";
type StoredApplication = {
  applicant?: {
    name?: string; email?: string; phone?: string; registrationType?: string;
    chapterName?: string; organization?: string; designation?: string;
    industry?: string; industryOther?: string; sponsorshipInterest?: string;
    sponsorshipDetails?: string; dietaryRestrictions?: string[]; dietaryOther?: string;
    address1?: string; address2?: string; country?: string; city?: string;
    stateProvince?: string; postalCode?: string; vatGstNumber?: string; intent?: string;
  };
  pricing?: { baseAmount?: number; gstRate?: number; gstAmount?: number; totalAmount?: number; currency?: string };
  payment?: { status?: PaymentStatus; gatewayOrderId?: string | null; transactionId?: string | null; paymentMethod?: string | null; paidAmount?: number | null; refundedAmount?: number | null; is_sent?: number; team_email_is_sent?: number };
};

const applications = db.collection("summitApplications");
const paymentClaims = db.collection("razorpayPaymentClaims");
const webhookEvents = db.collection("razorpayWebhookEvents");
const refundClaims = db.collection("razorpayRefundClaims");
const paise = (amount: number) => Math.round(amount * 100);

function validatePayment(application: StoredApplication, payment: RazorpayPayment) {
  if (application.payment?.gatewayOrderId !== payment.order_id) throw new Error("Razorpay order does not match application");
  if (payment.amount !== paise(Number(application.pricing?.totalAmount)) || payment.currency.toUpperCase() !== String(application.pricing?.currency ?? "INR").toUpperCase()) {
    throw new Error("Payment amount or currency mismatch");
  }
}

async function sendSuccessEmail(localOrderId: string, payment: RazorpayPayment, application?: StoredApplication) {
  const data = application ?? await getApplication(localOrderId) as StoredApplication | null;
  if (!data) return;
  const email = String(data.applicant?.email ?? "").trim().toLowerCase();
  const name = String(data.applicant?.name ?? "").trim();
  if (!email || !name) return;
  const emailInput = {
    orderId: localOrderId, transactionId: payment.id, applicantName: name, applicantEmail: email,
    phone: data.applicant?.phone, registrationType: data.applicant?.registrationType,
    chapterName: data.applicant?.chapterName, organization: data.applicant?.organization,
    designation: data.applicant?.designation, industry: data.applicant?.industry,
    industryOther: data.applicant?.industryOther, sponsorshipInterest: data.applicant?.sponsorshipInterest,
    sponsorshipDetails: data.applicant?.sponsorshipDetails,
    dietaryRestrictions: data.applicant?.dietaryRestrictions, dietaryOther: data.applicant?.dietaryOther,
    address1: data.applicant?.address1, address2: data.applicant?.address2,
    country: data.applicant?.country, city: data.applicant?.city,
    stateProvince: data.applicant?.stateProvince, postalCode: data.applicant?.postalCode,
    vatGstNumber: data.applicant?.vatGstNumber, intent: data.applicant?.intent,
    baseAmount: Number(data.pricing?.baseAmount ?? 0), gstRate: Number(data.pricing?.gstRate ?? 0),
    gstAmount: Number(data.pricing?.gstAmount ?? 0), totalAmount: Number(data.pricing?.totalAmount ?? 0),
    currency: String(data.pricing?.currency ?? "INR").toUpperCase(), paymentMethod: payment.method ?? "Online payment",
  };

  const [customerEmail, teamEmail] = await Promise.allSettled([
    sendPaymentSuccessEmailOnce(emailInput),
    sendTeamRegistrationEmailOnce(emailInput),
  ]);

  if (customerEmail.status === "rejected") {
    console.error("Payment succeeded but customer confirmation email failed", { localOrderId, error: customerEmail.reason });
  }
  if (teamEmail.status === "rejected") {
    console.error("Payment succeeded but team registration email failed", { localOrderId, error: teamEmail.reason });
  }
}

async function completePayment(localOrderId: string, payment: RazorpayPayment, source: "checkout" | "webhook" | "reconciliation") {
  if (!payment.captured || payment.status !== "captured") throw new Error("Payment has not been captured");
  const application = await getApplication(localOrderId) as StoredApplication | null;
  if (!application) throw new Error("Application not found");
  validatePayment(application, payment);
  const applicationRef = applications.doc(localOrderId);
  const claimRef = paymentClaims.doc(payment.id);

  await db.runTransaction(async (transaction) => {
    const [freshApplication, claim] = await Promise.all([transaction.get(applicationRef), transaction.get(claimRef)]);
    if (!freshApplication.exists) throw new Error("Application not found");
    if (claim.exists && claim.data()?.orderId !== localOrderId) throw new Error("Payment is already linked to another application");
    const current = freshApplication.data() as StoredApplication;
    validatePayment(current, payment);
    transaction.set(claimRef, { orderId: localOrderId, paymentId: payment.id, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.update(applicationRef, {
      "payment.status": "SUCCESS", "payment.paidAmount": payment.amount / 100,
      "payment.transactionId": payment.id, "payment.paymentMethod": payment.method ?? null,
      "payment.gatewayStatus": payment.status, "payment.amountMatched": true,
      "payment.orderIdMatched": true, "payment.currencyMatched": true,
      "payment.verificationSource": source, "payment.failureMessage": null,
      verifiedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await sendSuccessEmail(localOrderId, payment, application);
}

async function updateNonSuccess(localOrderId: string, status: PaymentStatus, payment?: RazorpayPayment, extra: Record<string, unknown> = {}) {
  const ref = applications.doc(localOrderId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("Application not found");
    const current = (snapshot.data() as StoredApplication).payment?.status;
    // Final paid/refunded states cannot be downgraded by late or out-of-order events.
    if (["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"].includes(current ?? "")) return;
    transaction.update(ref, {
      "payment.status": status, "payment.gatewayStatus": payment?.status ?? status.toLowerCase(),
      ...(payment?.id ? { "payment.transactionId": payment.id } : {}),
      ...(payment?.method ? { "payment.paymentMethod": payment.method } : {}),
      ...extra, updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function findLocalOrderId(gatewayOrderId: string, receipt?: string) {
  if (receipt) {
    const direct = await applications.doc(receipt).get();
    if (direct.exists && direct.data()?.payment?.gatewayOrderId === gatewayOrderId) return receipt;
  }
  return (await applications.where("payment.gatewayOrderId", "==", gatewayOrderId).limit(1).get()).docs[0]?.id;
}

async function reconcile(localOrderId: string, application: StoredApplication) {
  const gatewayOrderId = application.payment?.gatewayOrderId;
  if (!gatewayOrderId || ["REFUNDED", "PARTIALLY_REFUNDED"].includes(application.payment?.status ?? "")) return;
  const payments = await fetchRazorpayOrderPayments(gatewayOrderId);
  const captured = payments.find((item) => item.captured && item.status === "captured");
  if (captured) return completePayment(localOrderId, captured, "reconciliation");
  const authorized = payments.find((item) => item.status === "authorized");
  if (authorized) return updateNonSuccess(localOrderId, "AUTHORIZED", authorized);
  const failed = payments.find((item) => item.status === "failed");
  if (failed) return updateNonSuccess(localOrderId, "FAILED", failed, { "payment.failureMessage": failed.error_description ?? null, "payment.failureCode": failed.error_code ?? null });
}

export async function createPayment(request: Request, response: Response) {
  const validation = applicationSchema.safeParse(request.body);
  if (!validation.success) return response.status(400).json({ success: false, message: "Invalid application details", errors: validation.error.flatten().fieldErrors });
  const application = validation.data, orderId = generateOrderId(), customerId = generateCustomerId();
  const { baseAmount, gstRate, gstAmount, totalAmount, currency } = REGISTRATION_PRICE;
  try {
    await createPendingApplication({ application, orderId, customerId, baseAmount, gstRate, gstAmount, totalAmount });
    try {
      const gatewayOrder = await createRazorpayOrder({ receipt: orderId, amountPaise: paise(totalAmount), notes: { localOrderId: orderId, customerId } });
      await markPaymentSessionCreated(orderId, gatewayOrder.id, gatewayOrder);
      return response.status(200).json({ success: true, orderId, pricing: { baseAmount, gstRate, gstAmount, totalAmount, currency }, razorpay: { keyId: getRazorpayKeyId(), orderId: gatewayOrder.id, amount: gatewayOrder.amount, currency: gatewayOrder.currency }, customer: { name: application.name, email: application.email.toLowerCase(), contact: application.phone } });
    } catch (error) {
      await markPaymentSessionFailed(orderId, error instanceof Error ? error.message : "Razorpay order creation failed");
      return response.status(502).json({ success: false, orderId, applicationSaved: true, message: "Application was saved, but payment could not be initiated." });
    }
  } catch (error) { console.error("Create payment failed", error); return response.status(500).json({ success: false, message: "Unable to save application and create payment" }); }
}

export async function verifyPayment(request: Request, response: Response) {
  const parsed = verificationSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, message: "Invalid payment verification payload" });
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
  try {
    const application = await getApplication(orderId) as StoredApplication | null;
    if (!application || application.payment?.gatewayOrderId !== razorpay_order_id) return response.status(400).json({ success: false, message: "Order mismatch" });
    if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) return response.status(400).json({ success: false, message: "Invalid payment signature" });
    const payment = await fetchRazorpayPayment(razorpay_payment_id);
    if (payment.status === "authorized") {
      await updateNonSuccess(orderId, "AUTHORIZED", payment);
      return response.status(202).json({ success: true, orderId, paymentStatus: "AUTHORIZED", message: "Payment is awaiting capture" });
    }
    await completePayment(orderId, payment, "checkout");
    return response.status(200).json({ success: true, orderId, paymentStatus: "SUCCESS" });
  } catch (error) { console.error("Payment verification failed", { orderId, error }); return response.status(409).json({ success: false, orderId, message: error instanceof Error ? error.message : "Payment verification failed" }); }
}

export async function cancelPayment(request: Request, response: Response) {
  const parsed = cancellationSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, message: "Invalid cancellation payload" });
  try {
    const application = await getApplication(parsed.data.orderId) as StoredApplication | null;
    if (!application) return response.status(404).json({ success: false, message: "Application not found" });
    await reconcile(parsed.data.orderId, application); // Never cancel a payment that Razorpay already captured.
    await updateNonSuccess(parsed.data.orderId, "CANCELLED", undefined, { "payment.cancellationReason": parsed.data.reason ?? "Checkout dismissed", "payment.cancelledAt": FieldValue.serverTimestamp() });
    const fresh = await getApplication(parsed.data.orderId) as StoredApplication;
    return response.status(200).json({ success: true, orderId: parsed.data.orderId, paymentStatus: fresh.payment?.status });
  } catch (error) { console.error("Cancellation update failed", error); return response.status(503).json({ success: false, message: "Could not confirm cancellation; check payment status again" }); }
}

export async function razorpayWebhook(request: Request, response: Response) {
  const signature = request.header("x-razorpay-signature") ?? "", eventId = request.header("x-razorpay-event-id") ?? "";
  const rawBody = request.body as Buffer;
  if (!Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature)) return response.status(400).json({ success: false, message: "Invalid webhook signature" });
  try {
    if (eventId && (await webhookEvents.doc(eventId).get()).data()?.status === "PROCESSED") return response.status(200).json({ received: true, duplicate: true });
    const event = JSON.parse(rawBody.toString("utf8")) as { event?: string; payload?: { payment?: { entity?: RazorpayPayment }; order?: { entity?: { receipt?: string } }; refund?: { entity?: RazorpayRefund } } };
    const payment = event.payload?.payment?.entity;
    if (payment) {
      const localOrderId = await findLocalOrderId(payment.order_id, event.payload?.order?.entity?.receipt);
      if (localOrderId) {
        if (event.event === "payment.captured" || event.event === "order.paid") await completePayment(localOrderId, payment, "webhook");
        else if (event.event === "payment.authorized") await updateNonSuccess(localOrderId, "AUTHORIZED", payment);
        else if (event.event === "payment.failed") await updateNonSuccess(localOrderId, "FAILED", payment, { "payment.failureMessage": payment.error_description ?? null, "payment.failureCode": payment.error_code ?? null });
      }
    }
    const refund = event.payload?.refund?.entity;
    if (refund && (event.event === "refund.processed" || event.event === "refund.failed")) {
      const claim = await paymentClaims.doc(refund.payment_id).get();
      const localOrderId = claim.data()?.orderId as string | undefined;
      if (localOrderId) {
        const ref = applications.doc(localOrderId);
        const refundClaimRef = refundClaims.doc(refund.id);
        await db.runTransaction(async (transaction) => {
          const [snapshot, refundClaim] = await Promise.all([transaction.get(ref), transaction.get(refundClaimRef)]);
          if (!snapshot.exists) return;
          if (event.event === "refund.failed") { transaction.update(ref, { "payment.refundStatus": "FAILED", "payment.refundId": refund.id, updatedAt: FieldValue.serverTimestamp() }); return; }
          if (refundClaim.exists) return;
          const data = snapshot.data() as StoredApplication;
          const refunded = Math.min(Number(data.payment?.refundedAmount ?? 0) + refund.amount / 100, Number(data.payment?.paidAmount ?? Infinity));
          const status = refunded >= Number(data.payment?.paidAmount ?? Infinity) ? "REFUNDED" : "PARTIALLY_REFUNDED";
          transaction.create(refundClaimRef, { orderId: localOrderId, paymentId: refund.payment_id, amount: refund.amount, processedAt: FieldValue.serverTimestamp() });
          transaction.update(ref, { "payment.status": status, "payment.refundedAmount": refunded, "payment.refundStatus": refund.status, "payment.refundId": refund.id, updatedAt: FieldValue.serverTimestamp() });
        });
      }
    }
    if (eventId) await webhookEvents.doc(eventId).set({ status: "PROCESSED", event: event.event ?? null, processedAt: FieldValue.serverTimestamp() });
    return response.status(200).json({ received: true });
  } catch (error) {
    if (eventId) await webhookEvents.doc(eventId).set({ status: "FAILED", error: error instanceof Error ? error.message : "Unknown error", updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => undefined);
    console.error("Razorpay webhook processing failed", error); return response.status(500).json({ received: false });
  }
}

export async function paymentStatus(request: Request, response: Response) {
  const orderId = String(request.params.orderId ?? "").trim();
  if (!orderId) return response.status(400).json({ success: false, message: "orderId is required" });
  try {
    let data = await getApplication(orderId) as StoredApplication | null;
    if (!data) return response.status(404).json({ success: false, message: "Application not found" });
    if (!["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"].includes(data.payment?.status ?? "")) {
      try { await reconcile(orderId, data); data = await getApplication(orderId) as StoredApplication; }
      catch (error) { console.error("Razorpay reconciliation deferred", { orderId, error }); }
    } else if (
      data.payment?.status === "SUCCESS" &&
      data.payment.transactionId &&
      (data.payment.is_sent !== 1 || data.payment.team_email_is_sent !== 1)
    ) {
      try { await sendSuccessEmail(orderId, await fetchRazorpayPayment(data.payment.transactionId), data); } catch (error) { console.error("Email retry deferred", { orderId, error }); }
      data = await getApplication(orderId) as StoredApplication;
    }
    return response.status(200).json({ success: true, orderId, applicant: { name: data.applicant?.name ?? "", email: data.applicant?.email ?? "" }, pricing: data.pricing, payment: { status: data.payment?.status ?? "UNKNOWN", paidAmount: data.payment?.paidAmount ?? null, refundedAmount: data.payment?.refundedAmount ?? null, transactionId: data.payment?.transactionId ?? null, gatewayOrderId: data.payment?.gatewayOrderId ?? null, paymentMethod: data.payment?.paymentMethod ?? null } });
  } catch (error) { console.error("Unable to retrieve payment status", error); return response.status(500).json({ success: false, message: "Unable to retrieve payment status" }); }
}
