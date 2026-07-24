import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (process.env.DISABLE_EMAILS === "true") return;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Oasis Venetia Heights <noreply@oasis.local>",
    to,
    subject,
    html,
  });
}
