/*
  Cloudflare Pages Function: POST /api/admin/list

  Powers the admin dashboard's customer/license table (platform plan
  section 21-22). Returns every license joined with its customer and
  product, most-recently-issued first, plus a small summary count block
  (section 21's "Customers / Active licenses / Expired.../ Revoked...").

  Body: { adminSecret, productId? }  -- productId optional, filters to one product.
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

    const baseQuery = `
      SELECT licenses.id, licenses.license_key, licenses.tier, licenses.status,
             licenses.device_id, licenses.app_version, licenses.db_version,
             licenses.issued_at, licenses.activated_at, licenses.last_checkin_at,
             customers.id AS customer_id, customers.name AS customer_name,
             products.id AS product_id, products.name AS product_name
      FROM licenses
      JOIN customers ON customers.id = licenses.customer_id
      JOIN products ON products.id = licenses.product_id
      ${productId ? "WHERE licenses.product_id = ?" : ""}
      ORDER BY licenses.issued_at DESC
      LIMIT 500
    `;
    const stmt = productId ? db.prepare(baseQuery).bind(productId) : db.prepare(baseQuery);
    const { results } = await stmt.all();

    const summary = {
      totalLicenses: results.length,
      active: results.filter(r => r.status === "active").length,
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
