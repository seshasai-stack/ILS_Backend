import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

const brevoApiKey = getRequiredEnvironmentVariable("BREVO_API_KEY");

const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";

function parseMailbox(value: string): {
  email: string;
  name?: string;
} {
  const mailbox = value.trim();
  const match = mailbox.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);

  if (match) {
    const name = (match[1] ?? "").trim().replace(/^['"]|['"]$/g, "");

    return {
      email: (match[2] ?? "").trim(),
      ...(name ? { name } : {}),
    };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox)) {
    return { email: mailbox };
  }

  throw new Error(
    "EMAIL_FROM must be an email address or use Name <email@example.com> format",
  );
}

const emailFrom = parseMailbox(getRequiredEnvironmentVariable("EMAIL_FROM"));

const replyTo = parseMailbox(
  process.env.EMAIL_REPLY_TO?.trim() || "ils@corporateconnections-india.com",
);

const teamNotificationRecipient = {
  email: "ils@corporateconnections-india.com",
  name: "India Leadership Summit Team",
};

type PaymentEmailInput = {
  orderId: string;
  transactionId: string;

  applicantName: string;
  applicantEmail: string;
  phone?: string;
  registrationType?: string;
  chapterName?: string;
  organization?: string;
  designation?: string;
  industry?: string;
  industryOther?: string;
  sponsorshipInterest?: string;
  sponsorshipDetails?: string;
  dietaryRestrictions?: string[];
  dietaryOther?: string;
  address1?: string;
  address2?: string;
  country?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  vatGstNumber?: string;
  intent?: string;

  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  currency: string;

  paymentMethod?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPaymentDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

function createInvoiceEmailHtml(input: PaymentEmailInput): string {
  const name = escapeHtml(input.applicantName);

  const email = escapeHtml(input.applicantEmail);

  const phone = escapeHtml(input.phone || "-");

  const address = escapeHtml(
    [
      input.address1,
      input.address2,
      input.city,
      input.stateProvince,
      input.postalCode,
      input.country,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ") || "-",
  );

  const organization = escapeHtml(input.organization || "Not provided");

  const designation = escapeHtml(input.designation || "Not provided");

  const orderId = escapeHtml(input.orderId);

  const transactionId = escapeHtml(input.transactionId);

  const paymentMethod = escapeHtml(input.paymentMethod || "Online payment");

  const baseAmount = formatCurrency(input.baseAmount, input.currency);

  const gstAmount = formatCurrency(input.gstAmount, input.currency);

  const totalAmount = formatCurrency(input.totalAmount, input.currency);

  const paymentDate = formatPaymentDate();

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <title>
    ILS 2026 Payment Confirmation
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background-color:#11110f;
    font-family:Arial,Helvetica,sans-serif;
    color:#f5f0e6;
  "
>
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
    "
  >
    Your India Leadership Summit 2026 payment has
    been confirmed. Reference ID: ${orderId}
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
      width:100%;
      background-color:#11110f;
      border-collapse:collapse;
    "
  >
    <tr>
      <td
        align="center"
        style="padding:32px 12px;"
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:640px;
            background-color:#1b1a17;
            border:1px solid #4a4337;
            border-collapse:collapse;
          "
        >
          <!-- Gold top border -->
          <tr>
            <td
              style="
                height:4px;
                background-color:#c4a15a;
                font-size:0;
                line-height:0;
              "
            >
              &nbsp;
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td
              align="center"
              style="
                padding:36px 28px 30px;
              "
            >
              <div
                style="
                  color:#c9a75e;
                  font-size:10px;
                  line-height:16px;
                  letter-spacing:3px;
                  text-transform:uppercase;
                "
              >
                ILS 2026 · November · Hyderabad
              </div>

              <div
                style="
                  margin-top:14px;
                  color:#f5f0e6;
                  font-family:Georgia,'Times New Roman',serif;
                  font-size:30px;
                  line-height:38px;
                "
              >
                India Leadership Summit
              </div>

              <div
                style="
                  width:54px;
                  height:1px;
                  margin:24px auto 0;
                  background-color:#9d8045;
                "
              >
                &nbsp;
              </div>
            </td>
          </tr>

          <!-- Success -->
          <tr>
            <td
              align="center"
              style="
                padding:8px 28px 32px;
              "
            >
              <div
                style="
                  width:58px;
                  height:58px;
                  margin:0 auto;
                  border:1px solid #c4a15a;
                  border-radius:50%;
                  background-color:#29251e;
                  color:#d5b66e;
                  font-size:26px;
                  line-height:58px;
                  text-align:center;
                "
              >
                ✓
              </div>

              <div
                style="
                  margin-top:22px;
                  color:#c9a75e;
                  font-size:10px;
                  line-height:16px;
                  letter-spacing:2.5px;
                  text-transform:uppercase;
                "
              >
                Payment successful
              </div>

              <h1
                style="
                  margin:12px 0 0;
                  color:#f5f0e6;
                  font-family:Georgia,'Times New Roman',serif;
                  font-size:32px;
                  font-weight:normal;
                  line-height:40px;
                "
              >
                Your registration is confirmed.
              </h1>

              <p
                style="
                  max-width:500px;
                  margin:18px auto 0;
                  color:#b8b0a2;
                  font-size:14px;
                  line-height:24px;
                "
              >
                Dear ${name}, your payment for India
                Leadership Summit 2026 has been
                successfully verified. Please retain
                this email as your payment invoice and
                registration confirmation.
              </p>
            </td>
          </tr>

          <!-- Invoice heading -->
          <tr>
            <td
              style="
                padding:0 28px;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  background-color:#24211c;
                  border:1px solid #4a4337;
                  border-collapse:collapse;
                "
              >
                <tr>
                  <td
                    style="
                      padding:17px 18px;
                      color:#d3b36a;
                      font-size:10px;
                      letter-spacing:2.2px;
                      text-transform:uppercase;
                    "
                  >
                    Registration Invoice
                  </td>

                  <td
                    align="right"
                    style="
                      padding:17px 18px;
                      color:#928a7e;
                      font-size:10px;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                    "
                  >
                    Paid
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Applicant information -->
          <tr>
            <td
              style="
                padding:20px 28px 0;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  border:1px solid #3d382f;
                  border-collapse:collapse;
                "
              >
                <tr>
                  <td
                    colspan="2"
                    style="
                      padding:14px 18px;
                      border-bottom:1px solid #3d382f;
                      color:#c9a75e;
                      font-size:10px;
                      letter-spacing:2px;
                      text-transform:uppercase;
                    "
                  >
                    Billed to
                  </td>
                </tr>

                
                <tr>
                  <td
                    style="
                      width:38%;
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Name
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#f5f0e6;
                      font-size:12px;
                      word-break:break-word;
                    "
                  >
                    ${name}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Email
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#f5f0e6;
                      font-size:12px;
                      word-break:break-all;
                    "
                  >
                    ${email}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Organisation
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#f5f0e6;
                      font-size:12px;
                    "
                  >
                    ${organization}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 18px;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Designation
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      color:#f5f0e6;
                      font-size:12px;
                    "
                  >
                    ${designation}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #302d27;color:#8f887d;font-size:12px;">
                    Phone
                  </td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #302d27;color:#f5f0e6;font-size:12px;word-break:break-word;">
                    ${phone}
                  </td>
                </tr>

                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #302d27;color:#8f887d;font-size:12px;vertical-align:top;">
                    Address
                  </td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #302d27;color:#f5f0e6;font-size:12px;line-height:19px;word-break:break-word;">
                    ${address}
                  </td>
                </tr>


          <!-- Payment references -->
          <tr>
            <td
              style="
                padding:20px 28px 0;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  border:1px solid #3d382f;
                  border-collapse:collapse;
                "
              >
                <tr>
                  <td
                    colspan="2"
                    style="
                      padding:14px 18px;
                      border-bottom:1px solid #3d382f;
                      color:#c9a75e;
                      font-size:10px;
                      letter-spacing:2px;
                      text-transform:uppercase;
                    "
                  >
                    Payment details
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      width:38%;
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Registration ID
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#d5b66e;
                      font-size:12px;
                      font-weight:bold;
                      word-break:break-all;
                    "
                  >
                    ${orderId}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Transaction ID
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#f5f0e6;
                      font-size:12px;
                      word-break:break-all;
                    "
                  >
                    ${transactionId}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Payment date
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      border-bottom:1px solid #302d27;
                      color:#f5f0e6;
                      font-size:12px;
                    "
                  >
                    ${paymentDate}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 18px;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    Payment method
                  </td>

                  <td
                    align="right"
                    style="
                      padding:13px 18px;
                      color:#f5f0e6;
                      font-size:12px;
                    "
                  >
                    ${paymentMethod}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice amounts -->
          <tr>
            <td
              style="
                padding:20px 28px 0;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  border:1px solid #3d382f;
                  border-collapse:collapse;
                "
              >
                <tr>
                  <td
                    style="
                      padding:14px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    ILS 2026 Registration
                  </td>

                  <td
                    align="right"
                    style="
                      padding:14px 18px;
                      border-bottom:1px solid #302d27;
                      color:#f5f0e6;
                      font-size:12px;
                    "
                  >
                    ${baseAmount}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:14px 18px;
                      border-bottom:1px solid #302d27;
                      color:#8f887d;
                      font-size:12px;
                    "
                  >
                    GST (${input.gstRate}%)
                  </td>

                  <td
                    align="right"
                    style="
                      padding:14px 18px;
                      border-bottom:1px solid #302d27;
                      color:#f5f0e6;
                      font-size:12px;
                    "
                  >
                    ${gstAmount}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:18px;
                      color:#f5f0e6;
                      font-size:14px;
                      font-weight:bold;
                    "
                  >
                    Total paid
                  </td>

                  <td
                    align="right"
                    style="
                      padding:18px;
                      color:#d5b66e;
                      font-family:Georgia,'Times New Roman',serif;
                      font-size:22px;
                    "
                  >
                    ${totalAmount}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Information -->
          <tr>
            <td
              style="
                padding:24px 28px 0;
              "
            >
              <div
                style="
                  padding:18px;
                  background-color:#28241d;
                  border-left:2px solid #c4a15a;
                  color:#b8b0a2;
                  font-size:13px;
                  line-height:22px;
                "
              >
                This email serves as your registration
                confirmation and payment invoice. Please
                keep your Registration ID and Transaction
                ID for future correspondence.
              </div>
            </td>
          </tr>

          <!-- Contact -->
          <tr>
            <td
              align="center"
              style="
                padding:30px 28px 34px;
              "
            >
              <p
                style="
                  margin:0;
                  color:#9e968a;
                  font-size:12px;
                  line-height:21px;
                "
              >
                For payment or registration assistance,
                contact
              </p>

              <a
                href="mailto:${replyTo.email}"
                style="
                  display:inline-block;
                  margin-top:7px;
                  color:#d5b66e;
                  font-size:13px;
                  text-decoration:none;
                "
              >
                ${escapeHtml(replyTo.email)}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              align="center"
              style="
                padding:22px 28px;
                background-color:#151411;
                border-top:1px solid #3d382f;
                color:#777065;
                font-size:10px;
                line-height:18px;
              "
            >
              CorporateConnections AP&amp;TS<br />
              C/O Ascent Sphere LLP<br />
              Confidential · By invitation
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function createPlainTextEmail(input: PaymentEmailInput): string {
  return `
India Leadership Summit 2026

Payment successful

Dear ${input.applicantName},

Your India Leadership Summit 2026 registration has been confirmed.

Registration ID: ${input.orderId}
Transaction ID: ${input.transactionId}
Payment method: ${input.paymentMethod || "Online payment"}

Registration fee: ${formatCurrency(input.baseAmount, input.currency)}

GST (${input.gstRate}%): ${formatCurrency(input.gstAmount, input.currency)}

Total paid: ${formatCurrency(input.totalAmount, input.currency)}

Registered email: ${input.applicantEmail}
Phone: ${input.phone || "-"}
Address: ${[
  input.address1,
  input.address2,
  input.city,
  input.stateProvince,
  input.postalCode,
  input.country,
].filter((part) => part?.trim()).join(", ") || "-"}
Organisation: ${input.organization || "Not provided"}
Designation: ${input.designation || "Not provided"}

This email serves as your registration confirmation and payment invoice.

For assistance, contact:
${replyTo.email}

CorporateConnections AP&TS
C/O Ascent Sphere LLP
  `.trim();
}

function createTeamNotificationEmailHtml(input: PaymentEmailInput): string {
  const valueOrDash = (value?: string) => value?.trim() || "-";
  const rows: Array<[string, string]> = [
    ["Registration type", valueOrDash(input.registrationType)],
    ["Name", input.applicantName],
    ["Email", input.applicantEmail],
    ["Phone", valueOrDash(input.phone)],
    ["Chapter / market / region", valueOrDash(input.chapterName)],
    ["Organisation", valueOrDash(input.organization)],
    ["Designation", valueOrDash(input.designation)],
    ["Industry", valueOrDash(input.industry)],
    ["Other industry", valueOrDash(input.industryOther)],
    ["Sponsorship interest", valueOrDash(input.sponsorshipInterest)],
    ["Sponsorship details", valueOrDash(input.sponsorshipDetails)],
    ["Dietary restrictions", input.dietaryRestrictions?.length ? input.dietaryRestrictions.join(", ") : "-"],
    ["Other dietary restriction", valueOrDash(input.dietaryOther)],
    ["Address 1", valueOrDash(input.address1)],
    ["Address 2", valueOrDash(input.address2)],
    ["Country / region", valueOrDash(input.country)],
    ["City", valueOrDash(input.city)],
    ["State / province", valueOrDash(input.stateProvince)],
    ["ZIP / postal code", valueOrDash(input.postalCode)],
    ["VAT / GST number", valueOrDash(input.vatGstNumber)],
    ["Reason for attending", valueOrDash(input.intent)],
    ["Registration ID", input.orderId],
    ["Transaction ID", input.transactionId],
    ["Payment method", valueOrDash(input.paymentMethod)],
  ];

  const detailRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="width:38%;padding:13px 18px;border-bottom:1px solid #302d27;color:#8f887d;font-size:12px;vertical-align:top;">
            ${escapeHtml(label)}
          </td>
          <td align="right" style="padding:13px 18px;border-bottom:1px solid #302d27;color:#f5f0e6;font-size:12px;line-height:19px;word-break:break-word;">
            ${escapeHtml(value)}
          </td>
        </tr>`,
    )
    .join("");

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New ILS 2026 Registration</title>
</head>
<body style="margin:0;padding:0;background-color:#11110f;font-family:Arial,Helvetica,sans-serif;color:#f5f0e6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(input.applicantName)} has completed registration and payment for ILS 2026.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#11110f;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background-color:#1b1a17;border:1px solid #4a4337;border-collapse:collapse;">
          <tr><td style="height:4px;background-color:#c4a15a;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td align="center" style="padding:36px 28px 30px;">
              <div style="color:#c9a75e;font-size:10px;line-height:16px;letter-spacing:3px;text-transform:uppercase;">ILS 2026 · Team notification</div>
              <div style="margin-top:14px;color:#f5f0e6;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:38px;">New Summit Registration</div>
              <div style="width:54px;height:1px;margin:24px auto 0;background-color:#9d8045;">&nbsp;</div>
              <p style="max-width:500px;margin:22px auto 0;color:#b8b0a2;font-size:14px;line-height:24px;">
                ${escapeHtml(input.applicantName)} has successfully registered and completed payment for India Leadership Summit 2026.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #3d382f;border-collapse:collapse;">
                <tr><td colspan="2" style="padding:14px 18px;border-bottom:1px solid #3d382f;color:#c9a75e;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Registrant details</td></tr>
                ${detailRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#24211c;border:1px solid #4a4337;border-collapse:collapse;">
                <tr><td style="padding:13px 18px;color:#8f887d;font-size:12px;">Registration fee</td><td align="right" style="padding:13px 18px;color:#f5f0e6;font-size:12px;">${formatCurrency(input.baseAmount, input.currency)}</td></tr>
                <tr><td style="padding:13px 18px;border-top:1px solid #302d27;color:#8f887d;font-size:12px;">GST (${input.gstRate}%)</td><td align="right" style="padding:13px 18px;border-top:1px solid #302d27;color:#f5f0e6;font-size:12px;">${formatCurrency(input.gstAmount, input.currency)}</td></tr>
                <tr><td style="padding:17px 18px;border-top:1px solid #4a4337;color:#d3b36a;font-size:13px;font-weight:bold;">Total paid</td><td align="right" style="padding:17px 18px;border-top:1px solid #4a4337;color:#d5b66e;font-size:18px;font-weight:bold;">${formatCurrency(input.totalAmount, input.currency)}</td></tr>
              </table>
            </td>
          </tr>
          <tr><td align="center" style="padding:28px;color:#777064;font-size:10px;line-height:18px;">Payment confirmed on ${formatPaymentDate()}<br />CorporateConnections AP&amp;TS · C/O Ascent Sphere LLP</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function createTeamNotificationPlainText(input: PaymentEmailInput): string {
  const valueOrDash = (value?: string) => value?.trim() || "-";
  return `
India Leadership Summit 2026 — New registration

${input.applicantName} has successfully registered and completed payment.

Name: ${input.applicantName}
Email: ${input.applicantEmail}
Phone: ${valueOrDash(input.phone)}
Registration type: ${valueOrDash(input.registrationType)}
Chapter / market / region: ${valueOrDash(input.chapterName)}
Organisation: ${valueOrDash(input.organization)}
Designation: ${valueOrDash(input.designation)}
Industry: ${valueOrDash(input.industry)}
Other industry: ${valueOrDash(input.industryOther)}
Sponsorship interest: ${valueOrDash(input.sponsorshipInterest)}
Sponsorship details: ${valueOrDash(input.sponsorshipDetails)}
Dietary restrictions: ${input.dietaryRestrictions?.length ? input.dietaryRestrictions.join(", ") : "-"}
Other dietary restriction: ${valueOrDash(input.dietaryOther)}
Address 1: ${valueOrDash(input.address1)}
Address 2: ${valueOrDash(input.address2)}
Country / region: ${valueOrDash(input.country)}
City: ${valueOrDash(input.city)}
State / province: ${valueOrDash(input.stateProvince)}
ZIP / postal code: ${valueOrDash(input.postalCode)}
VAT / GST number: ${valueOrDash(input.vatGstNumber)}
Reason for attending: ${valueOrDash(input.intent)}

Registration ID: ${input.orderId}
Transaction ID: ${input.transactionId}
Payment method: ${valueOrDash(input.paymentMethod)}
Registration fee: ${formatCurrency(input.baseAmount, input.currency)}
GST (${input.gstRate}%): ${formatCurrency(input.gstAmount, input.currency)}
Total paid: ${formatCurrency(input.totalAmount, input.currency)}
  `.trim();
}

export async function sendPaymentSuccessEmailOnce(
  input: PaymentEmailInput,
): Promise<void> {
  const applicationReference = db
    .collection("summitApplications")
    .doc(input.orderId);

  /*
   * Check whether an email has already been sent
   * for this transaction.
   */
  const applicationSnapshot = await applicationReference.get();

  if (!applicationSnapshot.exists) {
    throw new Error("Application does not exist for email delivery");
  }

  const application = applicationSnapshot.data();

  const existingIsSent = Number(application?.payment?.is_sent ?? 0);

  const existingSentTransactionId = String(
    application?.payment?.email_transaction_id ?? "",
  ).trim();

  if (
    existingIsSent === 1 &&
    existingSentTransactionId === input.transactionId
  ) {
    console.log("Payment email already sent:", {
      orderId: input.orderId,
      transactionId: input.transactionId,
    });

    return;
  }

  /*
   * Mark the attempt as in progress.
   * is_sent remains 0 until Brevo accepts the email.
   */
  await applicationReference.update({
    "payment.is_sent": 0,

    "payment.email_status": "SENDING",

    "payment.email_transaction_id": input.transactionId,

    "payment.email_recipient": input.applicantEmail,

    "payment.email_attempted_at": FieldValue.serverTimestamp(),

    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    console.log("Attempting Brevo payment email", {
      orderId: input.orderId,
      transactionId: input.transactionId,
      recipient: input.applicantEmail,
      sender: emailFrom.email,
    });

    const payload = {
      sender: emailFrom,

      to: [
        {
          email: input.applicantEmail,
          name: input.applicantName,
        },
      ],

      replyTo,

      subject: `Payment confirmed · ILS 2026 · ${input.orderId}`,

      htmlContent: createInvoiceEmailHtml(input),

      textContent: createPlainTextEmail(input),

      tags: ["ils-payment-confirmation"],
    };

    const response = await fetch(brevoApiUrl, {
      method: "POST",

      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },

      body: JSON.stringify(payload),
    });

    const rawResponse = await response.text();

    console.log("Brevo API response", {
      status: response.status,
      response: rawResponse,
      recipient: input.applicantEmail,
    });

    let result: {
      messageId?: string;
      message?: string;
      code?: string;
    } = {};

    try {
      result = JSON.parse(rawResponse);
    } catch {
      console.error("Could not parse Brevo response as JSON", rawResponse);
    }

    if (!response.ok) {
      throw new Error(
        `Brevo email failed (${response.status}): ${
          result.message || result.code || rawResponse || "Unknown Brevo error"
        }`,
      );
    }

    if (!result.messageId) {
      throw new Error(
        `Brevo returned success without messageId: ${rawResponse}`,
      );
    }

    /*
     * KEEP EVERYTHING BELOW THIS AS IT IS
     * Do not delete this part.
     */

    await applicationReference.update({
      "payment.is_sent": 1,

      "payment.email_status": "SENT",

      "payment.email_id": result.messageId,

      "payment.email_provider": "BREVO",

      "payment.email_transaction_id": input.transactionId,

      "payment.email_recipient": input.applicantEmail,

      "payment.email_sent_at": FieldValue.serverTimestamp(),

      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log("Payment confirmation email sent:", {
      orderId: input.orderId,
      transactionId: input.transactionId,
      emailId: result.messageId,
      recipient: input.applicantEmail,
    });
  } catch (error) {
    await applicationReference
      .update({
        "payment.is_sent": 0,

        "payment.email_status": "FAILED",

        "payment.email_error":
          error instanceof Error ? error.message : "Unknown email error",

        "payment.email_transaction_id": input.transactionId,

        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    throw error;
  }
}

export async function sendTeamRegistrationEmailOnce(
  input: PaymentEmailInput,
): Promise<void> {
  const applicationReference = db
    .collection("summitApplications")
    .doc(input.orderId);
  const applicationSnapshot = await applicationReference.get();

  if (!applicationSnapshot.exists) {
    throw new Error("Application does not exist for team email delivery");
  }

  const application = applicationSnapshot.data();
  const alreadySent = Number(
    application?.payment?.team_email_is_sent ?? 0,
  );
  const sentTransactionId = String(
    application?.payment?.team_email_transaction_id ?? "",
  ).trim();
  const existingIdempotencyKey = String(
    application?.payment?.team_email_idempotency_key ?? "",
  ).trim();
  const idempotencyKey =
    sentTransactionId === input.transactionId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingIdempotencyKey)
      ? existingIdempotencyKey
      : randomUUID();

  if (alreadySent === 1 && sentTransactionId === input.transactionId) {
    console.log("Team registration email already sent:", {
      orderId: input.orderId,
      transactionId: input.transactionId,
    });
    return;
  }

  await applicationReference.update({
    "payment.team_email_is_sent": 0,
    "payment.team_email_status": "SENDING",
    "payment.team_email_transaction_id": input.transactionId,
    "payment.team_email_idempotency_key": idempotencyKey,
    "payment.team_email_recipient": teamNotificationRecipient.email,
    "payment.team_email_attempted_at": FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const response = await fetch(brevoApiUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: emailFrom,
        to: [teamNotificationRecipient],
        replyTo,
        subject: `New ILS 2026 registration · ${input.applicantName} · ${input.orderId}`,
        htmlContent: createTeamNotificationEmailHtml(input),
        textContent: createTeamNotificationPlainText(input),
        headers: {
          idempotencyKey,
        },
        tags: ["ils-team-registration"],
      }),
    });

    const rawResponse = await response.text();
    let result: {
      messageId?: string;
      message?: string;
      code?: string;
    } = {};

    try {
      result = JSON.parse(rawResponse);
    } catch {
      console.error("Could not parse Brevo team-email response", rawResponse);
    }

    if (!response.ok) {
      throw new Error(
        `Brevo team email failed (${response.status}): ${
          result.message || result.code || rawResponse || "Unknown Brevo error"
        }`,
      );
    }

    if (!result.messageId) {
      throw new Error(
        `Brevo returned success without a team-email messageId: ${rawResponse}`,
      );
    }

    await applicationReference.update({
      "payment.team_email_is_sent": 1,
      "payment.team_email_status": "SENT",
      "payment.team_email_id": result.messageId,
      "payment.team_email_provider": "BREVO",
      "payment.team_email_transaction_id": input.transactionId,
      "payment.team_email_recipient": teamNotificationRecipient.email,
      "payment.team_email_sent_at": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log("Team registration email sent:", {
      orderId: input.orderId,
      transactionId: input.transactionId,
      emailId: result.messageId,
      recipient: teamNotificationRecipient.email,
    });
  } catch (error) {
    await applicationReference
      .update({
        "payment.team_email_is_sent": 0,
        "payment.team_email_status": "FAILED",
        "payment.team_email_error":
          error instanceof Error ? error.message : "Unknown team email error",
        "payment.team_email_transaction_id": input.transactionId,
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    throw error;
  }
}
