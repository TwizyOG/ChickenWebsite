import Link from "next/link";
import ModTools from "@/components/forum/ModTools";

export const metadata = { title: "Mod tools — ChickenAndy Community" };

export default function ModPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          ← Community
        </Link>
        <h1 className="mt-3 text-2xl font-black">Mod tools</h1>
        <div className="mt-5">
          <ModTools />
        </div>
      </div>
    </div>
  );
}
