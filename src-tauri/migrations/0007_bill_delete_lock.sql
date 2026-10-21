-- Migration 0007: database-level lock on bills.
-- After this, SQLite itself REFUSES to delete a bill unless the app has
-- deliberately opened the permit (bill_delete_permit.allowed = 1) for that one
-- save -- which it only does for an owner-confirmed delete or a full
-- restore/reset. Any other code path, old bug or stray second copy that tries
-- to delete a bill now fails loudly instead of silently losing it.
-- No existing data is changed.
CREATE TABLE IF NOT EXISTS bill_delete_permit (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  allowed INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO bill_delete_permit (id, allowed) VALUES (1, 0);

CREATE TRIGGER IF NOT EXISTS bills_protect_delete
BEFORE DELETE ON bills
WHEN (SELECT allowed FROM bill_delete_permit WHERE id = 1) IS NOT 1
BEGIN
  SELECT RAISE(ABORT, 'bills are protected: delete refused');
END;
