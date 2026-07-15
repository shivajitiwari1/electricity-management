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
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Oasis Venetia Heights — Electricity Bill</h2>
      <p>Dear ${residentName},</p>
      <p>Your electricity bill for <strong>Flat ${flatNo}</strong> has been generated.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Bill Number</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${billNumber}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Billing Period</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${billingPeriod}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Amount Due</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">₹${totalAmount}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Due Date</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${dueDate}</td></tr>
      </table>
      <a href="${payUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Pay Now via Razorpay</a>
      <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">Oasis Buildmart India Pvt. Ltd., Plot No-HRA, 12, A, Site-C, Greater Noida - 201306</p>
    </div>
  `;
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
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Payment Successful — Oasis Venetia Heights</h2>
      <p>Dear ${residentName},</p>
      <p>Your payment for <strong>Flat ${flatNo}</strong> has been received. Thank you!</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Receipt Number</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${receiptNumber}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Amount Paid</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">₹${amount}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Payment Date</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${paymentDate}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Transaction ID</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${razorpayPaymentId}</td></tr>
      </table>
      <a href="${receiptUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Download Receipt PDF</a>
      <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">Oasis Buildmart India Pvt. Ltd., Plot No-HRA, 12, A, Site-C, Greater Noida - 201306</p>
    </div>
  `;
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
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Overdue Notice — Oasis Venetia Heights</h2>
      <p>Dear ${residentName},</p>
      <p>Your electricity bill for <strong>Flat ${flatNo}</strong> is overdue. Please pay immediately to avoid disconnection.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Bill Number</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${billNumber}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Amount Due</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">₹${totalAmount}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Due Date</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${dueDate}</td></tr>
      </table>
      <p><strong>Note:</strong> Disconnection may occur without further notice. Reconnection fee: ₹500 + 24% p.a. interest.</p>
      <a href="${payUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Pay Now via Razorpay</a>
      <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">Oasis Buildmart India Pvt. Ltd., Plot No-HRA, 12, A, Site-C, Greater Noida - 201306</p>
    </div>
  `;
}
