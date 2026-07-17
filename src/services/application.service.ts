import {
  FieldValue,
} from "firebase-admin/firestore";

import { db } from "../config/firebase.js";

export interface ApplicationInput {
  name: string;
  email: string;
  phone: string;
  organization: string;
  designation: string;
  intent?: string;
}

const applications =
  db.collection("summitApplications");

export async function createPendingApplication(
  params: {
    application: ApplicationInput;
    orderId: string;
    customerId: string;

    baseAmount: number;
    gstRate: number;
    gstAmount: number;
    totalAmount: number;
  }
) {
  const {
    application,
    orderId,
    customerId,
    baseAmount,
    gstRate,
    gstAmount,
    totalAmount,
  } = params;

  const document = applications.doc(orderId);

  await document.create({
    orderId,
    customerId,

    applicant: {
      name: application.name,
      email: application.email.toLowerCase(),
      phone: application.phone,
      organization: application.organization,
      designation: application.designation,
      intent: application.intent || "",
    },

    pricing: {
      baseAmount,
      gstRate,
      gstAmount,
      totalAmount,
      currency: "INR",
    },

    applicationStatus: "SUBMITTED",

    payment: {
      gateway: "HDFC_SMARTGATEWAY",
      status: "CREATED",

      expectedAmount: totalAmount,
      paidAmount: null,

      gatewayOrderId: null,
      transactionId: null,
      paymentMethod: null,
      paymentUrl: null,
    },

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return document;
}

export async function markPaymentSessionCreated(
  orderId: string,
  paymentUrl: string,
  gatewayResponse: unknown
) {
  await applications.doc(orderId).update({
    "payment.status": "SESSION_CREATED",
    "payment.paymentUrl": paymentUrl,
    sessionResponse: gatewayResponse,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markPaymentSessionFailed(
  orderId: string,
  message: string
) {
  await applications.doc(orderId).update({
    "payment.status": "SESSION_FAILED",
    paymentError: message,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getApplication(
  orderId: string
) {
  const snapshot =
    await applications.doc(orderId).get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}