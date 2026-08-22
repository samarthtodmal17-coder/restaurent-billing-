-- Adds a free-text notes field per customer (dashboard search/notes bundle)
-- and sale price tracking per license (revenue bundle). Both nullable so
-- every existing row remains valid without a backfill.
ALTER TABLE customers ADD COLUMN notes TEXT;
ALTER TABLE licenses ADD COLUMN amount INTEGER;   -- stored in the smallest
                                                   -- currency unit (e.g.
                                                   -- paise / cents) to avoid
                                                   -- float rounding issues.
ALTER TABLE licenses ADD COLUMN currency TEXT;    -- e.g. "INR", "USD".
