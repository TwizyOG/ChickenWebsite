"use client";

import { usePathname } from "next/navigation";

/* Hides the global header/footer on routes that use their own standalone
   layout, matching chickenandy.vercel.app: the /account section has its own
   sidebar shell and /login is a full-screen split page. */

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/account") || pathname === "/login") return null;
  return <>{children}</>;
}
