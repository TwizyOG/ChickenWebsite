import { Suspense } from "react";
import StreamersView from "@/components/StreamersView";

export const metadata = {
  title: "Streamers — ChickenAndy Directory",
};

export default function StreamersPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-dim">Loading directory…</div>}>
      <StreamersView />
    </Suspense>
  );
}
