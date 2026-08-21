/*
  Cloudflare Pages Function: POST /api/admin/revoke

  Same three actions as the PWA's KV-backed version, now against D1:

    - "revoke"     -> status = 'revoked'. Blocks the app on its next
                       check-in (see activate.js).
    - "reactivate" -> status = 'active' again, device lock untouched --
                       use when a revoke was a mistake and the customer
                       is still on the same device.
    - "unbind"     -> clears device_id/activated_at, status untouched.
                       The lost/broken/replaced-device case: the same key
                       can be activated fresh on a new device. If the old
                       device is somehow still running, it fails its next
                       check-in and re-locks itself automatically.

  Body: { adminSecret, licenseKey, action }
*/

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse({ ok: false, error: "Not authorized." }, 401);
    }

    const licenseKey = (body.licenseKey || "").trim();
    const action = (body.action || "").trim();
    const validActions = ["revoke", "reactivate", "unbind"];
    if (!licenseKey || !validActions.includes(action)) {
      return jsonResponse({ ok: false, error: "Missing license key or action." }, 400);
    }

    const db = context.env.DB;
    const license = await db.prepare(
      `SELECT licenses.*, customers.name AS customer_name
       FROM licenses JOIN customers ON customers.id = licenses.customer_id
       WHERE licenses.license_key = ?`
    ).bind(licenseKey).first();

    if (!license) {
      return jsonResponse({ ok: false, error: "That license key wasn't found." }, 404);
    }

    const now = new Date().toISOString();
    let newStatus = license.status;
    let newDeviceId = license.device_id;
    let newActivatedAt = license.activated_at;
    let newUnboundAt = license.unbound_at;

    if (action === "revoke") {
      newStatus = "revoked";
      await db.prepare("UPDATE licenses SET status = 'revoked', status_changed_at = ? WHERE id = ?")
        .bind(now, license.id).run();
    } else if (action === "reactivate") {
      newStatus = "active";
      await db.prepare("UPDATE licenses SET status = 'active', status_changed_at = ? WHERE id = ?")
        .bind(now, license.id).run();
    } else if (action === "unbind") {
      newDeviceId = null;
      newActivatedAt = null;
      newUnboundAt = now;
      await db.prepare("UPDATE licenses SET device_id = NULL, activated_at = NULL, unbound_at = ? WHERE id = ?")
        .bind(now, license.id).run();
    }

    await db.prepare(
      "INSERT INTO license_events (license_id, event_type, detail, created_at) VALUES (?, ?, ?, ?)"
    ).bind(license.id, action === "revoke" ? "revoked" : action === "reactivate" ? "reactivated" : "unbound", "", now).run();

    return jsonResponse({
      ok: true,
      licenseKey,
      customerName: license.customer_name,
      status: newStatus,
      deviceId: newDeviceId
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
