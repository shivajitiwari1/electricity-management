export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { guardPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import TenantVerificationSettings from "@/components/admin/tenant-verification-settings";
import { getVerificationSettings, type VerificationSettings } from "@/lib/tenant-verification-config";
import { maskApiKey } from "@/lib/sms";

export default async function TenantVerificationSettingsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;
  if (role !== "ADMIN") {
    redirect("/admin/dashboard");
  }

  const guard = await guardPermission(
    session as any,
    "tenant-verification",
    "canRead"
  );
  if (guard) {
    redirect("/admin/dashboard");
  }

  let verification: VerificationSettings | null = null;
  try {
    verification = await getVerificationSettings();
  } catch {
    verification = null;
  }

  const keySource: "database" | "environment" | null = !verification?.fast2smsApiKey
    ? null
    : process.env.FAST2SMS_API_KEY === verification.fast2smsApiKey
      ? "environment"
      : "database";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contact Verification Settings</h1>
        <p className="text-muted-foreground">
          Choose how tenants verify their contact details before submitting a tenant
          verification application.
        </p>
      </div>

      <TenantVerificationSettings
        initialMethod={verification?.method ?? "PHONE"}
        initialKeyMasked={maskApiKey(verification?.fast2smsApiKey)}
        initialKeySource={keySource}
        initialSmsReady={verification?.smsReady ?? false}
        initialEmailReady={verification?.emailReady ?? false}
        initialSmsConfigured={verification?.smsConfigured ?? false}
        initialEmailConfigured={verification?.emailConfigured ?? false}
        canManage={true}
      />
    </div>
  );
}
