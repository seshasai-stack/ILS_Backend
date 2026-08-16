import {
  FieldValue,
} from "firebase-admin/firestore";

import { db } from "../config/firebase.js";

export interface ApplicationInput {
  registrationType: string;
  name: string;
  email: string;
  phone: string;
  chapterName: string;
  organization: string;
  designation: string;
  industry: string;
  industryOther?: string;
  sponsorshipInterest?: string;
  sponsorshipDetails?: string;
  dietaryRestrictions: string[];
  dietaryOther?: string;
  address1: string;
  address2?: string;
  country: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  vatGstNumber?: string;
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
      registrationType: application.registrationType,
      name: application.name,
      email: application.email.toLowerCase(),
      phone: application.phone,
      chapterName: application.chapterName,
      organization: application.organization,
      designation: application.designation,
      industry: application.industry,
      industryOther: application.industryOther || "",
      sponsorshipInterest: application.sponsorshipInterest || "",
      sponsorshipDetails: application.sponsorshipDetails || "",
      dietaryRestrictions: application.dietaryRestrictions,
      dietaryOther: application.dietaryOther || "",
      address1: application.address1,
      address2: application.address2 || "",
      country: application.country,
      city: application.city,
      stateProvince: application.stateProvince || "",
      postalCode: application.postalCode,
      vatGstNumber: application.vatGstNumber || "",
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
      gateway: "RAZORPAY",
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
  gatewayOrderId: string,
  gatewayResponse: unknown
) {
  await applications.doc(orderId).update({
    "payment.status": "SESSION_CREATED",
    "payment.gatewayOrderId": gatewayOrderId,
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
