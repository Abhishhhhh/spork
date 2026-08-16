-- Phase 4 (Log flow): private Storage bucket for meal photos.
-- Run this once, in full, via the Supabase Dashboard SQL Editor
-- (Project → SQL Editor → New query → paste this file → Run) —
-- same process as 0001_init.sql.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false);

-- Path convention: {user_id}/{log_id}.<ext> — mirrors logs' own RLS
-- (logs_select_own_or_public_friend in 0001_init.sql): an object is only
-- fetchable by its owner, or by an accepted friend when the log it
-- belongs to is public. Belt-and-suspenders (spec §4): even a leaked
-- signed URL doesn't outlive its short expiry, and a guessed path still
-- has to pass this same check. logs.photo_url stores exactly this path
-- (not a URL) for rows whose photo lives in this bucket.
create policy "meal_photos_select_own_or_public_friend"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from logs l
        join friendships f
          on f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.recipient_id = l.user_id)
            or (f.recipient_id = auth.uid() and f.requester_id = l.user_id)
          )
        where l.photo_url = storage.objects.name
          and l.user_id::text = (storage.foldername(storage.objects.name))[1]
          and l.visibility = 'public'
      )
    )
  );

create policy "meal_photos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "meal_photos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
