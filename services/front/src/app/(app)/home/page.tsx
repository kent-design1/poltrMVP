"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, Suspense } from "react";
import { initiateEidVerification } from "@/lib/agent";
import { useAppPassword } from "@/lib/useAppPassword";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/spinner";
import { Copy, Check } from "lucide-react";

function CopyField({
  label,
  value,
  breakAll,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <p
      className="my-2 flex items-center gap-2"
      style={{ wordBreak: breakAll ? "break-all" : undefined }}
    >
      <strong>{label}:</strong>
      <code className="bg-muted px-2 py-1 rounded font-mono flex-1 text-sm">
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
        className="h-8 w-8 shrink-0"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </p>
  );
}

function HomeContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    appPassword,
    loading: appPasswordLoading,
    error: appPasswordError,
    handleCreateAppPassword,
  } = useAppPassword();
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      setVerificationSuccess(true);
    }
    if (searchParams.get("error") === "verification_failed") {
      setVerificationError("E-ID verification failed. Please try again.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3">
        <Spinner />
        <span className="text-muted-foreground">Restoring session...</span>
      </div>
    );
  }

  if (!user) return null;

  const handleStartVerification = async () => {
    setVerificationLoading(true);
    setVerificationError(null);
    try {
      const { redirect_url } = await initiateEidVerification();
      window.location.href = redirect_url;
    } catch (err) {
      setVerificationError(
        err instanceof Error ? err.message : "Failed to start verification",
      );
      setVerificationLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 pt-5">
        <img src="/logo5.svg" alt="Poltr" className="w-40 h-40" />
        <h1 className="text-2xl font-bold tracking-tight">Hello {user.displayName}!</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1 text-sm">
            <p><strong>DID:</strong> <span className="font-mono text-muted-foreground">{user.did}</span></p>
            <p><strong>Handle:</strong> <span className="font-mono text-muted-foreground">{user.handle}</span></p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => router.push("/ballots")}>
          See Ballots
        </Button>

        {process.env.NEXT_PUBLIC_EID_VERIFICATION_ENABLED === "true" && (
          <Button
            variant="secondary"
            onClick={handleStartVerification}
            disabled={verificationLoading}
          >
            {verificationLoading ? "Starting..." : "swiyu-Verification"}
          </Button>
        )}

        {process.env.NEXT_PUBLIC_APP_PASSWORD_ENABLED === "true" && (
          <Button
            variant="secondary"
            onClick={handleCreateAppPassword}
            disabled={appPasswordLoading}
          >
            {appPasswordLoading ? "Creating..." : "Create App Password"}
          </Button>
        )}
      </div>

      {process.env.NEXT_PUBLIC_EID_VERIFICATION_ENABLED === "true" && verificationSuccess && (
        <Alert>
          <AlertDescription>
            E-ID verification successful! Your account is now verified.
          </AlertDescription>
        </Alert>
      )}

      {process.env.NEXT_PUBLIC_EID_VERIFICATION_ENABLED === "true" && verificationError && (
        <Alert variant="destructive">
          <AlertDescription>{verificationError}</AlertDescription>
        </Alert>
      )}

      {process.env.NEXT_PUBLIC_APP_PASSWORD_ENABLED === "true" && appPasswordError && (
        <Alert variant="destructive">
          <AlertDescription>{appPasswordError}</AlertDescription>
        </Alert>
      )}

      {process.env.NEXT_PUBLIC_APP_PASSWORD_ENABLED === "true" && appPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-800">App Password Created!</CardTitle>
          </CardHeader>
          <CardContent>
            <CopyField
              label="PDS"
              value={process.env.NEXT_PUBLIC_PDS_URL || "https://pds2.poltr.info"}
            />
            <CopyField label="Handle" value={user.handle} />
            <CopyField label="Password" value={appPassword.password} breakAll />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Spinner />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
