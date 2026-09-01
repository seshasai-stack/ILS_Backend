const baseAmount = 39500;
const gstRate = 18;
const gstAmount = Number(((baseAmount * gstRate) / 100).toFixed(2));
const totalAmount = Number((baseAmount + gstAmount).toFixed(2));

export const REGISTRATION_PRICE = {
  baseAmount,
  gstRate,
  gstAmount,
  totalAmount,
  currency: "INR" as const,
};
