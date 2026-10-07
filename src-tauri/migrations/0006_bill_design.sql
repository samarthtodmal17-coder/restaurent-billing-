-- Migration 0006: selectable customer-bill design.
-- Stores which printed/previewed bill layout the owner picked in Settings ->
-- Bill Design ('classic', 'blackbar', 'bands' or 'premium'). Existing shops
-- default to 'classic', i.e. the layout they already have.
ALTER TABLE business_settings ADD COLUMN bill_design TEXT NOT NULL DEFAULT 'classic';
