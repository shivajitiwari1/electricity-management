import crypto from "crypto";

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? "dev-secret-fallback";
}

export function generateResetToken(userId: string): string {
  const expiresAt = Date.now() + EXPIRY_MS;
  const payload = `${userId}.${expiresAt}`;
  const hmac = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

export function verifyResetToken(token: string): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, provided] = parts;
  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;
  const payload = `${userId}.${expiresAt}`;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  try {
    const match = crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
    return match ? { userId } : null;
  } catch {
    return null;
  }
}
