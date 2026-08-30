const BRAND_COLOR = "#1e3a5f";
const ACCENT_COLOR = "#2563eb";
const COMPANY = "Oasis Venetia Heights";
const ADDRESS = "Oasis Buildmart India Pvt. Ltd., Plot No-HRA, 12, A, Site-C, Greater Noida - 201306";

function shell(content: string, companyOverride?: string): string {
  const heading = companyOverride ?? COMPANY;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${heading}</title>
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
                  <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.3px;">${heading}</p>
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
        Your electricity bill for <strong>Flat ${flatNo}</strong> has been generated. The bill PDF is attached to this email. Please find the details below and make the payment before the due date.
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

    <!-- Payment Options -->
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Payment Options</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tr>
          <!-- Bank Details -->
          <td style="padding:16px 20px;vertical-align:top;width:60%;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#374151;">Bank Transfer / NEFT / RTGS</p>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;white-space:nowrap;padding-right:12px;">Beneficiary</td><td style="font-size:12px;color:#111827;font-weight:600;">OASIS BUILDMART INDIA PVT LTD</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Bank</td><td style="font-size:12px;color:#111827;">Bank of Baroda</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Account No.</td><td style="font-size:12px;color:#111827;font-weight:600;font-family:monospace;">88340200001343</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">IFSC</td><td style="font-size:12px;color:#111827;font-family:monospace;">BARB0DBGREA</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Branch</td><td style="font-size:12px;color:#111827;">Greater Noida</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">UPI ID</td><td style="font-size:12px;color:#111827;font-family:monospace;">oasis88268343@barodampay</td></tr>
            </table>
          </td>
          <!-- QR Code -->
          <td style="padding:16px 20px;vertical-align:top;text-align:center;border-left:1px solid #e5e7eb;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#374151;">Scan &amp; Pay via UPI</p>
            <img src="cid:upi-qr" alt="UPI QR Code" width="140" height="140" style="display:block;margin:0 auto;border:1px solid #e5e7eb;border-radius:4px;" />
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">PhonePe · Google Pay · Paytm · BHIM</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:24px 32px 32px;" align="center">
      <a href="${payUrl}" style="display:inline-block;background:${ACCENT_COLOR};color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Pay Now Online
      </a>
      <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">The bill PDF (with full details &amp; QR code) is attached to this email.</p>
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
  rebateAmount?: string;
  /** Total payable on the bill. Shown only when a balance remains. */
  billTotal?: string;
  /** Outstanding after this payment. > 0 switches the email to part-payment wording. */
  balanceDue?: string;
}): string {
  const { residentName, flatNo, receiptNumber, amount, paymentDate, razorpayPaymentId, receiptUrl, rebateAmount, billTotal, balanceDue } = params;
  const isPartial = balanceDue != null && Number(balanceDue) > 0;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <!-- Status bar: green when settled, amber when a balance remains -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${isPartial ? "#fffbeb" : "#f0fdf4"};border:1px solid ${isPartial ? "#fcd34d" : "#86efac"};border-radius:6px;padding:16px 20px;margin-bottom:20px;">
        <tr>
          <td width="36">
            <div style="width:32px;height:32px;background:${isPartial ? "#d97706" : "#16a34a"};border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:#fff;">${isPartial ? "!" : "&#10003;"}</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0;font-size:14px;font-weight:bold;color:${isPartial ? "#92400e" : "#15803d"};">${isPartial ? "Part Payment Received" : "Payment Confirmed"}</p>
            <p style="margin:2px 0 0;font-size:12px;color:${isPartial ? "#b45309" : "#16a34a"};">${isPartial ? "A balance is still outstanding on this bill." : "Your payment has been received successfully."}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        ${isPartial
          ? `Thank you for your payment for <strong>Flat ${flatNo}</strong>. This was a part payment &mdash; <strong>Rs. ${balanceDue}</strong> is still outstanding on this bill. Please clear the balance at the earliest to avoid interest.`
          : `Thank you for your payment for <strong>Flat ${flatNo}</strong>. Your account is now up to date.`}
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
    </td></tr>${isPartial ? `

    <!-- Balance Due Banner -->
    <tr><td style="padding:12px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:16px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Balance Due</p>
          <p style="margin:6px 0 0;font-size:28px;font-weight:bold;color:#b45309;">Rs. ${balanceDue}</p>
        </td></tr>
      </table>
    </td></tr>` : ""}

    <!-- Payment Details -->
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Payment Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Receipt Number", receiptNumber)}
        ${row("Flat No", flatNo)}
        ${rebateAmount ? row("Amount Paid (Cash)", "Rs. " + amount) : row("Amount Paid", "Rs. " + amount, true)}
        ${rebateAmount ? row("Rebate / Waiver", "Rs. " + rebateAmount) : ""}
        ${rebateAmount ? row("Total Settled", "Rs. " + (Number(amount) + Number(rebateAmount)).toFixed(2), true) : ""}
        ${row("Payment Date", paymentDate)}
        ${row("Transaction ID", razorpayPaymentId || "—")}${isPartial ? `
        ${billTotal ? row("Bill Total", "Rs. " + billTotal) : ""}
        ${row("Balance Due", "Rs. " + balanceDue, true)}` : ""}
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:28px 32px 20px;" align="center">
      <a href="${receiptUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Download Receipt PDF
      </a>
    </td></tr>

    <!-- Realization note -->
    <tr><td style="padding:0 32px 28px;" align="center">
      <p style="margin:0;font-size:11px;color:#9ca3af;font-style:italic;">Note: Payment is subject to realization.</p>
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
        <strong>Note:</strong> Disconnection may occur without further notice. Reconnection fee: Rs. 500 + 12% p.a. interest on outstanding amount.
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

export function maintenanceOverdueEmail(params: {
  residentName: string;
  flatNo: string;
  billNumber: string;
  billingPeriod: string;
  originalAmount: string;
  interestCharge: string;
  totalDue: string;
  dueDate: string;
  daysOverdue: number;
}): string {
  const { residentName, flatNo, billNumber, billingPeriod, originalAmount, interestCharge, totalDue, dueDate, daysOverdue } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
        <tr>
          <td width="36">
            <div style="width:32px;height:32px;background:#dc2626;border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:#fff;">!</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0;font-size:14px;font-weight:bold;color:#b91c1c;">Maintenance Payment Overdue</p>
            <p style="margin:2px 0 0;font-size:12px;color:#dc2626;">Your maintenance bill is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue. Late interest is accruing.</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        Your maintenance bill for <strong>Flat ${flatNo}</strong> (${billingPeriod}) is now overdue. Please pay at the earliest to stop further interest accrual.
      </p>
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:20px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:1px;">Total Amount Due Now</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#7f1d1d;">Rs. ${totalDue}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#dc2626;">Was due: ${dueDate}</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Bill Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Bill Number", billNumber)}
        ${row("Flat No", flatNo)}
        ${row("Billing Period", billingPeriod)}
        ${row("Original Amount", "Rs. " + originalAmount)}
        ${row("Late Interest (12% p.a.)", "Rs. " + interestCharge)}
        ${row("Total Due Now", "Rs. " + totalDue, true)}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;background:#fef9c3;padding:10px 14px;border-radius:4px;border-left:3px solid #eab308;">
        <strong>Note:</strong> Interest @ 12% per annum continues to accrue daily on the outstanding amount until the bill is paid in full.
      </p>
    </td></tr>

    <tr><td style="padding:28px 32px 32px;" align="center">
      <a href="https://oasisvenetia.in/resident/maintenance" style="display:inline-block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Pay Maintenance Now
      </a>
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
  cgstRate: string;
  sgstRate: string;
  cgst: string;
  sgst: string;
  currentMonthTotal: string;
  previousDue: string;
  interestCharge: string;
  netPayable: string;
  dueDate: string;
  /** Deep link to the resident maintenance pay page. Renders the Pay Now CTA. */
  payUrl?: string;
  /** Set only when the caller attaches a UPI QR PNG with cid "upi-qr", so the
      image is never referenced when there is nothing to resolve it to. */
  hasQrAttachment?: boolean;
}): string {
  const {
    residentName, flatNo, billNumber, billingPeriod, unitArea, ratePerSqFt,
    amount, cgstRate, sgstRate, cgst, sgst, currentMonthTotal,
    previousDue, interestCharge, netPayable, dueDate, payUrl, hasQrAttachment,
  } = params;

  const hasPrevDue = parseFloat(previousDue) > 0;
  const hasInterest = parseFloat(interestCharge) > 0;

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
          <p style="margin:0;font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:1px;">Net Payable Amount</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#1e3a5f;">Rs. ${netPayable}</p>
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
        ${row("Maintenance Charge", "Rs. " + amount)}
        ${row(`CGST @ ${cgstRate}%`, "Rs. " + cgst)}
        ${row(`SGST @ ${sgstRate}%`, "Rs. " + sgst)}
        ${row("Total Current Month Bill", "Rs. " + currentMonthTotal, true)}
        ${hasPrevDue ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#dc2626;">Previous Due</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#dc2626;text-align:right;">Rs. ${previousDue}</td></tr>` : ""}
        ${hasInterest ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#dc2626;">Interest Charge</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#dc2626;text-align:right;">Rs. ${interestCharge}</td></tr>` : ""}
        ${row("Net Payable", "Rs. " + netPayable, true)}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Interest @ 12% p.a. applies after the due date.</p>
    </td></tr>

    <!-- Payment Options -->
    <tr><td style="padding:0 32px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Payment Options</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;vertical-align:top;width:60%;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#374151;">Bank Transfer / NEFT / RTGS</p>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;white-space:nowrap;padding-right:12px;">Beneficiary</td><td style="font-size:12px;color:#111827;font-weight:600;">OASIS BUILDMART INDIA PVT LTD</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Bank</td><td style="font-size:12px;color:#111827;">Bank of Baroda</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Account No.</td><td style="font-size:12px;color:#111827;font-weight:600;font-family:monospace;">88340200001343</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">IFSC</td><td style="font-size:12px;color:#111827;font-family:monospace;">BARB0DBGREA</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Branch</td><td style="font-size:12px;color:#111827;">Greater Noida</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">UPI ID</td><td style="font-size:12px;color:#111827;font-family:monospace;">oasis88268343@barodampay</td></tr>
            </table>
          </td>${hasQrAttachment ? `
          <td style="padding:16px 20px;vertical-align:top;text-align:center;border-left:1px solid #e5e7eb;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#374151;">Scan &amp; Pay via UPI</p>
            <img src="cid:upi-qr" alt="UPI QR Code" width="140" height="140" style="display:block;margin:0 auto;border:1px solid #e5e7eb;border-radius:4px;" />
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">PhonePe &middot; Google Pay &middot; Paytm &middot; BHIM</p>
          </td>` : ""}
        </tr>
      </table>
    </td></tr>${payUrl ? `

    <!-- CTA -->
    <tr><td style="padding:24px 32px 32px;" align="center">
      <a href="${payUrl}" style="display:inline-block;background:${ACCENT_COLOR};color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Pay Maintenance Bill
      </a>
      <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">After paying by UPI or NEFT, share the transaction reference with us so your payment is recorded.</p>
    </td></tr>` : `

    <tr><td style="padding:0 32px 32px;"></td></tr>`}
  `;

  return shell(body, "Oasis Venetia Heights AOA");
}

export function balanceDueEmail(params: {
  residentName: string;
  flatNo: string;
  billNumber: string;
  billingPeriod: string;
  ncplCharge: string;
  dgCharge: string;
  fixedCharge: string;
  previousDues: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  dueDate: string;
  payUrl: string;
}): string {
  const {
    residentName, flatNo, billNumber, billingPeriod,
    ncplCharge, dgCharge, fixedCharge, previousDues,
    totalAmount, paidAmount, balanceDue, dueDate, payUrl,
  } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <!-- Amber notice bar -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
        <tr>
          <td width="36">
            <div style="width:32px;height:32px;background:#f59e0b;border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:#fff;">&#9888;</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0;font-size:14px;font-weight:bold;color:#92400e;">Balance Due Notice</p>
            <p style="margin:2px 0 0;font-size:12px;color:#b45309;">A partial payment was received. Please clear the remaining balance.</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        We have received a partial payment for your electricity bill for <strong>Flat ${flatNo}</strong>.
        Please find the outstanding balance details below and make the remaining payment before the due date.
      </p>
    </td></tr>

    <!-- Balance Due Banner -->
    <tr><td style="padding:24px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:2px solid #f59e0b;border-radius:6px;padding:20px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Balance Due</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#78350f;">Rs. ${balanceDue}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Please pay by: <strong style="color:#dc2626;">${dueDate}</strong></p>
        </td></tr>
      </table>
    </td></tr>

    <!-- Charge Breakdown -->
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Charge Breakdown</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Bill Number", billNumber)}
        ${row("Flat No", flatNo)}
        ${row("Billing Period", billingPeriod)}
        ${row("NPCL Energy Charges", "Rs. " + ncplCharge)}
        ${row("DG Charges", "Rs. " + dgCharge)}
        ${row("Fixed Charges", "Rs. " + fixedCharge)}
        ${row("Previous Dues", "Rs. " + previousDues)}
        ${row("Total Bill Amount", "Rs. " + totalAmount, true)}
        <tr style="background:#f0fdf4;">
          <td style="padding:10px 0;font-size:13px;color:#15803d;font-weight:bold;border-bottom:1px solid #f3f4f6;">Already Paid</td>
          <td style="padding:10px 0;font-size:13px;color:#15803d;font-weight:bold;text-align:right;border-bottom:1px solid #f3f4f6;">- Rs. ${paidAmount}</td>
        </tr>
        <tr style="background:#fffbeb;">
          <td style="padding:10px 0;font-size:14px;color:#92400e;font-weight:bold;border-bottom:1px solid #f3f4f6;">Balance Due</td>
          <td style="padding:10px 0;font-size:14px;color:#92400e;font-weight:bold;text-align:right;border-bottom:1px solid #f3f4f6;">Rs. ${balanceDue}</td>
        </tr>
      </table>
    </td></tr>

    <!-- Payment Options -->
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Payment Options</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;vertical-align:top;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#374151;">Bank Transfer / NEFT / RTGS / UPI</p>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;white-space:nowrap;padding-right:12px;">Beneficiary</td><td style="font-size:12px;color:#111827;font-weight:600;">OASIS BUILDMART INDIA PVT LTD</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Bank</td><td style="font-size:12px;color:#111827;">Bank of Baroda</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Account No.</td><td style="font-size:12px;color:#111827;font-weight:600;font-family:monospace;">88340200001343</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">IFSC</td><td style="font-size:12px;color:#111827;font-family:monospace;">BARB0DBGREA</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Branch</td><td style="font-size:12px;color:#111827;">Greater Noida</td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">UPI ID</td><td style="font-size:12px;color:#111827;font-family:monospace;">oasis88268343@barodampay</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:24px 32px 32px;" align="center">
      <a href="${payUrl}" style="display:inline-block;background:#f59e0b;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
        Pay Balance Now
      </a>
      <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">Please quote your bill number <strong>${billNumber}</strong> when making a bank transfer.</p>
    </td></tr>
  `;

  return shell(body);
}
