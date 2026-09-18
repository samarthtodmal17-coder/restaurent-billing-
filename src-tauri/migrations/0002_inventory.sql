-- Migration 0002: Inventory & Stock Management (grocery/consumables).
--
-- Three of the four new tables follow the SAME "small table, fully
-- rewritten from the in-memory data blob on every doSave()" pattern
-- already used for menu_items/categories/tables (see 0001_init.sql) --
-- inventory_items and menu_item_recipes are both small (dozens to a few
-- hundred rows for a single restaurant's ingredient list), so that's fine.
--
-- inventory_stock_log and inventory_purchases are deliberately NOT part
-- of that blob-resync pattern. doSave() runs on every single bill save,
-- and a full DELETE+re-INSERT of a ledger table that grows by several
-- rows per bill (one per ingredient consumed) would make routine billing
-- get slower with every passing month, forever -- exactly the class of
-- unbounded-growth mistake fixed elsewhere in this app this same
-- release cycle (the old per-launch local-backup snapshots, the
-- per-save debug log). Both tables are instead append-only: written via
-- their own direct INSERT the moment a purchase/sale/wastage happens,
-- and read on demand (filtered by item/date range) when their report
-- screens are opened -- never loaded into the in-memory data blob.

-- The ingredient/consumable master list. current_stock is the running
-- total (denormalized, same idea as business_settings.daily_seq or the
-- counters table) -- inventory_stock_log is the audit trail that explains
-- every change to it, not the source the UI reads from on every render.
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  unit_type TEXT NOT NULL DEFAULT 'count',   -- 'weight' | 'volume' | 'count'
  unit_label TEXT NOT NULL DEFAULT 'pcs',    -- kg, g, l, ml, pcs, packet, box, ...
  current_stock REAL NOT NULL DEFAULT 0,
  reorder_threshold REAL NOT NULL DEFAULT 0,
  last_purchase_cost REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);

-- Recipe / BOM: which ingredients (and how much of each) a menu item
-- consumes per single unit sold. Loaded/saved nested under each menu
-- item, exactly like menu_item_variants.
CREATE TABLE IF NOT EXISTS menu_item_recipes (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_per_unit REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON menu_item_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_inventory_item ON menu_item_recipes(inventory_item_id);

-- Append-only purchase log (stock coming IN). Never rewritten wholesale --
-- see the note at the top of this file.
CREATE TABLE IF NOT EXISTS inventory_purchases (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  purchase_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_item ON inventory_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON inventory_purchases(purchase_date);

-- Append-only stock movement ledger (every purchase / sale-triggered
-- auto-deduction / wastage / manual adjustment / reversal). This is the
-- audit trail current_stock changes are explained by. Never rewritten
-- wholesale -- see the note at the top of this file.
CREATE TABLE IF NOT EXISTS inventory_stock_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  change_qty REAL NOT NULL,          -- positive = stock in, negative = stock out
  reason TEXT NOT NULL,              -- 'purchase' | 'sale' | 'wastage' | 'adjustment' | 'reversal'
  reference_bill_id TEXT,            -- set for 'sale' / 'reversal'
  reference_purchase_id TEXT,        -- set for 'purchase'
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_log_item ON inventory_stock_log(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_log_bill ON inventory_stock_log(reference_bill_id);
CREATE INDEX IF NOT EXISTS idx_stock_log_date ON inventory_stock_log(created_at);
