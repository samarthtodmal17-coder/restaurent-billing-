-- Adds a last_backup_at column so the admin dashboard can eventually show
-- when each customer's data was last safely copied off their machine.
-- Additive only (ADD COLUMN), per section 18 of the platform plan: never
-- edit 0001_init.sql once a customer has run it, only ever add forward.
ALTER TABLE licenses ADD COLUMN last_backup_at TEXT;
