# Razorpay setup

## Environment

Copy the Razorpay and Brevo entries from `.env.example` into the deployment environment. Keep the secret keys and webhook secret server-side; only the `keyId` returned by `create-payment` is public.

In the Razorpay Dashboard, enable automatic capture and register this webhook URL:

`POST https://<backend-host>/api/payment/webhook`

Subscribe to `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, and `refund.failed`, using the same secret configured as `RAZORPAY_WEBHOOK_SECRET`.

## Frontend flow (separate frontend repository)

This repository is backend-only. No checkout UI or Razorpay browser script is included here.

1. Send the application to `POST /api/payment/create-payment`.
2. Load `https://checkout.razorpay.com/v1/checkout.js` and open Checkout with the returned `razorpay.keyId`, `razorpay.orderId`, `razorpay.amount`, `razorpay.currency`, and `customer` prefill values.
3. In the Checkout success handler, send the three returned Razorpay fields together with the local `orderId` to `POST /api/payment/verify`:

```json
{
  "orderId": "ILS-...",
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "..."
}
```

4. Show success only when verification returns `paymentStatus: "SUCCESS"`. If verification is temporarily pending, poll `GET /api/payment/payment-status/:orderId`; the signed webhook will reconcile the payment if the browser closes or loses connectivity.

5. In Razorpay Checkout's `modal.ondismiss` callback, call `POST /api/payment/cancel` with `{ "orderId": "ILS-...", "reason": "Checkout dismissed" }`. The backend checks Razorpay before recording cancellation, so a captured payment cannot be downgraded.

Test the complete flow with Razorpay Test Mode before replacing the values with Live Mode keys.

## Payment confirmation email

The backend sends the existing HTML invoice and plain-text fallback through Brevo only after Razorpay reports a captured payment. This happens from Checkout verification, a signed webhook, or status reconciliation. The Razorpay payment ID is used as the Brevo idempotency key, and Firestore also records successful delivery requests, so repeated callbacks do not send duplicate emails.

Create a Brevo API v3 key, authenticate a sending domain or add and verify a sender, and configure:

```env
BREVO_API_KEY=xkeysib-xxxxxxxxxx
EMAIL_FROM=India Leadership Summit <payments@your-verified-domain.com>
EMAIL_REPLY_TO=ils@corporateconnections-india.com
```

`EMAIL_FROM` must match a sender authorized in Brevo. Email delivery failure never changes a successful payment to failed. The failure is stored as `payment.email_status = "FAILED"`, and the next payment-status request retries delivery.
