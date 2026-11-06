"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, KeyRound, Mail, MessageSquare, Send } from "lucide-react";

type VerificationMethod = "EMAIL" | "PHONE" | "BOTH";

type Props = {
  initialMethod: VerificationMethod;
  initialKeyMasked: string | null;
  initialKeySource: "database" | "environment" | null;
  initialSmsReady: boolean;
  initialEmailReady: boolean;
  initialSmsConfigured: boolean;
  initialEmailConfigured: boolean;
  canManage: boolean;
};

const METHOD_OPTIONS: Array<{
  value: VerificationMethod;
  title: string;
  description: string;
}> = [
  {
    value: "EMAIL",
    title: "Email only",
    description: "Tenant must verify the email address before submitting.",
  },
  {
    value: "PHONE",
    title: "Phone only",
    description: "Tenant must verify the mobile number by SMS before submitting.",
  },
  {
    value: "BOTH",
    title: "Email + Phone",
    description: "Both must be verified before the application can be submitted.",
  },
];

function channelSummary(method: VerificationMethod, smsReady: boolean, emailReady: boolean) {
  const wantsPhone = method === "PHONE" || method === "BOTH";
  const wantsEmail = method === "EMAIL" || method === "BOTH";
  const active: string[] = [];
  if (wantsPhone && smsReady) active.push("phone");
  if (wantsEmail && emailReady) active.push("email");
  if (active.length === 0) return "No verification is currently required from applicants.";
  return `Applicants must verify: ${active.join(" and ")}.`;
}

function deliveryLine(label: string, configured: boolean, ready: boolean) {
  if (configured) return `${label} delivery is configured.`;
  if (ready) {
    return `No ${label.toLowerCase()} provider is configured — development codes are shown on screen instead.`;
  }
  return `${label} delivery is not configured — ${label.toLowerCase()} verification is inactive.`;
}

export default function TenantVerificationSettings({
  initialMethod,
  initialKeyMasked,
  initialKeySource,
  initialSmsReady,
  initialEmailReady,
  initialSmsConfigured,
  initialEmailConfigured,
  canManage,
}: Props) {
  const [method, setMethod] = useState<VerificationMethod>(initialMethod);
  const [savedMethod, setSavedMethod] = useState<VerificationMethod>(initialMethod);
  const [keyMasked, setKeyMasked] = useState<string | null>(initialKeyMasked);
  const [keySource, setKeySource] = useState(initialKeySource);
  const [smsReady, setSmsReady] = useState(initialSmsReady);
  const [emailReady, setEmailReady] = useState(initialEmailReady);
  const [smsConfigured, setSmsConfigured] = useState(initialSmsConfigured);
  const [emailConfigured, setEmailConfigured] = useState(initialEmailConfigured);
  const [apiKey, setApiKey] = useState("");
  const [savingMethod, setSavingMethod] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  const methodDirty = method !== savedMethod;
  const wantsPhone = method === "PHONE" || method === "BOTH";
  const wantsEmail = method === "EMAIL" || method === "BOTH";

  function applyPayload(data: any) {
    if (data?.tenantVerificationMethod) {
      const next = data.tenantVerificationMethod as VerificationMethod;
      setMethod(next);
      setSavedMethod(next);
    }
    if (data?.fast2smsApiKeyMasked !== undefined) setKeyMasked(data.fast2smsApiKeyMasked);
    if (data?.fast2smsApiKeySource !== undefined) setKeySource(data.fast2smsApiKeySource);
    if (typeof data?.smsReady === "boolean") setSmsReady(data.smsReady);
    if (typeof data?.emailReady === "boolean") setEmailReady(data.emailReady);
    if (typeof data?.smsConfigured === "boolean") setSmsConfigured(data.smsConfigured);
    if (typeof data?.emailConfigured === "boolean") setEmailConfigured(data.emailConfigured);
  }

  async function saveMethod() {
    setSavingMethod(true);
    try {
      const res = await fetch("/api/tenant-verification/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantVerificationMethod: method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not save the verification method");
        return;
      }
      applyPayload(data);
      toast.success("Verification method saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingMethod(false);
    }
  }

  async function saveApiKey(value: string) {
    setSavingKey(true);
    try {
      const res = await fetch("/api/tenant-verification/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fast2smsApiKey: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not save the API key");
        return;
      }
      applyPayload(data);
      setApiKey("");
      toast.success(value ? "Fast2SMS API key saved" : "Fast2SMS API key removed");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingKey(false);
    }
  }

  async function sendTestSms() {
    if (!testPhone.trim()) {
      toast.error("Enter a mobile number to send the test SMS to");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/tenant-verification/config/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not send the test SMS");
        return;
      }
      toast.success(data?.message ?? "Test SMS sent");
    } catch {
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-3">
          <span>Contact Verification</span>
          <Badge variant="secondary" className="gap-1">
            {wantsPhone && smsReady && wantsEmail && emailReady
              ? "EMAIL + PHONE"
              : wantsPhone && smsReady
                ? "PHONE"
                : wantsEmail && emailReady
                  ? "EMAIL"
                  : "OFF"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Choose what a tenant must verify before submitting. Applicants only see the
          verification steps that are selected here and able to deliver a code.
        </p>

        <div className="space-y-3">
          <Label>Verification required from applicants</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {METHOD_OPTIONS.map((option) => {
              const selected = method === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setMethod(option.value)}
                  className={`text-left rounded-lg border-2 p-4 transition-all disabled:opacity-60 ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{option.title}</span>
                    {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={saveMethod}
              disabled={!canManage || !methodDirty || savingMethod}
            >
              {savingMethod ? "Saving..." : "Save method"}
            </Button>
            {!canManage && (
              <span className="text-xs text-muted-foreground">
                Only an admin can change these settings.
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Fast2SMS API key</p>
            {keyMasked ? (
              <Badge variant="secondary" className="gap-1 text-emerald-700">
                <Check className="h-3 w-3" /> Configured
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-amber-700">
                Not set
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Used to deliver the mobile OTP. Phone verification stays inactive until a key is
            saved. Get the key from your Fast2SMS dashboard.
          </p>

          {keySource === "environment" && (
            <p className="text-xs text-muted-foreground">
              Currently using the <code>FAST2SMS_API_KEY</code> environment variable. Saving a key
              here overrides it.
            </p>
          )}

          {keyMasked && (
            <p className="text-xs">
              Saved key: <span className="font-mono">{keyMasked}</span>
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              placeholder={keyMasked ? "Enter a new key to replace it" : "Paste your Fast2SMS API key"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={!canManage}
              className="sm:flex-1"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => saveApiKey(apiKey.trim())}
              disabled={!canManage || savingKey || apiKey.trim().length === 0}
            >
              {savingKey ? "Saving..." : "Save key"}
            </Button>
            {keySource === "database" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => saveApiKey("")}
                disabled={!canManage || savingKey}
              >
                Remove
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Mobile number for the test SMS"
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
              disabled={!canManage}
              className="sm:max-w-[240px]"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={sendTestSms}
              disabled={!canManage || testing || !keyMasked}
            >
              <Send className="h-3.5 w-3.5 mr-2" />
              {testing ? "Sending..." : "Send test SMS"}
            </Button>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <p className="flex items-start gap-2 text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{deliveryLine("SMS", smsConfigured, smsReady)}</span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{deliveryLine("Email", emailConfigured, emailReady)}</span>
          </p>
          {(wantsPhone && !smsReady) || (wantsEmail && !emailReady) ? (
            <p className="flex items-start gap-2 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{channelSummary(method, smsReady, emailReady)}</span>
            </p>
          ) : (
            <p className="flex items-start gap-2 text-muted-foreground">
              <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{channelSummary(method, smsReady, emailReady)}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
