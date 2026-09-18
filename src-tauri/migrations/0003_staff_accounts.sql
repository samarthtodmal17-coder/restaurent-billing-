-- Migration 0003: Owner/Staff named accounts + edit/delete attribution.
--
-- staff_accounts follows the same "small table, fully rewritten from the
-- in-memory data blob on every doSave()" pattern as categories/tables in
-- 0001_init.sql -- a restaurant has a handful of staff, never thousands,
-- so a full DELETE+re-INSERT on every save is cheap here, same reasoning
-- as inventory_items in 0002_inventory.sql.
--
-- PINs are stored as plain text on purpose, not hashed. This is a soft,
-- on-the-shop-floor gate ("which staff member is using the till right
-- now, so edits/deletes can be attributed and Owner-only screens stay
-- hidden") -- not a security boundary meant to resist someone with direct
-- access to this device's database file. The device itself is already
-- the real boundary (see get_device_fingerprint / the license system).
--
-- edited_by/deleted_by let Bill History show WHO edited or deleted a
-- bill, not just when -- the natural next step after v0.1.14's itemized
-- edit-history diff, now that more than one named person can use the
-- till. deleted_bills_log needs no schema change for this: it already
-- stores the whole bill as one JSON blob in bill_snapshot (see
-- 0001_init.sql), so a "deletedBy" field just rides along inside that
-- JSON automatically.

CREATE TABLE IF NOT EXISTS staff_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',   -- 'owner' | 'staff'
  created_at TEXT NOT NULL
);

ALTER TABLE bills ADD COLUMN edited_by TEXT;
ALTER TABLE bill_edit_history ADD COLUMN edited_by TEXT;
