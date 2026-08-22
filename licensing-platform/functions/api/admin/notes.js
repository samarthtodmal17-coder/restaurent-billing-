/*
  Cloudflare Pages Function: POST /api/admin/notes

  Saves the free-text notes field for a customer (e.g. "asked for a
  discount", "prefers WhatsApp", "called about renewal on Aug 20"). Shown
  and edited from the customer-history panel on the admin dashboard.

  Body: { adminSecret, customerId, notes }
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
    const existing = await db.prepare("SELECT id FROM customers WHERE id = ?").bind(customerId).first();
    if (!existing) {
      return jsonResponse({ ok: false, error: "That customer ID wasn't found." }, 404);
    }

    const notes = typeof body.notes === "string" ? body.notes : "";
    await db.prepare("UPDATE customers SET notes = ? WHERE id = ?").bind(notes || null, customerId).run();

    return jsonResponse({ ok: true, customerId, notes });
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
