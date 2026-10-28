# Repository instructions

Read [`PROJECT.md`](./PROJECT.md) before making changes. It records the architecture, implemented modules, billing rules, known issues, and the maintenance workflow.

Critical rules:

- The Next.js app lives in `electricity-management/`. The repository root is a deployment wrapper.
- Next.js 16 is in use. Read the relevant docs under `electricity-management/node_modules/next/dist/docs/` before using Next.js APIs.
- Never run `electricity-management/prisma/seed.ts` against production. It deletes all business data.
- Electricity bills have no GST.
- `MaintenanceBill.amount` is GST-inclusive. Never add GST again when displaying, paying, emailing, or rendering it.
- The UI uses manual UPI/NEFT payments. Razorpay code exists but is not wired into the UI.
- Only `/api/cron/overdue-notices` is scheduled in Vercel. The other cron routes need scheduling.
- Do not commit, push, deploy, or run a schema migration without explicit approval.
- Verify changes with `npm run build` and `npx tsc --noEmit` inside `electricity-management/`.
- `npm run lint` has a known noisy baseline; do not assume existing failures were introduced by your change.
- Do not add credentials, customer data, database dumps, or secrets to repository files.
