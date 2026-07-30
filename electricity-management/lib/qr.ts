import QRCode from "qrcode";

const UPI_ID = "oasis88268343@barodampay";
const PAYEE_NAME = "OASIS BUILDMART INDIA PVT LTD";

export async function generateUpiQrDataUrl(amount?: number): Promise<string> {
  let upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(PAYEE_NAME)}&cu=INR`;
  if (amount) upiLink += `&am=${amount.toFixed(2)}`;
  return QRCode.toDataURL(upiLink, {
    width: 250,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
