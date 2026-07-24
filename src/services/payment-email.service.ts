import { Resend } from "resend";
import {
  FieldValue,
} from "firebase-admin/firestore";

import { db } from "../config/firebase.js";

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

const resend = new Resend(
  getRequiredEnvironmentVariable(
    "RESEND_API_KEY"
  )
);

const emailFrom =
  getRequiredEnvironmentVariable(
    "EMAIL_FROM"
  );

const replyTo =
  process.env.EMAIL_REPLY_TO?.trim() ||
  "ils@corporateconnections-india.com";

type PaymentEmailInput = {
  orderId: string;
  transactionId: string;

  applicantName: string;
  applicantEmail: string;
  organization?: string;
  designation?: string;

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

function formatCurrency(
  amount: number,
  currency: string
): string {
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

function createInvoiceEmailHtml(
  input: PaymentEmailInput
): string {
  const name = escapeHtml(
    input.applicantName
  );

  const email = escapeHtml(
    input.applicantEmail
  );

  const organization = escapeHtml(
    input.organization || "Not provided"
  );

  const designation = escapeHtml(
    input.designation || "Not provided"
  );

  const orderId = escapeHtml(
    input.orderId
  );

  const transactionId = escapeHtml(
    input.transactionId
  );

  const paymentMethod = escapeHtml(
    input.paymentMethod ||
      "Online payment"
  );

  const baseAmount = formatCurrency(
    input.baseAmount,
    input.currency
  );

  const gstAmount = formatCurrency(
    input.gstAmount,
    input.currency
  );

  const totalAmount = formatCurrency(
    input.totalAmount,
    input.currency
  );

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
                href="mailto:${replyTo}"
                style="
                  display:inline-block;
                  margin-top:7px;
                  color:#d5b66e;
                  font-size:13px;
                  text-decoration:none;
                "
              >
                ${replyTo}
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

function createPlainTextEmail(
  input: PaymentEmailInput
): string {
  return `
India Leadership Summit 2026

Payment successful

Dear ${input.applicantName},

Your India Leadership Summit 2026 registration has been confirmed.

Registration ID: ${input.orderId}
Transaction ID: ${input.transactionId}
Payment method: ${input.paymentMethod || "Online payment"}

Registration fee: ${formatCurrency(
    input.baseAmount,
    input.currency
  )}

GST (${input.gstRate}%): ${formatCurrency(
    input.gstAmount,
    input.currency
  )}

Total paid: ${formatCurrency(
    input.totalAmount,
    input.currency
  )}

Registered email: ${input.applicantEmail}
Organisation: ${input.organization || "Not provided"}
Designation: ${input.designation || "Not provided"}

This email serves as your registration confirmation and payment invoice.

For assistance, contact:
${replyTo}

CorporateConnections AP&TS
C/O Ascent Sphere LLP
  `.trim();
}

export async function sendPaymentSuccessEmailOnce(
  input: PaymentEmailInput
): Promise<void> {
  const applicationReference = db
    .collection("summitApplications")
    .doc(input.orderId);

  /*
   * Check whether an email has already been sent
   * for this transaction.
   */
  const applicationSnapshot =
    await applicationReference.get();

  if (!applicationSnapshot.exists) {
    throw new Error(
      "Application does not exist for email delivery"
    );
  }

  const application =
    applicationSnapshot.data();

  const existingIsSent = Number(
    application?.payment?.is_sent ?? 0
  );

  const existingSentTransactionId =
    String(
      application?.payment
        ?.email_transaction_id ?? ""
    ).trim();

  if (
    existingIsSent === 1 &&
    existingSentTransactionId ===
      input.transactionId
  ) {
    console.log(
      "Payment email already sent:",
      {
        orderId: input.orderId,
        transactionId:
          input.transactionId,
      }
    );

    return;
  }

  /*
   * Mark the attempt as in progress.
   * is_sent remains 0 until Resend confirms success.
   */
  await applicationReference.update({
    "payment.is_sent": 0,

    "payment.email_status":
      "SENDING",

    "payment.email_transaction_id":
      input.transactionId,

    "payment.email_recipient":
      input.applicantEmail,

    "payment.email_attempted_at":
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  try {
    const { data, error } =
      await resend.emails.send(
        {
          from: emailFrom,

          to: [
            input.applicantEmail,
          ],

          replyTo,

          subject:
            `Payment confirmed · ILS 2026 · ${input.orderId}`,

          html:
            createInvoiceEmailHtml(
              input
            ),

          text:
            createPlainTextEmail(
              input
            ),

          headers: {
            "X-Entity-Ref-ID":
              `ils-payment-${input.orderId}`,
          },
        },
        {
          /*
           * Prevent duplicate sends when the payment
           * callback is submitted multiple times.
           */
          idempotencyKey:
            `ils-payment-success/${input.transactionId}`,
        }
      );

    if (error) {
      throw new Error(
        error.message ||
          "Email provider rejected the email"
      );
    }

    if (!data?.id) {
      throw new Error(
        "Email provider did not return an email ID"
      );
    }

    /*
     * Mark is_sent = 1 only after the email
     * provider confirms the send request.
     */
    await applicationReference.update({
      "payment.is_sent": 1,

      "payment.email_status":
        "SENT",

      "payment.email_id":
        data.id,

      "payment.email_transaction_id":
        input.transactionId,

      "payment.email_recipient":
        input.applicantEmail,

      "payment.email_sent_at":
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    console.log(
      "Payment confirmation email sent:",
      {
        orderId: input.orderId,
        transactionId:
          input.transactionId,
        emailId: data.id,
        recipient:
          input.applicantEmail,
      }
    );
  } catch (error) {
    await applicationReference
      .update({
        "payment.is_sent": 0,

        "payment.email_status":
          "FAILED",

        "payment.email_error":
          error instanceof Error
            ? error.message
            : "Unknown email error",

        "payment.email_transaction_id":
          input.transactionId,

        updatedAt:
          FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    throw error;
  }
}