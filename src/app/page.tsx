import { Suspense } from "react";
import HomeView from "@/components/HomeView";

export default function Home() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-dim">Loading…</div>}>
      <HomeView />
    </Suspense>
  );
}
