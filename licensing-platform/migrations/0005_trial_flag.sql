-- Marks a license as a trial (vs. a paid one), so the admin dashboard can
-- track trials distinctly from real sales and offer a one-click "Convert
-- to Paid" action. device_label already existed unused since 0001_init.sql
-- -- this migration just starts writing to it from the admin UI.
ALTER TABLE licenses ADD COLUMN is_trial INTEGER NOT NULL DEFAULT 0;
