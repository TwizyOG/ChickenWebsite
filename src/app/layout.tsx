import type { Metadata } from "next";
import { Lexend, Oxanium } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import { KickProvider } from "@/components/KickProvider";

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
    "The ultimate community hub for streamers and gaming enthusiasts. Watch 100+ Kick streamers live, all in one place.",
  openGraph: {
    title: "ChickenAndy — Live Streamer Directory",
    description:
      "The ultimate community hub for streamers and gaming enthusiasts.",
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
        <AgeGate />
        <KickProvider>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </KickProvider>
      </body>
    </html>
  );
}
