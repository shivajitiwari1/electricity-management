const BRAND_COLOR = "#1e3a5f";
const ACCENT_COLOR = "#2563eb";
const COMPANY = "Oasis Venetia Heights";
const ADDRESS = "Oasis Buildmart India Pvt. Ltd., Plot No-HRA, 12, A, Site-C, Greater Noida - 201306";

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
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.3px;">${COMPANY}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#93c5fd;">Electricity Management Portal</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        ${content}
        <!-- Footer -->
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

function row(label: string, value: string, highlight = false): string {
  const bg = highlight ? "#eff6ff" : "transparent";
  const fw = highlight ? "bold" : "normal";
  return `<tr style="background:${bg};">
    <td style="padding:10px 0;font-size:13px;color:#374151;font-weight:${fw};border-bottom:1px solid #f3f4f6;">${label}</td>
    <td style="padding:10px 0;font-size:13px;color:#111827;font-weight:${fw};text-align:right;border-bottom:1px solid #f3f4f6;">${value}</td>
  </tr>`;
}

export function billGeneratedEmail(params: {
  residentName: string;
  flatNo: string;
  billNumber: string;
  billingPeriod: string;
  totalAmount: string;
  dueDate: string;
  payUrl: string;
}): string {
  const { residentName, flatNo, billNumber, billingPeriod, totalAmount, dueDate, payUrl } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        Your electricity bill for <strong>Flat ${flatNo}</strong> has been generated. Please find the details below and make the payment before the due date.
      </p>
    </td></tr>

    <!-- Amount Banner -->
    <tr><td style="padding:24px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:20px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:1px;">Total Amount Due</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#1e3a5f;">Rs. ${totalAmount}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Due by: <strong style="color:#dc2626;">${dueDate}</strong></p>
        </td></tr>
      </table>
    </td></tr>

    <!-- Bill Details -->
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Bill Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Bill Number", billNumber)}
        ${row("Flat No", flatNo)}
        ${row("Billing Period", billingPeriod)}
        ${row("Total Amount Due", "Rs. " + totalAmount, true)}
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:28px 32px 32px;" align="center">
      <a href="${payUrl}" style="display:inline-block;background:${ACCENT_COLOR};color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Pay Now Online
      </a>
      <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">Secured payment · UPI, Net Banking, Cards &amp; Wallets accepted</p>
    </td></tr>
  `;

  return shell(body);
}

export function paymentSuccessEmail(params: {
  residentName: string;
  flatNo: string;
  receiptNumber: string;
  amount: string;
  paymentDate: string;
  razorpayPaymentId: string;
  receiptUrl: string;
}): string {
  const { residentName, flatNo, receiptNumber, amount, paymentDate, razorpayPaymentId, receiptUrl } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <!-- Green success bar -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
        <tr>
          <td width="36">
            <div style="width:32px;height:32px;background:#16a34a;border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:#fff;">&#10003;</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0;font-size:14px;font-weight:bold;color:#15803d;">Payment Confirmed</p>
            <p style="margin:2px 0 0;font-size:12px;color:#16a34a;">Your payment has been received successfully.</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        Thank you for your payment for <strong>Flat ${flatNo}</strong>. Your account is now up to date.
      </p>
    </td></tr>

    <!-- Amount Banner -->
    <tr><td style="padding:20px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:20px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#15803d;text-transform:uppercase;letter-spacing:1px;">Amount Paid</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#14532d;">Rs. ${amount}</p>
        </td></tr>
      </table>
    </td></tr>

    <!-- Payment Details -->
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Payment Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Receipt Number", receiptNumber)}
        ${row("Flat No", flatNo)}
        ${row("Amount Paid", "Rs. " + amount, true)}
        ${row("Payment Date", paymentDate)}
        ${row("Transaction ID", razorpayPaymentId || "—")}
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:28px 32px 32px;" align="center">
      <a href="${receiptUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Download Receipt PDF
      </a>
    </td></tr>
  `;

  return shell(body);
}

export function overdueNoticeEmail(params: {
  residentName: string;
  flatNo: string;
  billNumber: string;
  totalAmount: string;
  dueDate: string;
  payUrl: string;
}): string {
  const { residentName, flatNo, billNumber, totalAmount, dueDate, payUrl } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
        <tr>
          <td width="36">
            <div style="width:32px;height:32px;background:#dc2626;border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:#fff;">!</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0;font-size:14px;font-weight:bold;color:#b91c1c;">Payment Overdue</p>
            <p style="margin:2px 0 0;font-size:12px;color:#dc2626;">Immediate action required to avoid service disruption.</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        Your electricity bill for <strong>Flat ${flatNo}</strong> is overdue. Please make the payment immediately to avoid disconnection.
      </p>
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:20px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:1px;">Overdue Amount</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#7f1d1d;">Rs. ${totalAmount}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#dc2626;">Was due: ${dueDate}</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Bill Number", billNumber)}
        ${row("Flat No", flatNo)}
        ${row("Amount Due", "Rs. " + totalAmount, true)}
        ${row("Due Date", dueDate)}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;background:#fef9c3;padding:10px 14px;border-radius:4px;border-left:3px solid #eab308;">
        <strong>Note:</strong> Disconnection may occur without further notice. Reconnection fee: Rs. 500 + 24% p.a. interest on outstanding amount.
      </p>
    </td></tr>

    <tr><td style="padding:28px 32px 32px;" align="center">
      <a href="${payUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Pay Now — Avoid Disconnection
      </a>
    </td></tr>
  `;

  return shell(body);
}

export function welcomeEmail(params: {
  residentName: string;
  flatNo: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  const { residentName, flatNo, email, password, loginUrl } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        Welcome to <strong>Oasis Venetia Heights</strong> Electricity Management Portal. Your resident account has been created for Flat <strong>${flatNo}</strong>.
      </p>
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:20px;">
        <tr><td>
          <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:1px;">Your Login Credentials</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#374151;width:40%;">Email / Username</td>
              <td style="padding:8px 0;font-size:13px;color:#111827;font-weight:bold;">${email}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#374151;">Temporary Password</td>
              <td style="padding:8px 0;font-size:16px;color:#1e3a5f;font-weight:bold;font-family:monospace;">${password}</td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:16px 32px 0;">
      <p style="margin:0;font-size:12px;color:#6b7280;background:#fef9c3;padding:10px 14px;border-radius:4px;border-left:3px solid #eab308;">
        <strong>Security tip:</strong> Please change your password after your first login using the "Forgot Password" link on the login page.
      </p>
    </td></tr>

    <tr><td style="padding:28px 32px 32px;" align="center">
      <a href="${loginUrl}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Login to Portal
      </a>
    </td></tr>
  `;

  return shell(body);
}

export function passwordResetEmail(params: {
  residentName: string;
  resetUrl: string;
}): string {
  const { residentName, resetUrl } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        We received a request to reset your password. Click the button below to set a new password. This link is valid for <strong>24 hours</strong>.
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:16px 20px;">
        <tr><td>
          <p style="margin:0;font-size:13px;color:#92400e;">
            If you did not request a password reset, you can safely ignore this email. Your password will not change.
          </p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:28px 32px 32px;" align="center">
      <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Reset My Password
      </a>
      <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">Link expires in 24 hours</p>
    </td></tr>
  `;

  return shell(body);
}

export function maintenanceBillGeneratedEmail(params: {
  residentName: string;
  flatNo: string;
  billNumber: string;
  billingPeriod: string;
  unitArea: number;
  ratePerSqFt: string;
  amount: string;
  dueDate: string;
}): string {
  const { residentName, flatNo, billNumber, billingPeriod, unitArea, ratePerSqFt, amount, dueDate } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        Your maintenance bill for <strong>Flat ${flatNo}</strong> has been generated.
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:20px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:1px;">Maintenance Amount Due</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#1e3a5f;">Rs. ${amount}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Due by: <strong style="color:#dc2626;">${dueDate}</strong></p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 32px 32px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Bill Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Bill Number", billNumber)}
        ${row("Flat No", flatNo)}
        ${row("Billing Period", billingPeriod)}
        ${row("Unit Area", `${unitArea} sq ft`)}
        ${row("Rate", `Rs. ${ratePerSqFt} per sq ft`)}
        ${row("Total Amount Due", "Rs. " + amount, true)}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Log in to the resident portal to pay online. Interest @ 24% p.a. applies after the due date.</p>
    </td></tr>
  `;

  return shell(body);
}
