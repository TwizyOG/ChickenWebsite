# Forum setup (one-time)

Status when this doc was written: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
and the Kick OAuth vars already exist in Vercel (all environments) and were pulled into
`.env.local`. A fresh `FORUM_SESSION_SECRET` was generated and appended to `.env.local`.

## 1. Remaining Vercel env vars (run from the repo root)

```bash
# a) the session secret that is already in .env.local — pipe the same value to all 3 envs
node -e "const m=require('fs').readFileSync('.env.local','utf8').match(/FORUM_SESSION_SECRET=\"?([0-9a-f]+)/);process.stdout.write(m[1])" | npx vercel env add FORUM_SESSION_SECRET production
node -e "const m=require('fs').readFileSync('.env.local','utf8').match(/FORUM_SESSION_SECRET=\"?([0-9a-f]+)/);process.stdout.write(m[1])" | npx vercel env add FORUM_SESSION_SECRET preview
node -e "const m=require('fs').readFileSync('.env.local','utf8').match(/FORUM_SESSION_SECRET=\"?([0-9a-f]+)/);process.stdout.write(m[1])" | npx vercel env add FORUM_SESSION_SECRET development
```

```bash
# b) the Supabase secret key: dashboard → Project Settings → API keys → "secret" key
#    (starts with sb_secret_). Paste it when prompted:
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
npx vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

```bash
# c) your numeric Kick user id(s), comma separated — these accounts become forum Admin
#    on their next login. (Your id appears in the profiles table after any first login,
#    or via /api/kick/debug while signed in.)
npx vercel env add FORUM_ADMIN_KICK_IDS production
npx vercel env add FORUM_ADMIN_KICK_IDS preview
npx vercel env add FORUM_ADMIN_KICK_IDS development
```

Also add `SUPABASE_SERVICE_ROLE_KEY="sb_secret_…"` and `FORUM_ADMIN_KICK_IDS="…"` lines to
`.env.local` so local dev can write to the DB too. After adding vars, redeploy (or just push —
every push redeploys).

```bash
# d) GIF search in comments (optional — the picker says "not configured" until set).
#    Free key: console.cloud.google.com → enable "Tenor API" → Credentials → API key.
npx vercel env add TENOR_API_KEY production
```

Add `TENOR_API_KEY="…"` to `.env.local` too, then redeploy (any push).

## 2. Database — run the migration

Supabase dashboard → SQL Editor → New query → paste the whole of
`supabase/migrations/0001_forum.sql` → Run. Expected result: "Success. No rows returned".
The file is idempotent (safe to re-run). It creates all forum tables, views, functions,
RLS lockdown, the 7 seed flairs and the public `forum-media` storage bucket.

## 3. GitHub Pages mirror — nothing to do

The workflow already passes the public Supabase vars, so the mirror renders the forum
**read-only** (no OAuth/API routes there by design). Sign-in/submit buttons on the mirror
deep-link to https://chickenwebsite.vercel.app.

## 4. Admin bootstrap check

After (1c) + (2): log in with Kick on the Vercel site once — your `profiles` row gets
`role = 'admin'`. Everyone else defaults to `user`.
