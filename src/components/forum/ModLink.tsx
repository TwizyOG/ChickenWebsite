"use client";

import Link from "next/link";
import { useMe } from "@/components/forum/useMe";

/** "Mod tools" link — rendered only for moderators/admins. */
export default function ModLink() {
  const me = useMe();
  if (!me || "signedOut" in me || me.profile.role === "user") return null;
  return (
    <Link
      href="/community/mod"
      className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-bold text-neutral-300 transition-colors hover:border-neutral-500"
    >
      Mod tools
    </Link>
  );
}
