/**
 * Fast2SMS OTP delivery.
 *
 * Default behaviour uses Fast2SMS's built-in OTP route (`route=otp`), which needs
 * only an API key and an approved DLT template on their side.
 *
 * If the society gets its own DLT template, set:
 *   FAST2SMS_ROUTE=q
 *   FAST2SMS_SENDER_ID=<6 char sender id>
 *   FAST2SMS_TEMPLATE_ID=<dlt template id>
 *   FAST2SMS_MESSAGE=<template body containing {#var#}>
 * and the message is sent through the Quick (transactional) route instead.
 */

const FAST2SMS_ENDPOINT = "https://www.fast2sms.com/dev/bulkV2";

export class SmsError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "SmsError";
    this.status = status;
  }
}

/** Indian mobile numbers are sent as 10 digits, without +91 / leading zero. */
export function normalizeIndianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function readMessage(payload: any): string {
  const message = payload?.message;
  if (Array.isArray(message)) return message.filter(Boolean).join(" ");
  if (typeof message === "string") return message;
  return "";
}

export async function sendOtpSms({
  phone,
  otp,
  apiKey,
}: {
  phone: string;
  otp: string;
  apiKey: string;
}) {
  if (!apiKey) {
    throw new SmsError("Fast2SMS API key is not configured.", 503);
  }

  const numbers = normalizeIndianPhone(phone);
  if (numbers.length !== 10) {
    throw new SmsError("Enter a valid 10-digit Indian mobile number.", 400);
  }

  const route = (process.env.FAST2SMS_ROUTE || "otp").trim();
  let body: Record<string, unknown>;

  if (route === "otp") {
    body = {
      route: "otp",
      variables_values: otp,
      numbers,
      flash: 0,
    };
  } else {
    const templateId = (process.env.FAST2SMS_TEMPLATE_ID || "").trim();
    const message = (process.env.FAST2SMS_MESSAGE || "").trim();
    if (!templateId || !message) {
      throw new SmsError(
        "Fast2SMS_ROUTE is not 'otp', but FAST2SMS_TEMPLATE_ID / FAST2SMS_MESSAGE are missing.",
        503
      );
    }
    body = {
      route: "q",
      sender_id: (process.env.FAST2SMS_SENDER_ID || "").trim() || undefined,
      message,
      variables_values: otp,
      flash: 0,
      numbers,
    };
  }

  let response: Response;
  try {
    response = await fetch(FAST2SMS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
        "cache-control": "no-cache",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new SmsError("Fast2SMS did not respond in time. Please try again.");
    }
    throw new SmsError("Could not reach Fast2SMS. Check the server's network access.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.return !== true) {
    const detail = readMessage(payload);
    if (response.status === 401 || response.status === 403) {
      throw new SmsError(detail || "Fast2SMS rejected the API key. Please check the key.", 401);
    }
    throw new SmsError(
      detail || `Fast2SMS rejected the message (HTTP ${response.status}).`,
      502
    );
  }

  return {
    requestId: (payload?.request_id as string | undefined) ?? null,
    numbers,
  };
}

/** Masks an API key so it can be shown back to the admin without exposing it. */
export function maskApiKey(key: string | null | undefined) {
  if (!key) return null;
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}
