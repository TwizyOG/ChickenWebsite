"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ca-favs-v1";
const EVT = "ca-favs-changed";

function read(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
}

export function useFavourites() {
  const [favs, setFavs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFavs(read());
    const on = () => setFavs(read());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const s = read();
    if (s.has(slug)) s.delete(slug);
    else s.add(slug);
    try {
      localStorage.setItem(KEY, JSON.stringify([...s]));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVT));
  }, []);

  return { favs, toggle, isFav: (slug: string) => favs.has(slug) };
}
