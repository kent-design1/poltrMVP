"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, Suspense } from "react";
import { initiateEidVerification } from "@/lib/agent";
import { useAppPassword } from "@/lib/useAppPassword";

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
      <code className="bg-white px-2 py-1 rounded font-mono flex-1">
        {value}
      </code>
      <button
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
        className="bg-transparent border-none cursor-pointer p-1 text-base leading-none shrink-0"
        style={{ opacity: copied ? 1 : 0.6 }}
      >
        {copied ? "\u2705" : "\uD83D\uDCCB"}
      </button>
    </p>
  );
}

function HomeContent() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    appPassword,
    loading: appPasswordLoading,
    error: appPasswordError,
    handleCreateAppPassword,
  } = useAppPassword();
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Check for verification callback params
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
      <div className="flex items-center justify-center min-h-screen font-sans">
        Restoring session...
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

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
    <div className="flex flex-col items-center justify-center min-h-screen p-5">
      <h1>Hello {user.displayName}! You did it.</h1>
      <div className="mt-5 p-5 bg-gray-100 rounded-lg text-center">
        <p>
          <strong>DID:</strong> {user.did}
        </p>
        <p>
          <strong>Handle:</strong> {user.handle}
        </p>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => router.push("/ballots")}
          className="px-6 py-3 text-base bg-blue-500 text-white border-none rounded cursor-pointer"
        >
          View Proposals
        </button>

        {process.env.NEXT_PUBLIC_EID_VERIFICATION_ENABLED === "true" && (
          <button
            onClick={handleStartVerification}
            disabled={verificationLoading}
            className="px-6 py-3 text-base bg-blue-500 text-white border-none rounded"
            style={{
              cursor: verificationLoading ? "not-allowed" : "pointer",
              opacity: verificationLoading ? 0.7 : 1,
            }}
          >
            {verificationLoading ? "Starting..." : "swiyu-Verification"}
          </button>
        )}

        {process.env.NEXT_PUBLIC_APP_PASSWORD_ENABLED === "true" && (
          <button
            onClick={handleCreateAppPassword}
            disabled={appPasswordLoading}
            className="px-6 py-3 text-base bg-blue-500 text-white border-none rounded"
            style={{
              cursor: appPasswordLoading ? "not-allowed" : "pointer",
              opacity: appPasswordLoading ? 0.7 : 1,
            }}
          >
            {appPasswordLoading ? "Creating..." : "Create App Password"}
          </button>
        )}

        <button
          onClick={handleLogout}
          className="px-6 py-3 text-base bg-red-500 text-white border-none rounded cursor-pointer"
        >
          Logout
        </button>
      </div>

      {process.env.NEXT_PUBLIC_EID_VERIFICATION_ENABLED === "true" &&
        verificationSuccess && (
          <div className="mt-5 p-4 bg-green-50 border border-green-500 rounded-lg text-green-800 max-w-sm text-center">
            E-ID verification successful! Your account is now verified.
          </div>
        )}

      {process.env.NEXT_PUBLIC_EID_VERIFICATION_ENABLED === "true" &&
        verificationError && (
          <div className="mt-5 p-4 bg-red-50 border border-red-400 rounded-lg text-red-800 max-w-sm text-center">
            {verificationError}
          </div>
        )}

      {process.env.NEXT_PUBLIC_APP_PASSWORD_ENABLED === "true" &&
        appPasswordError && (
          <div className="mt-5 p-4 bg-red-50 border border-red-400 rounded-lg text-red-800 max-w-sm text-center">
            {appPasswordError}
          </div>
        )}

      {process.env.NEXT_PUBLIC_APP_PASSWORD_ENABLED === "true" &&
        appPassword && (
          <div className="mt-5 p-5 bg-green-50 border border-green-500 rounded-lg max-w-sm">
            <h3 className="m-0 mb-3 text-green-800">
              App Password Created!
            </h3>
            <CopyField
              label="PDS"
              value={
                process.env.NEXT_PUBLIC_PDS_URL || "https://pds2.poltr.info"
              }
            />
            <CopyField label="Handle" value={user.handle} />
            <CopyField label="Password" value={appPassword.password} breakAll />
          </div>
        )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen font-sans">
          Loading...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
