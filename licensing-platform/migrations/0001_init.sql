-- Central licensing platform schema (Cloudflare D1 -- SQLite-compatible).
-- One shared database for every product the company sells, per the
-- platform architecture: one customer can hold licenses for several
-- products; one license is bound to at most one device at a time.
--
-- D1 enforces foreign key constraints by default (unlike plain SQLite,
-- where FKs are off unless you PRAGMA them on) -- so insert order matters:
-- products and customers before licenses, licenses before license_events.

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  current_version TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TEXT NOT NULL
);

-- One row per sold license. device_id/activated_at are cleared (not the
-- whole row deleted) by the "unbind" admin action, so the same key can be
-- reactivated fresh on a replacement device -- same pattern already proven
-- on the KV-backed version built for the PWA, just relational now.
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  tier TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  device_id TEXT,
  device_label TEXT,
  app_version TEXT,
  db_version TEXT,
  issued_at TEXT NOT NULL,
  activated_at TEXT,
  unbound_at TEXT,
  status_changed_at TEXT,
  last_checkin_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_licenses_customer ON licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_licenses_product ON licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_licenses_device ON licenses(device_id);

-- Lightweight audit trail: every issue/activate/revoke/reactivate/unbind/
-- heartbeat writes one row here. This is what powers the admin dashboard's
-- per-customer history (section 22 of the platform plan) and, longer
-- term, the health-monitoring rollup (section 39) -- both read from this
-- one table instead of needing separate systems.
CREATE TABLE IF NOT EXISTS license_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN
    ('issued', 'activated', 'activation_denied', 'revoked', 'reactivated', 'unbound', 'heartbeat')),
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_license ON license_events(license_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON license_events(created_at);
