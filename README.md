# ChickenAndy — Live Streamer Directory

A Next.js + Tailwind clone of [chickenandy.vercel.app](https://chickenandy.vercel.app/):
a live directory for **113 Kick streamers** (the RV crew, their friends, and the
wider IRL/Just-Chatting scene) — watchable in one place with live viewer counts,
previews, an embedded player, and real-time chat.

> Fan-built directory. It has no backend and hosts no content of its own — every
> stream, chat and profile is embedded live from **Kick's own public endpoints**
> in your browser. No scraping, no rate-limit evasion, no age-gate bypass.

## Features

- **Live directory** of 113 Kick channels, hydrated live from `kick.com/api/v2`
  (bio, avatar, viewers, category, 18+/verified flags, socials) with graceful
  fallbacks — dead channels show name-only, hotlink-blocked thumbnails fall back
  to avatars.
- **Featured player** — official `player.kick.com/{user}` embed with autoplay and
  fullscreen. Kick's native mature-content gate is preserved intact.
- **Live chat** — connects to Kick's public chat websocket (Pusher) and renders
  messages, colors, emotes and badges in real time, with a fallback to the
  official popout chat iframe.
- **18+ handling** — a site-level age-confirmation gate on entry *in addition to*
  Kick's own per-stream gate. Nothing is bypassed.
- **RV X route map** — MapLibre GL map (dark / satellite / 3D) of the 2026 Gulf
  Run (Austin → New Orleans → Tampa → Orlando) with a driven RV marker, ported
  from the original site. Free/keyless tile sources.
- **UI/UX** — responsive grids, skeleton loading, filter/sort transitions,
  favourites (localStorage), dark theme (Lexend + Oxanium, gold accent).

## Data source

The roster in [`src/lib/streamers.ts`](src/lib/streamers.ts) was extracted from the
live directory. Everything dynamic (live status, viewers, avatars, categories,
chat) hydrates client-side from Kick's public endpoints — the same way kick.com's
own web client does — so there is no server, no API key, and no cache to stale.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · MapLibre GL JS · TypeScript

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

## Deploy

Static-friendly; deploys to Vercel with zero config. Import the repo at
[vercel.com/new](https://vercel.com/new) or run `vercel --prod`. No environment
variables are required (map + Kick sources are all public and keyless).
