/*
  Cloudflare Pages Function: POST /api/admin/dashboard

  Powers the "front page" of the admin dashboard: totals across every
  product, licenses about to expire (so renewals get chased before they
  lapse, not after), a recent-activity feed, and simple sale-price revenue
  totals. Deliberately its own endpoint rather than folded into
  /api/admin/list, because these are whole-table aggregates (not capped at
  list.js's 500-row page) and a different query shape (events feed, date
  range aggregates) than the license table itself.

  Body: { adminSecret }
*/

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse({ ok: false, error: "Not authorized." }, 401);
    }

    const db = context.env.DB;
    const nowIso = new Date().toISOString();
    const in30DaysIso = new Date(Date.now() + 30 * 86400000).toISOString();
    const monthStartIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const totalsRow = await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM customers) AS totalCustomers,
         (SELECT COUNT(*) FROM licenses) AS totalLicenses,
         (SELECT COUNT(*) FROM licenses WHERE status = 'active' AND (expires_at IS NULL OR expires_at >= ?)) AS activeLicenses,
         (SELECT COUNT(*) FROM licenses WHERE status = 'revoked') AS revokedLicenses,
         (SELECT COUNT(*) FROM licenses WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?) AS expiredLicenses`
    ).bind(nowIso, nowIso).first();

    const { results: expiringSoon } = await db.prepare(
      `SELECT licenses.license_key, licenses.expires_at, licenses.tier,
              customers.id AS customer_id, customers.name AS customer_name,
              products.name AS product_name
       FROM licenses
       JOIN customers ON customers.id = licenses.customer_id
       JOIN products ON products.id = licenses.product_id
       WHERE licenses.status = 'active' AND licenses.expires_at IS NOT NULL
         AND licenses.expires_at >= ? AND licenses.expires_at <= ?
       ORDER BY licenses.expires_at ASC
       LIMIT 20`
    ).bind(nowIso, in30DaysIso).all();

    const { results: recentActivity } = await db.prepare(
      `SELECT license_events.event_type, license_events.detail, license_events.created_at,
              licenses.license_key, customers.name AS customer_name, products.name AS product_name
       FROM license_events
       JOIN licenses ON licenses.id = license_events.license_id
       JOIN customers ON customers.id = licenses.customer_id
       JOIN products ON products.id = licenses.product_id
       ORDER BY license_events.created_at DESC
       LIMIT 20`
    ).all();

    const { results: revenueThisMonth } = await db.prepare(
      `SELECT currency, SUM(amount) AS total, COUNT(*) AS count
       FROM licenses
       WHERE amount IS NOT NULL AND issued_at >= ?
       GROUP BY currency`
    ).bind(monthStartIso).all();

    // Inactive customers: activated devices that haven't checked back in
    // for 14+ days. Every activation/recheck from the app writes a fresh
    // last_checkin_at (see activate.js's heartbeat path), so a stale value
    // here usually means either the app crashed/was uninstalled, or the
    // customer just isn't opening it -- both worth a proactive nudge
    // before they show up complaining.
    const fourteenDaysAgoIso = new Date(Date.now() - 14 * 86400000).toISOString();
    const { results: inactiveCustomers } = await db.prepare(
      `SELECT licenses.license_key, licenses.last_checkin_at,
              customers.id AS customer_id, customers.name AS customer_name,
              products.name AS product_name
       FROM licenses
       JOIN customers ON customers.id = licenses.customer_id
       JOIN products ON products.id = licenses.product_id
       WHERE licenses.status = 'active' AND licenses.device_id IS NOT NULL
         AND licenses.last_checkin_at IS NOT NULL AND licenses.last_checkin_at < ?
       ORDER BY licenses.last_checkin_at ASC
       LIMIT 20`
    ).bind(fourteenDaysAgoIso).all();

    const { results: revenueAllTime } = await db.prepare(
      `SELECT currency, SUM(amount) AS total, COUNT(*) AS count
       FROM licenses
       WHERE amount IS NOT NULL
       GROUP BY currency`
    ).all();

    return jsonResponse({
      ok: true,
      totals: totalsRow,
      expiringSoon,
      inactiveCustomers,
      recentActivity,
      revenueThisMonth,
      revenueAllTime
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server error, please try again." }, 500);
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
