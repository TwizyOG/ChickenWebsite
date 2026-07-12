-- Admin "remove permanently": fully delete a removed (tombstoned) comment so it
-- disappears from the thread instead of showing "[removed]". Restricted to LEAF
-- tombstones — a removed comment with replies must stay as a tombstone to keep
-- the thread shape intact (deleting it would orphan live replies).
-- Service-role only (SECURITY DEFINER); called by the admin purge route.

create or replace function public.purge_comment(p_comment uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_post     uuid;
  v_removed  timestamptz;
  v_children int;
begin
  select post_id, removed_at into v_post, v_removed from comments where id = p_comment;
  if v_post is null then raise exception 'not_found'; end if;
  if v_removed is null then raise exception 'not_removed'; end if;

  select count(*) into v_children from comments where parent_id = p_comment;
  if v_children > 0 then raise exception 'has_replies'; end if;

  delete from notifications where comment_id = p_comment;
  delete from votes  where subject_type = 'comment' and subject_id = p_comment;
  delete from reports where subject_type = 'comment' and subject_id = p_comment;
  delete from comments where id = p_comment;
  update posts set comment_count = greatest(comment_count - 1, 0) where id = v_post;
  return 1;
end $$;

revoke execute on function public.purge_comment(uuid) from public, anon, authenticated;
