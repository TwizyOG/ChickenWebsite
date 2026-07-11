import { Suspense } from "react";
import Link from "next/link";
import ForumFeed from "@/components/forum/ForumFeed";
import ModLink from "@/components/forum/ModLink";

export const metadata = { title: "Community — ChickenAndy" };

export default function CommunityPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Community</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Talk RV life, streams, clips and everything ChickenAndy.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ModLink />
            <Link
              href="/community/submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft active:scale-95"
            >
              Create post
            </Link>
          </div>
        </div>
        <div className="mt-5">
          <Suspense fallback={null}>
            <ForumFeed />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
