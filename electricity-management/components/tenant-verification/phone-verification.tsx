"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Props = {
  phone: string;
};

export default function PhoneVerification({ phone }: Props) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  async function sendOtp() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Enter a valid mobile number in the Primary Occupant step first.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/tenant-verification/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "APPLICATION_REGISTRATION" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not send OTP");

      setOtpSent(true);
      setDevOtp(typeof json?.otp === "string" ? json.otp : null);
      toast.success(`OTP sent to ${phone}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not send OTP");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/tenant-verification/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, purpose: "APPLICATION_REGISTRATION" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Invalid OTP");

      setVerified(true);
      setOtp("");
      setDevOtp(null);
      toast.success("Mobile number verified");
    } catch (err: any) {
      toast.error(err?.message || "Invalid OTP");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Mobile Verification</p>
            {verified && (
              <Badge variant="secondary" className="gap-1 text-emerald-700">
                <Check className="h-3 w-3" /> Verified
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Verify the tenant mobile number{" "}
            <span className="font-medium text-foreground">{phone || "—"}</span> before submitting.
          </p>
        </div>
        {!verified && (
          <Button type="button" variant="outline" size="sm" onClick={sendOtp} disabled={sending}>
            {sending ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
          </Button>
        )}
      </div>

      {otpSent && !verified && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            className="sm:max-w-[220px]"
          />
          <Button type="button" size="sm" onClick={verifyOtp} disabled={verifying || otp.length !== 6}>
            {verifying ? "Verifying..." : "Verify OTP"}
          </Button>
          {devOtp && (
            <span className="text-xs text-amber-600">Development OTP: {devOtp}</span>
          )}
        </div>
      )}

      {verified && (
        <p className="mt-2 text-xs text-emerald-700">
          Mobile number verified. You can submit the application now.
        </p>
      )}
    </div>
  );
}
