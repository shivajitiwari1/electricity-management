import { sendEmail } from "@/lib/email";

const BRAND_COLOR = "#1e3a5f";
const ACCENT_COLOR = "#2563eb";
const COMPANY = "Oasis Venetia Heights";
const ADDRESS =
  "Oasis Buildmart India Pvt. Ltd., Plot No-HRA, 12, A, Site-C, Greater Noida - 201306";

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${COMPANY}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${BRAND_COLOR};padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.3px;">${COMPANY}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#93c5fd;">Tenant Verification</p>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">${ADDRESS}</p>
            <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">This is an automated email. Please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOtpEmail({ otp, name, ttlMinutes }: { otp: string; name?: string; ttlMinutes: number }) {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const body = `
    <tr>
      <td style="padding:28px 32px;">
        <p style="margin:0 0 12px;font-size:15px;color:#111827;">${greeting}</p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
          Use the verification code below to confirm your email address for the tenant
          verification application.
        </p>
        <div style="text-align:center;margin:0 0 20px;">
          <span style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 28px;font-size:30px;font-weight:bold;letter-spacing:8px;color:${ACCENT_COLOR};">${otp}</span>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
          This code expires in ${ttlMinutes} minutes and can be used only once.
        </p>
        <p style="margin:0;font-size:13px;color:#6b7280;">
          If you did not request this code, you can ignore this email.
        </p>
      </td>
    </tr>`;
  return shell(body);
}

export async function sendOtpEmail({
  to,
  otp,
  name,
  ttlMinutes,
}: {
  to: string;
  otp: string;
  name?: string;
  ttlMinutes: number;
}) {
  const subject = `Your ${COMPANY} verification code`;
  await sendEmail(to, subject, buildOtpEmail({ otp, name, ttlMinutes }));
}
