/*
  Cloudflare Pages Function: POST /api/activate

  Central, multi-product version of the activation endpoint originally
  built for the single-product PWA (KV-backed). Same core behavior --
  first device to submit a key claims it, later devices are denied,
  revoked keys are denied -- but now backed by D1 so one customer's
  licenses across several products live in one place, and a plain SQL
  join can answer "what does this customer own" for the admin dashboard.

  Body: { licenseKey, productId, deviceId, appVersion, dbVersion }

  This same endpoint doubles as the periodic health check-in: if the
  submitted deviceId already matches the one on file, this call is
  treated as a heartbeat (updates last_checkin_at/app_version/db_version)
  rather than a fresh activation.
*/

export async function onRequestOptions(context) {
  // The desktop app's webview calls this endpoint from a different origin
  // (e.g. tauri://localhost), so the browser sends a CORS preflight OPTIONS
  // request before the real POST. Without this handler and the headers
  // below, the browser silently blocks the response and the app sees it
  // as a network failure even though the server actually responded fine.
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const licenseKey = (body.licenseKey || "").trim();
    const productId = (body.productId || "").trim();
    const deviceId = (body.deviceId || "").trim();
    const appVersion = (body.appVersion || "").trim() || null;
    const dbVersion = (body.dbVersion || "").trim() || null;

    if (!licenseKey || !productId || !deviceId) {
      return jsonResponse({ ok: false, error: "Missing licenseKey, productId, or deviceId." }, 400);
    }

    const db = context.env.DB;
    const license = await db.prepare(
      `SELECT licenses.*, customers.name AS customer_name
       FROM licenses JOIN customers ON customers.id = licenses.customer_id
       WHERE licenses.license_key = ? AND licenses.product_id = ?`
    ).bind(licenseKey, productId).first();

    if (!license) {
      return jsonResponse({ ok: false, error: "That license key wasn't found for this product." }, 404);
    }

    if (license.status === "revoked") {
      await logEvent(db, license.id, "activation_denied", "revoked");
      return jsonResponse({ ok: false, revoked: true, error: "This license has been revoked. Contact support." }, 403);
    }

    const now = new Date().toISOString();

    if (!license.device_id) {
      // First activation -- claim the device.
      await db.prepare(
        `UPDATE licenses SET device_id = ?, activated_at = ?, app_version = ?, db_version = ?, last_checkin_at = ?
         WHERE id = ?`
      ).bind(deviceId, now, appVersion, dbVersion, now, license.id).run();
      await logEvent(db, license.id, "activated", deviceId);
      return jsonResponse({
        ok: true, licenseKey, customerName: license.customer_name, tier: license.tier, activatedAt: now
      });
    }

    if (license.device_id === deviceId) {
      // Same device checking in again -- heartbeat, not a fresh activation.
      await db.prepare(
        `UPDATE licenses SET app_version = ?, db_version = ?, last_checkin_at = ? WHERE id = ?`
      ).bind(appVersion, dbVersion, now, license.id).run();
      await logEvent(db, license.id, "heartbeat", appVersion || "");
      return jsonResponse({
        ok: true, licenseKey, customerName: license.customer_name, tier: license.tier, activatedAt: license.activated_at
      });
    }

    // Device mismatch -- this key is already claimed by a different device.
    await logEvent(db, license.id, "activation_denied", "device_mismatch:" + deviceId);
    return jsonResponse({ ok: false, error: "This license is already activated on a different device." }, 409);
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server error, please try again." }, 500);
  }
}

async function logEvent(db, licenseId, eventType, detail) {
  await db.prepare(
    `INSERT INTO license_events (license_id, event_type, detail, created_at) VALUES (?, ?, ?, ?)`
  ).bind(licenseId, eventType, detail || "", new Date().toISOString()).run();
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
