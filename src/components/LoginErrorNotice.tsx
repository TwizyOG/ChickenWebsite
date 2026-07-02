"use client";

import { useSearchParams } from "next/navigation";

const ERRORS: Record<string, string> = {
  invalid_state: "Sign-in expired or was tampered with — please try again.",
  not_configured: "Kick sign-in isn't configured on this deployment yet.",
  no_token: "Kick didn't return a token. Please try again.",
  oauth: "Kick sign-in was cancelled.",
};

export default function LoginErrorNotice() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  const msg = ERRORS[error] ?? `Sign-in failed (${error}).`;
  return (
    <div className="mt-4 rounded-lg border border-mature/40 bg-mature/10 p-3 text-xs text-mature">
      {msg}
    </div>
  );
}
