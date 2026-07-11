-- Plan 06 hardening (from task-1 review): the private tables are RLS-deny-all,
-- but Supabase's default privileges still grant table-level access to the API
-- roles — revoke outright (service role bypasses grants). Plus two indexes for
-- the plan's later access patterns: notification fan-out by comment, and
-- subject-scoped report resolves.

revoke all on table public.notifications, public.reports,
              public.mod_log, public.bans
  from anon, authenticated;

create index if not exists notifications_comment_idx
  on public.notifications (comment_id);
create index if not exists reports_subject_open_idx
  on public.reports (subject_type, subject_id) where resolved_at is null;
