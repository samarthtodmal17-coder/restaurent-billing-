/*
  Cloudflare Pages Function: POST /api/admin/label-device

  Sets a human-friendly label for whichever device a license is currently
  bound to (e.g. "Front counter PC", "Manager's laptop"). Purely cosmetic
  -- stored in the licenses.device_label column that's existed unused since
  0001_init.sql -- so the admin table can show something more useful than
  "bound" once a customer has more than one machine over time.

  Body: { adminSecret, licenseKey, deviceLabel }
*/

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse({ ok: false, error: "Not authorized." }, 401);
    }

    const licenseKey = (body.licenseKey || "").trim();
    if (!licenseKey) {
      return jsonResponse({ ok: false, error: "Missing licenseKey." }, 400);
    }

    const db = context.env.DB;
    const license = await db.prepare("SELECT id FROM licenses WHERE license_key = ?").bind(licenseKey).first();
    if (!license) {
      return jsonResponse({ ok: false, error: "That license key wasn't found." }, 404);
    }

    const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.trim() : "";
    await db.prepare("UPDATE licenses SET device_label = ? WHERE id = ?").bind(deviceLabel || null, license.id).run();

    return jsonResponse({ ok: true, licenseKey, deviceLabel });
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
