-- Forum plan 07: link posts (article URL + scraped og:image thumbnail).
-- Idempotent; safe to re-run. posts_feed is recreated with the two link
-- columns APPENDED (create-or-replace-view requires appended columns), so
-- get_feed / search_posts — which return setof posts_feed via select * —
-- pick them up without signature changes. Grants on the view are preserved.

alter table public.posts add column if not exists link_url text;
alter table public.posts add column if not exists link_image_url text;

create or replace view public.posts_feed as
  select
    p.id, p.title, p.body, p.kind, p.score, p.comment_count,
    p.created_at, p.edited_at,
    p.flair_id, f.name as flair_name, f.color as flair_color,
    pr.username as author_username, pr.avatar_url as author_avatar,
    pr.role as author_role, pr.kick_id as author_kick_id,
    (log(greatest(abs(p.score), 1)::numeric)
      + sign(p.score::numeric)
        * extract(epoch from (p.created_at - timestamptz '2026-01-01 00:00:00+00')) / 45000.0
    )::double precision as hot_score,
    (select coalesce(
        jsonb_agg(jsonb_build_object(
          'kind', m.kind, 'url', m.url, 'storage_path', m.storage_path,
          'embed_id', m.embed_id, 'width', m.width, 'height', m.height,
          'position', m.position) order by m.position),
        '[]'::jsonb)
       from public.media_attachments m where m.post_id = p.id) as attachments,
    p.link_url, p.link_image_url
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  join public.flairs f on f.id = p.flair_id
  where p.removed_at is null;
