-- Migration 0001: initial schema
-- Mirrors the exact data shape currently held in the single IndexedDB
-- blob (billingAppDB_v1 -> appData -> "main") inside billing-app-restaurant-EASY-v42.html,
-- normalized into real tables. Field names are the snake_case equivalents
-- of the existing JS object keys so the translation layer in www/db.js
-- stays mechanical and easy to audit against the source app.

-- Single-row table for business/receipt/tax settings (was data.business).
CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'My Business',
  logo TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  footer TEXT NOT NULL DEFAULT 'Thank you for your visit!',
  currency TEXT NOT NULL DEFAULT '₹',
  tax_label TEXT NOT NULL DEFAULT 'Tax',
  tax_percent REAL NOT NULL DEFAULT 0,
  service_charge_percent REAL NOT NULL DEFAULT 0,
  bill_prefix TEXT NOT NULL DEFAULT 'INV',
  receipt_paper_width TEXT NOT NULL DEFAULT '58',
  receipt_paper_width_custom REAL NOT NULL DEFAULT 58,
  kot_paper_width TEXT NOT NULL DEFAULT '58',
  kot_paper_width_custom REAL NOT NULL DEFAULT 58,
  packing_charge_type TEXT NOT NULL DEFAULT 'amount',
  packing_charge_value REAL NOT NULL DEFAULT 0,
  rawbt_auto_print INTEGER NOT NULL DEFAULT 0,
  daily_seq INTEGER NOT NULL DEFAULT 1,
  last_bill_date_key TEXT NOT NULL DEFAULT '',
  upi_id TEXT NOT NULL DEFAULT '',
  show_upi_qr INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO business_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  merged_into_table_id TEXT REFERENCES tables(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id TEXT REFERENCES subcategories(id) ON DELETE SET NULL,
  price REAL,
  tax_percent REAL,
  photo TEXT,
  send_to_kitchen INTEGER,
  favorite INTEGER NOT NULL DEFAULT 0,
  out_of_stock INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

CREATE TABLE IF NOT EXISTS menu_item_variants (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_item ON menu_item_variants(menu_item_id);

-- Running/open orders (was data.openOrders).
CREATE TABLE IF NOT EXISTS open_orders (
  id TEXT PRIMARY KEY,
  table_id TEXT REFERENCES tables(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  discount_value REAL NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'amount',
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  split_enabled INTEGER NOT NULL DEFAULT 0,
  split_payments TEXT,
  is_parcel INTEGER NOT NULL DEFAULT 0,
  packing_charge_override REAL,
  kot_sent TEXT NOT NULL DEFAULT '{}',
  editing_bill_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES open_orders(id) ON DELETE CASCADE,
  item_id TEXT,
  variant_id TEXT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  qty REAL NOT NULL,
  tax_percent REAL,
  category_id TEXT,
  category_name TEXT,
  subcategory_id TEXT,
  subcategory_name TEXT,
  rate_edited INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Finalized bills (was data.bills).
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_no TEXT NOT NULL,
  date TEXT NOT NULL,
  table_id TEXT,
  table_name TEXT,
  customer TEXT,
  customer_phone TEXT,
  payment_mode TEXT,
  split_payments TEXT,
  is_credit INTEGER NOT NULL DEFAULT 0,
  credit_paid REAL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  discount_value REAL NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'amount',
  tax_label TEXT,
  tax_percent REAL,
  tax REAL NOT NULL DEFAULT 0,
  tax_by_rate TEXT,
  service_charge_percent REAL,
  service REAL NOT NULL DEFAULT 0,
  is_parcel INTEGER NOT NULL DEFAULT 0,
  packing_charge REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  original_bill_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
CREATE INDEX IF NOT EXISTS idx_bills_table ON bills(table_id);

CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  item_id TEXT,
  variant_id TEXT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  qty REAL NOT NULL,
  tax_percent REAL,
  category_id TEXT,
  category_name TEXT,
  subcategory_id TEXT,
  subcategory_name TEXT,
  rate_edited INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);

CREATE TABLE IF NOT EXISTS bill_edit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  edited_at TEXT NOT NULL,
  previous_items TEXT,
  previous_total REAL,
  previous_discount_amount REAL,
  previous_table TEXT,
  previous_customer TEXT,
  previous_payment_mode TEXT
);
CREATE INDEX IF NOT EXISTS idx_edit_history_bill ON bill_edit_history(bill_id);

-- Full-snapshot audit log of deleted bills (was data.deletedBillsLog).
-- Stored as one JSON blob per row (bill_snapshot) because this table is a
-- point-in-time archive, not something the app queries field-by-field --
-- matching how the app already does it (Object.assign clone of the whole bill).
CREATE TABLE IF NOT EXISTS deleted_bills_log (
  id TEXT PRIMARY KEY,
  original_bill_id TEXT,
  deleted_at TEXT NOT NULL,
  bill_snapshot TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deleted_bills_date ON deleted_bills_log(deleted_at);

CREATE TABLE IF NOT EXISTS credit_payments (
  id TEXT PRIMARY KEY,
  account_key TEXT,
  name TEXT,
  phone TEXT,
  amount REAL NOT NULL DEFAULT 0,
  mode TEXT,
  note TEXT,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_payment_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_payment_id TEXT NOT NULL REFERENCES credit_payments(id) ON DELETE CASCADE,
  bill_id TEXT,
  bill_no TEXT,
  amount REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_allocations_payment ON credit_payment_allocations(credit_payment_id);

-- Simple named counters (was data.nextItemCode). Key/value so future
-- products sharing this same schema pattern can add their own counters
-- without another migration.
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO counters (key, value) VALUES ('next_item_code', 101);

-- App/device metadata (section 16/17 of the platform plan: app version is
-- disposable, this table plus the rest of the .db file is what's permanent
-- and travels across every future update).
CREATE TABLE IF NOT EXISTS system_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO system_info (key, value) VALUES ('schema_version', '1');
