-- Owners can delete their own meal posts. 0001 only granted select/insert/
-- update on logs, so "Delete post" silently matched zero rows. Likes,
-- comments and notifications on the post go with it (on delete cascade).
drop policy if exists "logs_delete_own" on logs;
create policy "logs_delete_own"
  on logs for delete
  to authenticated
  using (auth.uid() = user_id);
