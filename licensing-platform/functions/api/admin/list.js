/*
  Cloudflare Pages Function: POST /api/admin/list

  Powers the admin dashboard's customer/license table (platform plan
  section 21-22). Returns every license joined with its customer and
  product, most-recently-issued first, plus a small summary count block
  (section 21's "Customers / Active licenses / Expired.../ Revoked...").

  Body: { adminSecret, productId?, search? }
    -- productId optional, filters to one product.
    -- search optional, matches (case-insensitively) against customer name,
    --   email, phone, or license key -- so you're not limited to browsing
    --   by product when you're looking for one specific customer.
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
    const productId = (body.productId || "").trim();
    const search = (body.search || "").trim();

    const conditions = [];
    const args = [];
    if (productId) { conditions.push("licenses.product_id = ?"); args.push(productId); }
    if (search) {
      conditions.push(`(
        LOWER(customers.name) LIKE ? OR
        LOWER(COALESCE(customers.email, '')) LIKE ? OR
        LOWER(COALESCE(customers.phone, '')) LIKE ? OR
        LOWER(licenses.license_key) LIKE ?
      )`);
      const needle = "%" + search.toLowerCase() + "%";
      args.push(needle, needle, needle, needle);
    }

    const baseQuery = `
      SELECT licenses.id, licenses.license_key, licenses.tier, licenses.status,
             licenses.device_id, licenses.device_label, licenses.app_version, licenses.db_version,
             licenses.issued_at, licenses.activated_at, licenses.last_checkin_at,
             licenses.expires_at, licenses.last_backup_at, licenses.amount, licenses.currency,
             licenses.is_trial,
             customers.id AS customer_id, customers.name AS customer_name,
             products.id AS product_id, products.name AS product_name
      FROM licenses
      JOIN customers ON customers.id = licenses.customer_id
      JOIN products ON products.id = licenses.product_id
      ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
      ORDER BY licenses.issued_at DESC
      LIMIT 500
    `;
    const stmt = args.length ? db.prepare(baseQuery).bind(...args) : db.prepare(baseQuery);
    const { results } = await stmt.all();

    const nowMs = Date.now();
    const isExpired = r => r.expires_at && new Date(r.expires_at).getTime() < nowMs;

    const summary = {
      totalLicenses: results.length,
      active: results.filter(r => r.status === "active" && !isExpired(r)).length,
      expired: results.filter(r => r.status === "active" && isExpired(r)).length,
      revoked: results.filter(r => r.status === "revoked").length,
      activatedDevices: results.filter(r => !!r.device_id).length,
      uniqueCustomers: new Set(results.map(r => r.customer_id)).size
    };

    return jsonResponse({ ok: true, summary, licenses: results });
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
