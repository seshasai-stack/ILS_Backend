const gstRate = 18;

function price(baseAmount: number) {
  const gstAmount = Number(((baseAmount * gstRate) / 100).toFixed(2));
  return {
    baseAmount,
    gstRate,
    gstAmount,
    totalAmount: Number((baseAmount + gstAmount).toFixed(2)),
    currency: "INR" as const,
  };
}

export function getRegistrationPrice(registrationType: string) {
  if (registrationType === "Member + Spouse") return price(49_500);
  if (registrationType === "Spouse") return price(10_000);
  return price(39_500);
}
