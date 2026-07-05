import Link from "next/link";
import Logo from "./Logo";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Navigation",
    links: [
      { label: "Home", href: "/" },
      { label: "Streamers", href: "/streamers" },
      { label: "Community", href: "/community" },
      { label: "Store", href: "/store" },
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "My account", href: "/account" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-bg">
      <div className="grid grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-12 xl:px-16">
        <div className="col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-neutral-500">
            The ultimate community hub for streamers and gaming enthusiasts.
          </p>
        </div>

        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-300">
              {c.title}
            </h4>
            <ul className="space-y-2 text-sm text-neutral-500">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-300">
            Contact
          </h4>
          <ul className="space-y-2 text-sm text-neutral-500">
            <li>
              <a
                href="mailto:hello@chickenandy.net"
                className="transition hover:text-accent"
              >
                hello@chickenandy.net
              </a>
            </li>
            <li>
              <a
                href="mailto:hello@chickenandy.net?subject=Business%20Inquiry"
                className="transition hover:text-accent"
              >
                Business Inquiries
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-1 border-t border-line py-5 text-center text-xs">
        <p className="text-neutral-600">© 2026 ChickenAndy. All rights reserved.</p>
        <p className="text-neutral-500">
          Created with love by{" "}
          <a
            href="https://digitalheroesco.com/"
            className="text-neutral-400 underline-offset-2 transition hover:text-accent hover:underline"
          >
            Digital Heroes
          </a>
        </p>
      </div>
    </footer>
  );
}
