"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";

const KEY = "ca-age-confirmed-v1";

export default function AgeGate() {
  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(true); // assume ok during SSR to avoid flash

  useEffect(() => {
    setMounted(true);
    try {
      setOk(localStorage.getItem(KEY) === "1");
    } catch {
      setOk(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = ok ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [ok, mounted]);

  if (!mounted || ok) return null;

  const enter = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode — session only */
    }
    setOk(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-bg/95 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto mt-6 grid h-12 w-12 place-items-center rounded-full border border-mature/40 bg-mature/10 text-mature">
          <span className="font-display text-sm font-extrabold">18+</span>
        </div>

        <h2 id="age-gate-title" className="mt-4 font-display text-xl font-extrabold uppercase">
          Mature content ahead
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          This directory embeds live Kick streams, some flagged{" "}
          <span className="font-semibold text-mature">18+</span>. Each stream still shows Kick&apos;s
          own age check inside its player. By entering you confirm you are{" "}
          <span className="font-semibold text-ink">18 years or older</span> and agree to view
          content that may be mature.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={enter}
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft"
          >
            I am 18 or older — Enter
          </button>
          <a
            href="https://www.google.com"
            className="rounded-full border border-line px-5 py-3 text-sm font-medium text-dim transition hover:text-ink"
          >
            Leave
          </a>
        </div>
      </div>
    </div>
  );
}
