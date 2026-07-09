-- 0002: comments_thread gains author_kick_id (client-side ownership UI).
-- create_comment returns this view's rowtype, so re-create it afterwards.

create or replace view public.comments_thread as
  select
    c.id, c.post_id, c.parent_id, c.depth, c.score, c.created_at, c.edited_at,
    (c.removed_at is not null) as removed,
    case when c.removed_at is null then c.body end as body,
    case when c.removed_at is null then c.gif_url end as gif_url,
    case when c.removed_at is null then pr.username end as author_username,
    case when c.removed_at is null then pr.avatar_url end as author_avatar,
    case when c.removed_at is null then pr.role end as author_role,
    case when c.removed_at is null then pr.kick_id end as author_kick_id
  from public.comments c
  join public.profiles pr on pr.id = c.author_id;

grant select on public.comments_thread to anon, authenticated;

create or replace function public.create_comment(
  p_author uuid, p_post uuid, p_parent uuid, p_body text, p_gif_url text
) returns public.comments_thread
language plpgsql security definer set search_path = public
as $$
declare
  v_depth int := 0;
  v_id    uuid;
  v_row   public.comments_thread;
begin
  if (p_body is null or length(trim(p_body)) = 0) and p_gif_url is null then
    raise exception 'empty_comment';
  end if;

  perform 1 from posts where id = p_post and removed_at is null;
  if not found then raise exception 'post_not_found'; end if;

  if p_parent is not null then
    select depth + 1 into v_depth from comments
      where id = p_parent and post_id = p_post;
    if v_depth is null then raise exception 'parent_not_found'; end if;
    if v_depth > 8 then raise exception 'max_depth'; end if;
  end if;

  insert into comments (post_id, parent_id, author_id, body, gif_url, depth)
  values (p_post, p_parent, p_author, nullif(trim(p_body), ''), p_gif_url, v_depth)
  returning id into v_id;

  update posts set comment_count = comment_count + 1 where id = p_post;

  select * into v_row from comments_thread where id = v_id;
  return v_row;
end $$;

revoke execute on function public.create_comment(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
