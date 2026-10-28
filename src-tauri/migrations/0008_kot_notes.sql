-- Migration 0008: kitchen notes (KOT) on item lines + editable note presets.
-- Purely additive: three nullable TEXT columns. No existing row is changed.
--   order_items.note      the note the cashier set on a running order line ("Less oil, Less spicy")
--   order_items.kot_note  the note as it was on the last Kitchen Order Ticket (to spot a later change)
--   bill_items.note       the note kept with the saved bill
--   business_settings.kot_note_presets  the owner's list of one-tap notes (JSON array)
ALTER TABLE order_items ADD COLUMN note TEXT;
ALTER TABLE order_items ADD COLUMN kot_note TEXT;
ALTER TABLE bill_items ADD COLUMN note TEXT;
ALTER TABLE business_settings ADD COLUMN kot_note_presets TEXT;
