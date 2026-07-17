import crypto from "node:crypto";

export function generateOrderId(): string {
  // 18 characters: IL + 16 random hexadecimal characters
  return `IL${crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()}`;
}

export function generateCustomerId(): string {
  return `CU${crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()}`;
}