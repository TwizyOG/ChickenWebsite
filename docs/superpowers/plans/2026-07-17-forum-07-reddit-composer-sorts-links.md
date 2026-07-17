# Forum Plan 07 — Reddit-parity composer, comment sorts + search, link-post cards

> **Status: ✅ Shipped & live-verified (2026-07-17).** Commit `938da51`; migration 0007 applied to prod. Gates: `npx vitest run` → 50 passing (14 new), `npm run build` → success, `npm run lint` → only the 12 pre-existing non-forum errors. Live E2E on chickenwebsite.vercel.app (logged in): all 13 toolbar buttons insert correct markdown; a full-format comment rendered every construct; a synthetic drag-drop of a real PNG + GIF uploaded via the ticket flow and rendered inline; all six sorts + comment search exercised; a Wikipedia link post produced the og:image article card in feed + detail. All test content reversed (comments purged, post row + its votes hard-deleted, both storage objects removed via Storage API). Pages mirror renders the new UI read-only.

**Goal:** Bring the comment/reply experience to Reddit parity per the user's five reference screenshots: (1) remove the Tenor GIF picker and instead let users drag (or paste) image/GIF files straight into the text of posts and replies, uploaded to `forum-media` and rendered inline; (2) the full Reddit comment-sort set — Best, Top, New, Controversial, Old, Q&A — behind a "Sort by" dropdown, plus a Search Comments filter; (3) the exact Reddit comment-box chrome (collapsed "Join the conversation" pill → expanded box with footer "Aa" toggle, Cancel/Comment inside, toolbar on top); (4) the 13-button formatting toolbar with "…" overflow; (5) link posts that show the article's og:image thumbnail right of the title with the clickable source URL.

**Recon facts (captured from reddit.com via DOM inspection, 2026-07-17):**
- Collapsed composer = bordered rounded pill, placeholder "Join the conversation"; click expands in place.
- Expanded = ONE rounded container: optional toolbar row on top, textarea, footer row inside (left: "Aa" circular toggle, aria "Show/Hide formatting options", filled style while active; right: Cancel pill + accent Comment pill, Comment disabled when empty).
- Toolbar left→right (aria labels, 32px hit areas on a 36px pitch, dividers after Heading and Number List): Bold, Italic, Strikethrough, Superscript, Heading │ Link, Bullet List, Number List │ Spoiler, Quote Block, Code, Code Block, Table │ …More options (right-aligned). Overflow menu holds "Switch to Markdown".
- Sort row under the composer: `Sort by: Best ⌄` text-button dropdown (options: Best, Top, New, Controversial, Old, Q&A — icon + label rows) next to a "Search Comments" pill that expands into an input.
- Feed link card (`post-type="link"`): title left; full URL as a truncated, clickable, underline-on-hover link; right-side ~128×98 rounded thumbnail (`object-cover`) with a small ↗ badge; thumbnail and URL open the article.

**Deliberate deviations (documented, all functional):**
- Icons are hand-drawn original SVGs approximating the standard glyphs (no Reddit assets are copied).
- Our editor is markdown-native, so the "…" overflow holds **Add image** (file-picker fallback for drag-drop) instead of "Switch to Markdown".
- Reddit's Best/Controversial formulas need per-direction vote counts; our schema stores net score only. Approximations: Best = score desc (ties: older first); Controversial = `(1+replies)/(1+|score|)` desc (most-discussed, most-balanced first); Q&A = Best order with top-level threads the post author replied in bubbled first. Top = score desc (ties: newer first), New/Old = by created_at.
- Comment images must come from our own storage: the markdown renderer only renders `![alt](url)` as `<img>` for `forum-media` public-storage URLs (plus legacy `media.tenor.com`); anything else degrades to a plain link. Keeps the no-`dangerouslySetInnerHTML`, scheme-checked security model.

**Architecture:** No new tables. Migration `0007_link_posts.sql` adds `posts.link_url` + `posts.link_image_url` and recreates `posts_feed` with the two columns appended (both `get_feed` and `search_posts` return `setof posts_feed` via `select *` — no function changes). The posts API accepts `link_url`, scrapes og:image server-side (SSRF-guarded, 4s timeout, 512KB cap) at creation, and stores the resolved image URL. Comment uploads reuse the existing signed-URL ticket flow (`/api/forum/uploads` → PUT → `mediaPublicUrl`), inserting `![image](url)` markdown at the caret with an `![Uploading …]()` placeholder swapped on completion. The GIF picker (component, client fns, `/api/forum/gif-search`) is deleted; `gif_url` stays in the DB/view/render for legacy comments.

### File map

| File | Change |
|---|---|
| `supabase/migrations/0007_link_posts.sql` | Create — link columns + posts_feed recreate |
| `src/lib/markdown.tsx` | `![alt](url)` inline rule → trusted-host `<img>`, else link |
| `src/lib/forumMedia.ts` | `isTrustedMediaUrl`, `ACCEPTED_IMAGE_TYPES`, upload-and-insert helper |
| `src/components/forum/MarkdownEditor.tsx` | Rebuild: Reddit box chrome, SVG toolbar, collapse state, drag/paste uploads, `actions` slot |
| `src/components/forum/CommentComposer.tsx` | Collapsed pill state, GIF removal, Cancel/Comment via `actions` |
| `src/components/forum/GifPicker.tsx` | Delete |
| `src/app/api/forum/gif-search/route.ts` | Delete |
| `src/lib/forum.ts` | ThreadSort×6 + sortTree, `filterTree` comment search, FeedPost link fields, createComment drops gif |
| `src/components/forum/CommentThread.tsx` | Sort dropdown + Search Comments row; `postAuthorKickId` prop |
| `src/components/forum/PostView.tsx` | Pass `postAuthorKickId` |
| `src/lib/ogScrape.ts` | Create — server og:image fetch/parse (pure parse exported for tests) |
| `src/app/api/forum/posts/route.ts` | Accept + validate `link_url`, scrape, store |
| `src/components/forum/SubmitForm.tsx` | Link input (exclusive with uploads/clip) |
| `src/components/forum/PostCard.tsx` | Link-card UI (feed + detail) |
| `src/lib/__tests__/{markdown,forumThread,ogScrape}` | Unit coverage for new rules/sorts/parse |

**Gates per commit:** `npx vitest run` green, `npm run build` success, `npm run lint` zero errors in touched files (repo has 12 pre-existing unrelated errors).

**Live verification (on chickenwebsite.vercel.app, logged-in via Claude in Chrome), then reversal:**
1. Apply migration 0007 via Supabase MCP; confirm `posts_feed` serves the new columns.
2. Push → Vercel + Pages deploys.
3. Create a test link post with a real article URL → og thumbnail card renders (feed + detail).
4. On the user's target post: expand composer, exercise every toolbar button, comment, verify rendering.
5. Drag-drop (synthetic DataTransfer with real File) a PNG and a GIF into a reply → uploads to forum-media, inline render in the posted comment.
6. Exercise all six sorts + comment search filter.
7. Delete every test comment/post created; verify gone from feed/thread.
8. Pages mirror: post page renders new sort UI + link card read-only.
