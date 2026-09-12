-- Add caption column to logs (social text separate from AI description).
-- Also add satiety/mood for post-log check-in.
alter table logs add column if not exists caption text;
alter table logs add column if not exists satiety text check (satiety in ('loved_it','good','okay','not_great'));
