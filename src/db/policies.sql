-- ============================================================================
-- Row Level Security
-- The API server uses the Supabase SERVICE ROLE key, which BYPASSES RLS, and
-- enforces authorization in its own middleware (auth + rbac). These policies
-- only matter if the frontend ever talks to Supabase directly with the anon
-- key. They default to "authenticated can read"; writes go through the API.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'branches','users','products','leads','lead_timeline','follow_ups','lead_activities',
    'sales','general_targets','special_targets','project_targets','incentives',
    'finance_monthly','expenses','receivables','activities','notifications'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "read_authenticated" on %I;', t);
    execute format(
      'create policy "read_authenticated" on %I for select to authenticated using (true);', t
    );
  end loop;
end $$;

-- Example: users may read & update only their own notifications via anon key.
drop policy if exists "own_notifications" on notifications;
create policy "own_notifications" on notifications
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
