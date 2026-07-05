import Link from "next/link";
import SubmitForm from "@/components/forum/SubmitForm";

export const metadata = { title: "Create post — ChickenAndy" };

export default function SubmitPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          ← Community
        </Link>
        <h1 className="mt-3 text-2xl font-black">Create a post</h1>
        <div className="mt-5">
          <SubmitForm />
        </div>
      </div>
    </div>
  );
}
