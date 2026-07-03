"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* The RV X hub moved from /map to /rvx. This client redirect keeps old /map
   links alive on both hosts — the static GitHub Pages export ignores
   next.config redirects, so a server redirect wouldn't run there. */
export default function MapRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/rvx");
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center text-sm text-faint">
      Redirecting to RV X…
    </div>
  );
}
