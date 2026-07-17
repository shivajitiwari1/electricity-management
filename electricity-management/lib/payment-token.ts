import crypto from "crypto";

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? "dev-secret-fallback";
}

export function generatePaymentToken(billId: string): string {
  const hmac = crypto.createHmac("sha256", secret()).update(billId).digest("hex");
  return `${billId}_${hmac}`;
}

export function verifyPaymentToken(token: string): string | null {
  const idx = token.lastIndexOf("_");
  if (idx === -1) return null;
  const billId = token.substring(0, idx);
  const provided = token.substring(idx + 1);
  const expected = crypto.createHmac("sha256", secret()).update(billId).digest("hex");
  const match = crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  return match ? billId : null;
}
