import type { Metadata } from "next";
import { Lexend, Oxanium } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SiteChrome from "@/components/SiteChrome";
import { KickProvider } from "@/components/KickProvider";
import { AuthProvider } from "@/components/AuthProvider";
import KickAutoSubscribe from "@/components/KickAutoSubscribe";
import KickSessionKeeper from "@/components/KickSessionKeeper";
import FavoriteLiveWatcher from "@/components/FavoriteLiveWatcher";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
});

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChickenAndy — Live Streamer Directory",
  description:
    "See which ChickenAndy streamers are live right now, ranked by viewers.",
  openGraph: {
    title: "ChickenAndy — Live Streamer Directory",
    description:
      "See which ChickenAndy streamers are live right now, ranked by viewers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${lexend.variable} ${oxanium.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-bg text-ink">
        <AuthProvider>
          <KickProvider>
            <KickSessionKeeper />
            <KickAutoSubscribe />
            <FavoriteLiveWatcher />
            <SiteChrome>
              {/* Top banner (from chickenandy.com). object-cover crops the
                  image's white top/bottom bands so it sits flush. */}
              <div className="w-full overflow-hidden border-b border-line bg-black">
                <img
                  src="/banner.png"
                  alt="ChickenAndy"
                  className="block h-14 w-full scale-[1.35] object-cover object-center sm:h-20 lg:h-28"
                />
              </div>
              <Header />
            </SiteChrome>
            <main className="flex-1 w-full">{children}</main>
            <SiteChrome>
              <Footer />
            </SiteChrome>
          </KickProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
