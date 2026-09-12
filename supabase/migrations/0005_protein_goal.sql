-- Add protein_goal column to users table.
-- Optional (nullable) — existing rows and users who manually entered a
-- calorie goal get null here; the app treats null as "not set".
alter table users add column if not exists protein_goal int;
