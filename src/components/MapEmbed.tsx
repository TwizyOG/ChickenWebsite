"use client";

import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-full min-h-[420px] w-full rounded-2xl" />,
});

export default function MapEmbed() {
  return <RouteMap />;
}
