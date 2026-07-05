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
    <footer className="mt-16 border-t border-line bg-panel/60">
      <div className="grid grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-12 xl:px-16">
        <div className="col-span-2 max-w-xs">
          <Logo />
          <p className="mt-3 text-sm text-dim">
            The ultimate community hub for streamers and gaming enthusiasts.
          </p>
        </div>

        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-faint">
              {c.title}
            </h4>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-dim transition hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="font-display text-xs font-bold uppercase tracking-widest text-faint">
            Contact
          </h4>
          <ul className="mt-3 space-y-2">
            <li>
              <a
                href="mailto:hello@chickenandy.net"
                className="text-sm text-dim transition hover:text-accent"
              >
                hello@chickenandy.net
              </a>
            </li>
            <li>
              <a
                href="mailto:hello@chickenandy.net?subject=Business%20Inquiry"
                className="text-sm text-dim transition hover:text-accent"
              >
                Business Inquiries
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line/60">
        <div className="flex flex-col items-center gap-1 px-4 py-5 text-center text-xs text-faint sm:px-6">
          <p>© 2026 ChickenAndy. All rights reserved.</p>
          <p>
            Created with love by{" "}
            <a
              href="https://digitalheroesco.com/"
              className="text-dim underline-offset-2 transition hover:text-accent hover:underline"
            >
              Digital Heroes
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
