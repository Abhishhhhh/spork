-- Public share links (spork.fit/p/<log id>).
--
-- A post becomes viewable by link only after its OWNER taps Share
-- (shared_at is set then), and only while it is "Visible to friends".
-- The public-post Edge Function enforces both; RLS on logs is unchanged —
-- the existing logs_update_own policy already lets owners set this column.

alter table logs add column if not exists shared_at timestamptz;
