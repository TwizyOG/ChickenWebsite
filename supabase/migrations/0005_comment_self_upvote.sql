-- Plan 06 follow-up: a new comment is implicitly upvoted by its author, so it
-- starts at score 1 (Reddit-style) instead of 0. create_comment v3 = v2 (reply
-- notifications) + the author self-vote. Idempotent (create or replace).

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

  insert into comments (post_id, parent_id, author_id, body, gif_url, depth, score)
  values (p_post, p_parent, p_author, nullif(trim(p_body), ''), p_gif_url, v_depth, 1)
  returning id into v_id;

  update posts set comment_count = comment_count + 1 where id = p_post;

  -- Author implicitly upvotes their own comment → starts at score 1, +1 karma.
  insert into votes (profile_id, subject_type, subject_id, value)
  values (p_author, 'comment', v_id, 1);
  update profiles set comment_karma = comment_karma + 1 where id = p_author;

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
