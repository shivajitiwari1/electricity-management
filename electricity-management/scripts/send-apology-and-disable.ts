/**
 * One-time script:
 * 1. Sends an apology email to every resident (about the accidental bill email)
 * 2. Appends _test to every resident's email so future sends can't reach real inboxes
 *
 * Run from electricity-management directory:
 *   npx tsx scripts/send-apology-and-disable.ts
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

function createPrismaAdapter() {
  const url = process.env.DATABASE_URL ?? "";
  const parsed = new URL(url);
  const useSSL = process.env.DATABASE_SSL === "true" || parsed.hostname !== "localhost";
  return new PrismaMariaDb({
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: parsed.username || "root",
    password: parsed.password || undefined,
    database: parsed.pathname.slice(1).split("?")[0] || undefined,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
    connectTimeout: 30000,
  });
}

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function apologyHtml(name: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apology — Please Ignore Previous Email</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
                OASIS VENETIA HEIGHTS
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#93b8d4;">
                Oasis Buildmart India Pvt. Ltd.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;">
                Dear <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                We sincerely apologise for the previous email you may have received from us regarding a bill notification.
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                That email was sent in error due to a <strong>system fault</strong> during a routine test of our notification system.
                <strong>Please kindly ignore that email.</strong>
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                We apologise for any confusion or inconvenience this may have caused.
                Our team has resolved the issue and ensured it will not happen again.
              </p>
              <p style="margin:0 0 0;font-size:15px;color:#374151;line-height:1.6;">
                Thank you for your understanding and patience.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Oasis Venetia Heights Management &nbsp;|&nbsp; Greater Noida – 201306 (UP)<br />
                Phone: 8588805052
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

async function main() {
  const residents = await prisma.user.findMany({
    where: { role: "RESIDENT" },
    select: { id: true, name: true, email: true },
  });

  console.log(`\nFound ${residents.length} resident(s).\n`);

  // --- Step 1: Send apology emails ---
  for (const r of residents) {
    process.stdout.write(`Sending apology to ${r.name} <${r.email}> ... `);
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "Oasis Venetia Heights <ovhemaintenance@gmail.com>",
        to: r.email,
        subject: "Apology — Please Ignore Our Previous Email | Oasis Venetia Heights",
        html: apologyHtml(r.name ?? "Resident"),
      });
      console.log("✓ sent");
    } catch (err: any) {
      console.log(`✗ FAILED: ${err.message}`);
    }
  }

  console.log("\n--- Apology emails done. Now appending _test to all resident emails... ---\n");

  // --- Step 2: Append _test to each email so future sends go nowhere ---
  for (const r of residents) {
    const newEmail = `${r.email}_test`;
    await prisma.user.update({ where: { id: r.id }, data: { email: newEmail } });
    console.log(`  ${r.email}  →  ${newEmail}`);
  }

  console.log("\nDone. All resident emails now have _test suffix.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
