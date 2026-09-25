-- Migration 0005: Session-based cancelled-item tracking.
--
-- The gap this closes: 0004's cleared_orders_log wrote one full audit
-- entry per individual "remove a KOT-sent item" click. In practice a
-- single order gets edited multiple times before it's ever billed or
-- cleared (e.g. two rotis knocked off a table's order one at a time),
-- and that produced one duplicate log row per click -- "1x Tandoor Roti"
-- twice instead of "2x Tandoor Roti" once -- which made Bill History
-- noisy and hard to actually review.
--
-- The fix: accumulate removals on the OPEN ORDER itself in memory
-- (order.cancelledSession -- one reason, items merged by key) instead of
-- writing to cleared_orders_log on every click. That session only gets
-- flushed once the order reaches an outcome:
--   - Saved as a bill -> the accumulated items move onto the BILL record
--     (cancelled_items_json / cancelled_reason below) and show inline
--     next to that bill in Bill History. No cleared_orders_log entry at
--     all for this path -- the cancellation is now part of the bill's
--     own story, not a separate floating log line.
--   - Order fully cleared without ever billing -> the session's earlier
--     removals plus whatever's left in the cart at clear-time collapse
--     into ONE cleared_orders_log entry (see 0004), not one per click.
--
-- cancelled_session on open_orders needs to survive an app restart mid-
-- order (same reason kot_sent already gets its own column in 0001), so
-- it's a plain JSON TEXT blob column, same treatment as kot_sent.
--
-- cancelled_items_json / cancelled_reason on bills are nullable and only
-- ever set on save if that order actually had a cancelled session at
-- save time -- most bills will have both NULL, same pattern as the
-- existing nullable edited_at / edited_by columns from 0003.

ALTER TABLE open_orders ADD COLUMN cancelled_session TEXT;
ALTER TABLE bills ADD COLUMN cancelled_items_json TEXT;
ALTER TABLE bills ADD COLUMN cancelled_reason TEXT;
