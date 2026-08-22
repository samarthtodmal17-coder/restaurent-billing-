/*
  Cloudflare Pages Function: POST /api/admin/customer-history

  Powers the "View history" button on the admin dashboard (platform plan
  section 22). Given a customerId, returns the customer's own record, every
  license they hold across every product, and the full chronological
  license_events timeline for all of those licenses combined -- so the
  admin can see "this customer bought Restaurant POS in March, activated
  it the same day, got unbound in June after a device swap, renewed in
  August" etc. all in one place.

  Body: { adminSecret, customerId }
*/

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse({ ok: false, error: "Not authorized." }, 401);
    }

    const customerId = (body.customerId || "").trim();
    if (!customerId) {
      return jsonResponse({ ok: false, error: "Missing customerId." }, 400);
    }

    const db = context.env.DB;

    const customer = await db.prepare(
      "SELECT id, name, email, phone, notes, created_at FROM customers WHERE id = ?"
    ).bind(customerId).first();

    if (!customer) {
      return jsonResponse({ ok: false, error: "That customer ID wasn't found." }, 404);
    }

    const { results: licenses } = await db.prepare(
      `SELECT licenses.id, licenses.license_key, licenses.tier, licenses.status,
              licenses.device_id, licenses.device_label, licenses.app_version, licenses.issued_at,
              licenses.activated_at, licenses.last_checkin_at, licenses.expires_at,
              licenses.last_backup_at, licenses.amount, licenses.currency, licenses.is_trial,
              products.id AS product_id, products.name AS product_name
       FROM licenses
       JOIN products ON products.id = licenses.product_id
       WHERE licenses.customer_id = ?
       ORDER BY licenses.issued_at DESC`
    ).bind(customerId).all();

    let events = [];
    if (licenses.length) {
      const placeholders = licenses.map(() => "?").join(",");
      const { results } = await db.prepare(
        `SELECT license_events.id, license_events.license_id, license_events.event_type,
                license_events.detail, license_events.created_at,
                licenses.license_key, products.name AS product_name
         FROM license_events
         JOIN licenses ON licenses.id = license_events.license_id
         JOIN products ON products.id = licenses.product_id
         WHERE license_events.license_id IN (${placeholders})
         ORDER BY license_events.created_at DESC
         LIMIT 200`
      ).bind(...licenses.map(l => l.id)).all();
      events = results;
    }

    return jsonResponse({ ok: true, customer, licenses, events });
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
