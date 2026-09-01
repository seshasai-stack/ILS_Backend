import { FieldValue } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";

const INVOICE_FINANCIAL_YEAR = "26-27";
const applications = db.collection("summitApplications");

function formatInvoiceNumber(sequence: number): string {
  return `ILS${String(sequence).padStart(2, "0")}/${INVOICE_FINANCIAL_YEAR}`;
}

export async function ensureInvoiceNumber(orderId: string): Promise<string> {
  const applicationReference = applications.doc(orderId);
  const sequenceLock = db.collection("invoiceSequenceLocks").doc(INVOICE_FINANCIAL_YEAR);
  const existingInvoices = applications.where("invoice_fy", "==", INVOICE_FINANCIAL_YEAR);

  return db.runTransaction(async (transaction) => {
    const [applicationSnapshot, invoiceSnapshots, lockSnapshot] = await Promise.all([
      transaction.get(applicationReference),
      transaction.get(existingInvoices),
      transaction.get(sequenceLock),
    ]);

    if (!applicationSnapshot.exists) throw new Error("Application not found while assigning invoice number");

    const application = applicationSnapshot.data();
    const existingInvoiceNumber = String(application?.invoice_no ?? "").trim();
    if (existingInvoiceNumber) return existingInvoiceNumber;

    const highestLiveSequence = invoiceSnapshots.docs.reduce(
      (highest, document) => Math.max(highest, Number(document.data().invoice_sequence ?? 0)),
      0,
    );
    const nextSequence = highestLiveSequence + 1;
    const invoiceNumber = formatInvoiceNumber(nextSequence);

    transaction.update(applicationReference, {
      invoice_no: invoiceNumber,
      invoice_sequence: nextSequence,
      invoice_fy: INVOICE_FINANCIAL_YEAR,
      invoice_assigned_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(sequenceLock, {
      financialYear: INVOICE_FINANCIAL_YEAR,
      lastIssuedSequence: nextSequence,
      lastIssuedInvoice: invoiceNumber,
      previousLockSequence: Number(lockSnapshot.data()?.lastIssuedSequence ?? 0),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return invoiceNumber;
  });
}

