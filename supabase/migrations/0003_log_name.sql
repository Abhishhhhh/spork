-- Adds a short, human-readable meal name to logs — distinct from the
-- existing `description` column (free-text detail typed at capture time,
-- e.g. "200g rice, 400g chicken breast"), this is a display label shown
-- wherever a log appears (Feed, Friend Profile), e.g. "Greek yoghurt &
-- berries". Editable on the Edit & Post step (spec §6), defaulted from
-- the AI's top identified food item when an estimate succeeds.
-- Run this once, in full, via the Supabase Dashboard SQL Editor — same
-- process as 0001_init.sql and 0002_meal_photos.sql.

alter table logs add column name text;
