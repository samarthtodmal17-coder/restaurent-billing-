/*
  Cloudflare Pages Function: POST /api/admin/products

  Minimal product-registry endpoint (platform plan section 35). Two
  actions in one handler, chosen by body.action, so the admin page only
  needs to know one URL:

    - action: "list"   -> returns every product (for the dropdown when
                           issuing a license, and the dashboard header).
    - action: "create" -> registers a new product. This is the one-time
                           step you run when launching a second product
                           (e.g. Inventory) on this same shared platform --
                           see platform plan sections 34-36.

  Body: { adminSecret, action, id?, name?, currentVersion? }
*/

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse({ ok: false, error: "Not authorized." }, 401);
    }

    const db = context.env.DB;
    const action = (body.action || "list").trim();

    if (action === "list") {
      const { results } = await db.prepare(
        "SELECT id, name, current_version, status, created_at FROM products ORDER BY created_at ASC"
      ).all();
      return jsonResponse({ ok: true, products: results });
    }

    if (action === "create") {
      const id = (body.id || "").trim();
      const name = (body.name || "").trim();
      if (!id || !name) {
        return jsonResponse({ ok: false, error: "id and name are required." }, 400);
      }
      const clash = await db.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
      if (clash) {
        return jsonResponse({ ok: false, error: "A product with that id already exists." }, 400);
      }
      await db.prepare(
        "INSERT INTO products (id, name, current_version, status, created_at) VALUES (?, ?, ?, 'active', ?)"
      ).bind(id, name, (body.currentVersion || "").trim() || null, new Date().toISOString()).run();
      return jsonResponse({ ok: true, id, name });
    }

    return jsonResponse({ ok: false, error: "Unknown action." }, 400);
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
