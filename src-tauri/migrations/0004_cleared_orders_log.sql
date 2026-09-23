-- Migration 0004: Cleared-orders audit log (anti-theft).
--
-- The gap this closes: a table's order can be sent to the kitchen via
-- Print KOT (so food actually goes out), then wiped with "Clear Items"
-- before ever being saved as a bill -- leaving zero record the order, or
-- the money for it, ever existed. www/index.html's #btnClearBill handler
-- now requires an Owner-role PIN before clearing an order that already
-- has a KOT sent, and always logs the clear here regardless of whether a
-- PIN was needed, so the Owner has a permanent, itemized record of every
-- cleared order -- not just the risky ones -- to review from Dashboard.
--
-- Modeled directly on deleted_bills_log (0001_init.sql): a small table,
-- blob-resynced on every doSave() exactly like categories/tables/
-- deleted_bills_log, NOT append-only like inventory_stock_log. Clearing
-- an order is roughly as infrequent as deleting a bill (nowhere near the
-- "several rows per bill, every bill" growth rate that made the
-- inventory ledgers need to be append-only -- see the note at the top of
-- 0002_inventory.sql), so the same simple full-rewrite pattern is the
-- right fit here, not extra complexity to guard against a growth rate
-- this table won't actually see.
--
-- entry_json carries the whole record (table name, items snapshot,
-- value, whether a KOT had been sent, who cleared it, who approved it)
-- as one blob, same as deleted_bills_log.bill_snapshot -- so adding a
-- field later never needs a schema migration, only a JS-side change.

CREATE TABLE IF NOT EXISTS cleared_orders_log (
  id TEXT PRIMARY KEY,
  cleared_at TEXT NOT NULL,
  entry_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cleared_orders_log_date ON cleared_orders_log(cleared_at);
