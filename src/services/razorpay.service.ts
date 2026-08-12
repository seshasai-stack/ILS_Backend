import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const keyId = required("RAZORPAY_KEY_ID");
const keySecret = required("RAZORPAY_KEY_SECRET");
const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export interface RazorpayOrder {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes?: Record<string, string>;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  method?: string;
  email?: string;
  contact?: string;
  error_description?: string | null;
  error_code?: string | null;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createRazorpayOrder(input: {
  receipt: string;
  amountPaise: number;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
    throw new Error("Razorpay order amount must be at least 100 paise");
  }

  const order = await razorpay.orders.create({
    amount: input.amountPaise,
    currency: "INR",
    receipt: input.receipt,
    notes: input.notes,
  });
  return order as unknown as RazorpayOrder;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return await razorpay.payments.fetch(paymentId) as unknown as RazorpayPayment;
}

export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  const payments = await razorpay.orders.fetchPayments(orderId);
  return payments.items as unknown as RazorpayPayment[];
}

function validHmac(body: string | Buffer, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "hex"); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  return validHmac(`${orderId}|${paymentId}`, signature, keySecret);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  return validHmac(rawBody, signature, required("RAZORPAY_WEBHOOK_SECRET"));
}

export function getRazorpayKeyId(): string { return keyId; }
