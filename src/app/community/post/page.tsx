import { Suspense } from "react";
import Link from "next/link";
import PostView from "@/components/forum/PostView";

export const metadata = { title: "Post — ChickenAndy Community" };

export default function PostPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          ← Community
        </Link>
        <div className="mt-3">
          <Suspense fallback={null}>
            <PostView />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
