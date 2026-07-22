# Legal Pages (About Us + Terms & Conditions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create public `/legal/about` and `/legal/terms` pages with a shared branded layout, satisfying Razorpay merchant account activation requirements.

**Architecture:** Three new files under `app/legal/` — a shared layout with header/footer, an About Us page, and a Terms & Conditions page. All fully static. Middleware already excludes `/legal/*` from its matcher so no auth changes are needed.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, Geist font (already loaded by root layout)

## Global Constraints

- URLs must be exactly `/legal/about` and `/legal/terms` on `https://oasisvenetia.in`
- Pages must be publicly accessible with no authentication — do NOT add `/legal` to `middleware.ts` matcher
- Both pages must export `export const dynamic = "force-static"`
- Do NOT import fonts — Geist Sans is already loaded by `app/layout.tsx`
- Tailwind CSS only — no new CSS files, no new npm packages
- Company name: **Oasis Group of Companies**
- Company address: **A-77, Sector 2, Noida**
- Company phone: **+91-8010-111-777**
- Company email: **info@oasis.in**
- Company website: **https://www.oasis.in/**
- RERA number: **UPRERAPRJ1646**
- Production domain: **https://oasisvenetia.in**
- Last updated date (hardcoded): **22 July 2026**

---

## File Structure

| File | Action |
|------|--------|
| `app/legal/layout.tsx` | Create — shared header + footer shell |
| `app/legal/about/page.tsx` | Create — About Us content |
| `app/legal/terms/page.tsx` | Create — Terms & Conditions content |

No existing files are modified.

---

### Task 1: Shared Layout + About Us Page

**Files:**
- Create: `app/legal/layout.tsx`
- Create: `app/legal/about/page.tsx`

**Interfaces:**
- Produces: `LegalLayout` default export (wraps `children: React.ReactNode`), used automatically by Next.js for all routes under `app/legal/`
- Produces: `AboutPage` default export at `/legal/about`

- [ ] **Step 1: Create the shared layout**

Create `app/legal/layout.tsx` with this exact content:

```tsx
import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 text-lg">Oasis Venetia Heights</p>
            <p className="text-xs text-gray-500">Electricity Management Portal</p>
          </div>
          <nav className="flex gap-6 text-sm">
            <Link href="/legal/about" className="text-gray-600 hover:text-gray-900 transition-colors">
              About Us
            </Link>
            <Link href="/legal/terms" className="text-gray-600 hover:text-gray-900 transition-colors">
              Terms &amp; Conditions
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-10">
          {children}
        </div>
      </main>

      <footer className="bg-gray-50 border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-900 mb-1">© 2025 Oasis Group of Companies</p>
              <p>All rights reserved.</p>
            </div>
            <div className="text-center">
              <p>A-77, Sector 2, Noida</p>
              <p>+91-8010-111-777</p>
              <p>
                <a href="mailto:info@oasis.in" className="hover:underline">
                  info@oasis.in
                </a>
              </p>
            </div>
            <div className="md:text-right space-y-1">
              <p>
                <Link href="/login" className="hover:underline">
                  Resident Portal
                </Link>
              </p>
              <p>
                <a
                  href="https://www.oasis.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Oasis Group Website
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Create the About Us page**

Create `app/legal/about/page.tsx` with this exact content:

```tsx
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About Us – Oasis Venetia Heights",
  description: "About Oasis Venetia Heights and the electricity management portal",
};

export default function AboutPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          About Oasis Venetia Heights
        </h1>
        <p className="text-lg text-gray-600">
          A residential community in Greater Noida, managed by Oasis Group of Companies
        </p>
      </div>

      {/* About the Project */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">About the Project</h2>
        <p className="text-gray-700 leading-relaxed">
          Oasis Venetia Heights offers 1, 2 &amp; 3 BHK ready-to-move homes in the heart of
          Greater Noida, with 350+ families currently residing. The project is registered under
          the Real Estate (Regulation and Development) Act, 2016.
        </p>
        <p className="text-sm text-gray-500 mt-2">RERA Registration: UPRERAPRJ1646</p>
      </section>

      {/* About This Portal */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">About This Portal</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          The Oasis Venetia Heights Electricity Management Portal enables residents to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          <li>View their monthly electricity bills</li>
          <li>Make secure online payments via Razorpay</li>
          <li>Track payment history</li>
        </ul>
        <p className="text-gray-700 mt-3">
          This portal is operated by Oasis Group of Companies on behalf of Oasis Venetia Heights
          residents.
        </p>
      </section>

      {/* About Oasis Group */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">About Oasis Group</h2>
        <p className="text-gray-700 leading-relaxed">
          Oasis Group of Companies —{" "}
          <em>Spaces for Life</em> — is a real estate developer with over 25 years of experience.
          We have delivered more than 2.2 million sq ft of residential spaces across projects
          including Oasis Venetia Heights, Oasis Homes, and Oasis Grandstand.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Information</h2>
        <div className="space-y-1 text-gray-700">
          <p>A-77, Sector 2, Noida</p>
          <p>+91-8010-111-777</p>
          <p>
            <a href="mailto:info@oasis.in" className="text-blue-600 hover:underline">
              info@oasis.in
            </a>
          </p>
          <p>
            <a
              href="https://www.oasis.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              www.oasis.in
            </a>
          </p>
        </div>
      </section>

      {/* Payment Partner */}
      <section className="bg-gray-50 rounded-lg p-4 border">
        <p className="text-gray-700 text-sm">
          Online payments on this portal are processed securely by{" "}
          <strong>Razorpay Payment Gateway</strong>.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript is clean**

Run: `npx tsc --noEmit`

Expected output: no errors (empty output, exit code 0)

- [ ] **Step 4: Verify build succeeds**

Run: `npx next build 2>&1 | tail -15`

Expected: build completes successfully, both `/legal/about` and `/legal/terms` appear as `○ (Static)` routes in the output

- [ ] **Step 5: Commit**

```bash
git add app/legal/layout.tsx app/legal/about/page.tsx
git commit -m "feat: add public legal layout and About Us page"
```

---

### Task 2: Terms & Conditions Page

**Files:**
- Create: `app/legal/terms/page.tsx`

**Interfaces:**
- Consumes: `LegalLayout` from Task 1 (applied automatically by Next.js — no import needed)
- Produces: `TermsPage` default export at `/legal/terms`

- [ ] **Step 1: Create the Terms & Conditions page**

Create `app/legal/terms/page.tsx` with this exact content:

```tsx
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms & Conditions – Oasis Venetia Heights",
  description:
    "Terms and conditions for using the Oasis Venetia Heights electricity management portal",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-500">Last updated: 22 July 2026</p>
      </div>

      <Section title="1. Introduction">
        <p>
          These terms govern use of the Oasis Venetia Heights Electricity Management Portal
          accessible at{" "}
          <a href="https://oasisvenetia.in" className="text-blue-600 hover:underline">
            https://oasisvenetia.in
          </a>
          . By using this portal, you agree to these terms.
        </p>
        <p>Operated by: Oasis Group of Companies, A-77, Sector 2, Noida.</p>
      </Section>

      <Section title="2. Services">
        <p>
          The portal allows residents to view electricity consumption bills and make online
          payments. Bills are generated by Oasis Group of Companies based on meter readings
          recorded by authorised staff. Access is limited to registered residents of Oasis
          Venetia Heights.
        </p>
      </Section>

      <Section title="3. Payment Terms">
        <ul className="list-disc pl-6 space-y-1">
          <li>Payments are processed via Razorpay Payment Gateway.</li>
          <li>
            Accepted payment methods: UPI, credit cards, debit cards, net banking.
          </li>
          <li>
            The amount displayed at checkout is the final payable amount, inclusive of all
            applicable charges.
          </li>
          <li>
            Payments are credited to your account upon successful confirmation from Razorpay.
          </li>
        </ul>
      </Section>

      <Section title="4. Refund & Cancellation Policy">
        <ul className="list-disc pl-6 space-y-1">
          <li>Payments once successfully processed are non-refundable.</li>
          <li>
            If a payment is deducted but your bill status does not update within 24 hours,
            contact us at{" "}
            <a href="mailto:info@oasis.in" className="text-blue-600 hover:underline">
              info@oasis.in
            </a>{" "}
            with your transaction ID.
          </li>
          <li>
            Duplicate or excess payments, if verified, will be adjusted against the next
            billing cycle.
          </li>
          <li>Cancellation of a payment once initiated is not possible.</li>
        </ul>
      </Section>

      <Section title="5. Billing Disputes">
        <p>
          Disputes regarding bill amounts must be raised within 30 days of the bill date by
          contacting{" "}
          <a href="mailto:info@oasis.in" className="text-blue-600 hover:underline">
            info@oasis.in
          </a>{" "}
          with your flat number and bill number.
        </p>
      </Section>

      <Section title="6. Privacy & Data">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Payment card and UPI details are handled exclusively by Razorpay and are not stored
            on our servers.
          </li>
          <li>
            Personal information (name, flat number, email) is used solely for billing and
            communication purposes.
          </li>
          <li>
            We do not share your data with third parties except as required by law.
          </li>
        </ul>
      </Section>

      <Section title="7. Governing Law">
        <p>
          These terms are governed by the laws of India. Any disputes shall be subject to the
          exclusive jurisdiction of the courts of Noida, Uttar Pradesh.
        </p>
      </Section>

      <Section title="8. Changes to Terms">
        <p>
          Oasis Group of Companies reserves the right to update these terms at any time.
          Continued use of the portal after changes constitutes acceptance of the updated terms.
        </p>
      </Section>

      <Section title="9. Contact Us">
        <div className="space-y-1">
          <p>
            <strong>Oasis Group of Companies</strong>
          </p>
          <p>A-77, Sector 2, Noida</p>
          <p>+91-8010-111-777</p>
          <p>
            <a href="mailto:info@oasis.in" className="text-blue-600 hover:underline">
              info@oasis.in
            </a>
          </p>
          <p>
            <a
              href="https://www.oasis.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              www.oasis.in
            </a>
          </p>
        </div>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript is clean**

Run: `npx tsc --noEmit`

Expected: no output, exit code 0

- [ ] **Step 3: Verify build succeeds and both routes are static**

Run: `npx next build 2>&1 | grep -E "legal|Static|Error"`

Expected output includes:
```
○ /legal/about
○ /legal/terms
```
Both should show `○ (Static)` — not `ƒ (Dynamic)`.

- [ ] **Step 4: Verify pages are not blocked by middleware**

Check `middleware.ts` — the `config.matcher` array must NOT contain `/legal` or `/legal/:path*`. If it does, remove it. Currently the matcher only covers `/admin/:path*`, `/resident/:path*`, `/login`, and specific `/api/` paths — so no change is needed.

- [ ] **Step 5: Commit**

```bash
git add app/legal/terms/page.tsx
git commit -m "feat: add public Terms & Conditions page"
```

- [ ] **Step 6: Deploy and smoke test**

Push to trigger Vercel deploy (or run `vercel --prod --yes` if auto-deploy is not working):

```bash
git push
```

Once deployed, verify both URLs are publicly accessible (open in an incognito window — no login):
- `https://oasisvenetia.in/legal/about` — should show About Us page with header/footer
- `https://oasisvenetia.in/legal/terms` — should show Terms & Conditions with all 9 sections

Check that:
- Header shows "Oasis Venetia Heights" + nav links to both pages
- Footer shows company address, phone, email, and links to Resident Portal + Oasis Group Website
- Nav links between the two pages work correctly
- No login redirect occurs
