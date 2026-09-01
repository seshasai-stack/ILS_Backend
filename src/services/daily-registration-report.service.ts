import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";

const REPORT_RECIPIENT = {
  email: "sarayu@corporateconnections-india.com",
  name: "Sarayu",
};
const PAID_STATUSES = new Set(["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"]);

type Mailbox = { email: string; name?: string };
type Registration = {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  chapterName: string;
  organization: string;
  designation: string;
  registrationType: string;
  industry: string;
  industryOther: string;
  sponsorshipInterest: string;
  sponsorshipDetails: string;
  dietaryRestrictions: string;
  dietaryOther: string;
  address1: string;
  address2: string;
  country: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  vatGstNumber: string;
  intent: string;
  transactionId: string;
  paymentMethod: string;
  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  amount: number;
  currency: string;
  registeredAt: Date;
};

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

function parseMailbox(value: string): Mailbox {
  const mailbox = value.trim();
  const match = mailbox.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) {
    const name = (match[1] ?? "").trim().replace(/^['"]|['"]$/g, "");
    return { email: (match[2] ?? "").trim(), ...(name ? { name } : {}) };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox)) return { email: mailbox };
  throw new Error(`${value} is not a valid email mailbox`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function text(value: unknown, fallback = "-"): string {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export function getPreviousDayReportWindow(now: Date): { reportDate: string; start: Date; end: Date } {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = dateFormatter.format(now);
  const end = new Date(`${today}T00:00:00+05:30`);
  const start = new Date(end.getTime() - 86_400_000);
  return { reportDate: dateFormatter.format(start), start, end };
}

function createHtml(reportDate: string, registrations: Registration[]): string {
  const total = registrations.reduce((sum, item) => sum + item.amount, 0);
  const contactRows = registrations.map((item, index) => `<tr>
    <td style="padding:12px 10px;border-bottom:1px solid #302d27;color:#8f887d;font-size:11px;vertical-align:top;">${index + 1}</td>
    <td style="padding:12px 10px;border-bottom:1px solid #302d27;color:#f5f0e6;font-size:12px;line-height:18px;vertical-align:top;"><strong>${escapeHtml(item.name)}</strong></td>
    <td style="padding:12px 10px;border-bottom:1px solid #302d27;color:#f5f0e6;font-size:11px;line-height:18px;word-break:break-word;vertical-align:top;"><a href="mailto:${escapeHtml(item.email)}" style="color:#d5b66e;text-decoration:none;">${escapeHtml(item.email)}</a></td>
    <td style="padding:12px 10px;border-bottom:1px solid #302d27;color:#f5f0e6;font-size:11px;line-height:18px;white-space:nowrap;vertical-align:top;"><a href="tel:${escapeHtml(item.phone)}" style="color:#f5f0e6;text-decoration:none;">${escapeHtml(item.phone)}</a></td>
  </tr>`).join("");
  const cards = registrations.map((item, index) => {
    const fields: Array<[string, string]> = [
      ["Registration type", item.registrationType], ["Name", item.name], ["Email", item.email],
      ["Phone", item.phone], ["Chapter / market / region", item.chapterName], ["Organisation", item.organization],
      ["Designation", item.designation], ["Industry", item.industry], ["Other industry", item.industryOther],
      ["Sponsorship interest", item.sponsorshipInterest], ["Sponsorship details", item.sponsorshipDetails],
      ["Dietary restrictions", item.dietaryRestrictions], ["Other dietary restriction", item.dietaryOther],
      ["Address 1", item.address1], ["Address 2", item.address2], ["Country / region", item.country],
      ["City", item.city], ["State / province", item.stateProvince], ["ZIP / postal code", item.postalCode],
      ["VAT / GST number", item.vatGstNumber], ["Reason for attending", item.intent],
      ["Registration ID", item.orderId], ["Transaction ID", item.transactionId], ["Payment method", item.paymentMethod],
      ["Registration fee", formatMoney(item.baseAmount, item.currency)], ["GST rate", `${item.gstRate}%`],
      ["GST amount", formatMoney(item.gstAmount, item.currency)], ["Total paid", formatMoney(item.amount, item.currency)],
      ["Registered at", `${formatTime(item.registeredAt)} IST`],
    ];
    const rows = fields.map(([label, value]) => `<tr><td style="width:38%;padding:10px 14px;border-bottom:1px solid #302d27;color:#8f887d;font-size:11px;vertical-align:top;">${escapeHtml(label)}</td><td align="right" style="padding:10px 14px;border-bottom:1px solid #302d27;color:#f5f0e6;font-size:11px;line-height:17px;word-break:break-word;">${escapeHtml(value)}</td></tr>`).join("");
    return `<tr><td style="padding:0 24px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #3d382f;border-collapse:collapse;"><tr><td colspan="2" style="padding:13px 14px;background:#24211c;color:#c9a75e;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">${index + 1}. ${escapeHtml(item.name)}</td></tr>${rows}</table></td></tr>`;
  }).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ILS daily registration report</title></head>
<body style="margin:0;padding:0;background:#11110f;font-family:Arial,Helvetica,sans-serif;color:#f5f0e6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#11110f;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:760px;background:#1b1a17;border:1px solid #4a4337;border-collapse:collapse;">
      <tr><td style="height:4px;background:#c4a15a;font-size:0;">&nbsp;</td></tr>
      <tr><td align="center" style="padding:34px 24px 26px;"><div style="color:#c9a75e;font-size:10px;letter-spacing:3px;text-transform:uppercase;">ILS 2026 · Daily report</div><h1 style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:normal;">Registration Summary</h1><p style="margin:12px 0 0;color:#8f887d;font-size:13px;">${escapeHtml(reportDate)} · Asia/Kolkata</p></td></tr>
      <tr><td style="padding:0 24px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#24211c;border:1px solid #4a4337;border-collapse:collapse;"><tr><td style="padding:18px;color:#8f887d;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Registrations<br><strong style="display:block;margin-top:7px;color:#f5f0e6;font-family:Georgia,'Times New Roman',serif;font-size:25px;">${registrations.length}</strong></td><td align="right" style="padding:18px;color:#8f887d;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Total paid<br><strong style="display:block;margin-top:7px;color:#d5b66e;font-family:Georgia,'Times New Roman',serif;font-size:25px;">${escapeHtml(formatMoney(total, registrations[0]?.currency ?? "INR"))}</strong></td></tr></table></td></tr>
      <tr><td style="padding:0 24px 10px;color:#c9a75e;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Registrant contact list</td></tr>
      <tr><td style="padding:0 24px 24px;overflow-x:auto;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width:560px;border:1px solid #3d382f;border-collapse:collapse;"><thead><tr style="background:#24211c;color:#c9a75e;font-size:9px;letter-spacing:1.3px;text-transform:uppercase;"><th align="left" style="padding:11px 10px;">#</th><th align="left" style="padding:11px 10px;">Registered name</th><th align="left" style="padding:11px 10px;">Email address</th><th align="left" style="padding:11px 10px;">Phone number</th></tr></thead><tbody>${contactRows}</tbody></table></td></tr>
      <tr><td style="padding:0 24px 12px;color:#c9a75e;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Complete registration details</td></tr>
      ${cards}
      <tr><td align="center" style="padding:0 24px 28px;color:#777064;font-size:10px;line-height:18px;">Automated report · CorporateConnections AP&amp;TS</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function createText(reportDate: string, registrations: Registration[]): string {
  const total = registrations.reduce((sum, item) => sum + item.amount, 0);
  const lines = registrations.map((item, index) => `${index + 1}. ${item.name}
Registration type: ${item.registrationType}
Email: ${item.email}
Phone: ${item.phone}
Chapter / market / region: ${item.chapterName}
Organisation: ${item.organization}
Designation: ${item.designation}
Industry: ${item.industry}
Other industry: ${item.industryOther}
Sponsorship interest: ${item.sponsorshipInterest}
Sponsorship details: ${item.sponsorshipDetails}
Dietary restrictions: ${item.dietaryRestrictions}
Other dietary restriction: ${item.dietaryOther}
Address 1: ${item.address1}
Address 2: ${item.address2}
Country / region: ${item.country}
City: ${item.city}
State / province: ${item.stateProvince}
ZIP / postal code: ${item.postalCode}
VAT / GST number: ${item.vatGstNumber}
Reason for attending: ${item.intent}
Registration ID: ${item.orderId}
Transaction ID: ${item.transactionId}
Payment method: ${item.paymentMethod}
Registration fee: ${formatMoney(item.baseAmount, item.currency)}
GST (${item.gstRate}%): ${formatMoney(item.gstAmount, item.currency)}
Total paid: ${formatMoney(item.amount, item.currency)}
Registered at: ${formatTime(item.registeredAt)} IST`);
  return [
    `ILS 2026 daily registration report — ${reportDate}`,
    `Registrations: ${registrations.length}`,
    `Total paid: ${formatMoney(total, registrations[0]?.currency ?? "INR")}`,
    "",
    ...lines,
  ].join("\n");
}

export async function sendPreviousDayRegistrationReport(now = new Date()) {
  const { reportDate, start, end } = getPreviousDayReportWindow(now);
  const reportReference = db.collection("dailyRegistrationReports").doc(reportDate);
  const existingReport = await reportReference.get();
  if (existingReport.data()?.status === "SENT") {
    return { status: "ALREADY_SENT" as const, reportDate, count: number(existingReport.data()?.count) };
  }

  const snapshot = await db
    .collection("summitApplications")
    .where("verifiedAt", ">=", Timestamp.fromDate(start))
    .where("verifiedAt", "<", Timestamp.fromDate(end))
    .get();

  const registrations = snapshot.docs.flatMap((document): Registration[] => {
    const data = document.data();
    const applicant = (data.applicant ?? {}) as Record<string, unknown>;
    const payment = (data.payment ?? {}) as Record<string, unknown>;
    const pricing = (data.pricing ?? {}) as Record<string, unknown>;
    const status = text(payment.status, "UNKNOWN").toUpperCase();
    const registeredAt = data.verifiedAt?.toDate?.() as Date | undefined;
    if (!PAID_STATUSES.has(status) || !registeredAt) return [];
    return [{
      orderId: text(data.orderId, document.id),
      name: text(applicant.name),
      email: text(applicant.email),
      phone: text(applicant.phone),
      chapterName: text(applicant.chapterName),
      organization: text(applicant.organization),
      designation: text(applicant.designation),
      registrationType: text(applicant.registrationType),
      industry: text(applicant.industry),
      industryOther: text(applicant.industryOther),
      sponsorshipInterest: text(applicant.sponsorshipInterest),
      sponsorshipDetails: text(applicant.sponsorshipDetails),
      dietaryRestrictions: Array.isArray(applicant.dietaryRestrictions)
        ? applicant.dietaryRestrictions.map((item) => text(item)).join(", ") || "-"
        : text(applicant.dietaryRestrictions),
      dietaryOther: text(applicant.dietaryOther),
      address1: text(applicant.address1),
      address2: text(applicant.address2),
      country: text(applicant.country),
      city: text(applicant.city),
      stateProvince: text(applicant.stateProvince),
      postalCode: text(applicant.postalCode),
      vatGstNumber: text(applicant.vatGstNumber),
      intent: text(applicant.intent),
      transactionId: text(payment.transactionId),
      paymentMethod: text(payment.paymentMethod),
      baseAmount: number(pricing.baseAmount),
      gstRate: number(pricing.gstRate),
      gstAmount: number(pricing.gstAmount),
      amount: number(payment.paidAmount ?? pricing.totalAmount),
      currency: text(pricing.currency, "INR"),
      registeredAt,
    }];
  }).sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime());

  if (registrations.length === 0) {
    await reportReference.set({
      status: "SKIPPED_EMPTY",
      reportDate,
      count: 0,
      periodStart: Timestamp.fromDate(start),
      periodEnd: Timestamp.fromDate(end),
      checkedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { status: "SKIPPED_EMPTY" as const, reportDate, count: 0 };
  }

  const existingKey = text(existingReport.data()?.idempotencyKey, "");
  const idempotencyKey = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingKey)
    ? existingKey
    : randomUUID();
  await reportReference.set({
    status: "SENDING",
    reportDate,
    count: registrations.length,
    idempotencyKey,
    recipient: REPORT_RECIPIENT.email,
    periodStart: Timestamp.fromDate(start),
    periodEnd: Timestamp.fromDate(end),
    attemptedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": requiredEnvironmentVariable("BREVO_API_KEY"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: parseMailbox(requiredEnvironmentVariable("EMAIL_FROM")),
        to: [REPORT_RECIPIENT],
        replyTo: parseMailbox(process.env.EMAIL_REPLY_TO?.trim() || REPORT_RECIPIENT.email),
        subject: `ILS 2026 daily registration report · ${reportDate} · ${registrations.length} registered`,
        htmlContent: createHtml(reportDate, registrations),
        textContent: createText(reportDate, registrations),
        headers: { idempotencyKey },
        tags: ["ils-daily-registration-report"],
      }),
    });
    const rawResponse = await response.text();
    const result = JSON.parse(rawResponse || "{}") as { messageId?: string; message?: string; code?: string };
    if (!response.ok || !result.messageId) {
      throw new Error(result.message || result.code || `Brevo report email failed (${response.status})`);
    }
    await reportReference.set({
      status: "SENT",
      messageId: result.messageId,
      sentAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { status: "SENT" as const, reportDate, count: registrations.length, messageId: result.messageId };
  } catch (error) {
    await reportReference.set({
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown daily report error",
      failedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => undefined);
    throw error;
  }
}
