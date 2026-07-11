-- Forum v2 (plan 06): notifications, reports, post search, create_comment v2.
-- Idempotent; safe to re-run. Posture unchanged: RLS deny-all on new tables
-- (service-role only); public reads stay on postgres-owned views/RPCs.

-- ------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id         bigserial primary key,
  profile_id uuid not null references public.profiles(id),
  kind       text not null check (kind in
               ('reply_post','reply_comment','mod_remove_post','mod_remove_comment')),
  actor_id   uuid references public.profiles(id),
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  detail     jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx
  on public.notifications (profile_id, id desc);
create index if not exists notifications_unread_idx
  on public.notifications (profile_id) where read_at is null;
alter table public.notifications enable row level security;
-- no policies: anon/authenticated denied; reads go through the authed API route.

-- ------------------------------------------------------------------ reports
create table if not exists public.reports (
  id           bigserial primary key,
  reporter_id  uuid not null references public.profiles(id),
  subject_type text not null check (subject_type in ('post','comment')),
  subject_id   uuid not null,
  reason       text not null check (reason in ('spam','harassment','nsfw','misinfo','other')),
  detail       text check (char_length(detail) <= 500),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id),
  resolution   text check (resolution in ('dismissed','removed'))
);
create unique index if not exists reports_open_dedupe_idx
  on public.reports (reporter_id, subject_type, subject_id) where resolved_at is null;
create index if not exists reports_open_idx
  on public.reports (created_at desc) where resolved_at is null;
alter table public.reports enable row level security;

-- ------------------------------------------------------------------- search
alter table public.posts add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;
create index if not exists posts_search_idx on public.posts using gin (search_tsv);

-- Ranked search over the masked feed view (same postgres-owned read-surface
-- posture as the views themselves; removed posts are excluded by the join).
create or replace function public.search_posts(
  p_q      text,
  p_flair  int default null,
  p_limit  int default 25,
  p_offset int default 0
) returns setof public.posts_feed
language sql stable security definer set search_path = public
as $$
  select pf.*
  from public.posts_feed pf
  join public.posts p on p.id = pf.id
  where websearch_to_tsquery('english', coalesce(p_q, '')) @@ p.search_tsv
    and (p_flair is null or pf.flair_id = p_flair)
  order by ts_rank(p.search_tsv, websearch_to_tsquery('english', coalesce(p_q, ''))) desc,
           pf.created_at desc, pf.id desc
  limit least(greatest(p_limit, 1), 50)
  offset least(greatest(p_offset, 0), 200)
$$;

grant execute on function public.search_posts(text, int, int, int) to anon, authenticated;

-- --------------------------------------------- create_comment v2 (+ notify)
-- Same signature as 0001 (routes unchanged). Adds transactional reply
-- notifications: top-level -> post author, nested -> parent comment author,
-- never the commenter themselves.
create or replace function public.create_comment(
  p_author uuid, p_post uuid, p_parent uuid, p_body text, p_gif_url text
) returns public.comments_thread
language plpgsql security definer set search_path = public
as $$
declare
  v_depth         int := 0;
  v_id            uuid;
  v_row           public.comments_thread;
  v_post_author   uuid;
  v_post_title    text;
  v_parent_author uuid;
  v_excerpt       text;
begin
  if (p_body is null or length(trim(p_body)) = 0) and p_gif_url is null then
    raise exception 'empty_comment';
  end if;

  select author_id, title into v_post_author, v_post_title
    from posts where id = p_post and removed_at is null;
  if not found then raise exception 'post_not_found'; end if;

  if p_parent is not null then
    select depth + 1, author_id into v_depth, v_parent_author from comments
      where id = p_parent and post_id = p_post;
    if v_depth is null then raise exception 'parent_not_found'; end if;
    if v_depth > 8 then raise exception 'max_depth'; end if;
  end if;

  insert into comments (post_id, parent_id, author_id, body, gif_url, depth)
  values (p_post, p_parent, p_author, nullif(trim(p_body), ''), p_gif_url, v_depth)
  returning id into v_id;

  update posts set comment_count = comment_count + 1 where id = p_post;

  v_excerpt := coalesce(left(nullif(trim(p_body), ''), 140), '[gif]');

  if p_parent is null then
    if v_post_author <> p_author then
      insert into notifications (profile_id, kind, actor_id, post_id, comment_id, detail)
      values (v_post_author, 'reply_post', p_author, p_post, v_id,
              jsonb_build_object('post_title', v_post_title, 'excerpt', v_excerpt));
    end if;
  else
    if v_parent_author is not null and v_parent_author <> p_author then
      insert into notifications (profile_id, kind, actor_id, post_id, comment_id, detail)
      values (v_parent_author, 'reply_comment', p_author, p_post, v_id,
              jsonb_build_object('post_title', v_post_title, 'excerpt', v_excerpt));
    end if;
  end if;

  select * into v_row from comments_thread where id = v_id;
  return v_row;
end $$;

revoke execute on function public.create_comment(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
