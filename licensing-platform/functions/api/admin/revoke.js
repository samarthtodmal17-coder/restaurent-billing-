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
    - "renew"      -> sets/extends expires_at. Two ways to specify the new
                       expiry, via extra body fields:
                         extendDays: N   -- adds N days onto whichever is
                                            later, the current expiry or
                                            right now (so renewing early
                                            doesn't waste remaining time,
                                            and renewing after it already
                                            lapsed starts fresh from today
                                            rather than from the old date).
                         newExpiresAt: "YYYY-MM-DD" or "" -- sets an exact
                                            date, or clears expiry entirely
                                            (makes it a lifetime license)
                                            when passed as an empty string.
                         clearTrial: true -- also flips is_trial back to 0,
                                            i.e. "Convert to Paid": a trial
                                            license that's being renewed as
                                            a real paid one.

  Body: { adminSecret, licenseKey, action, extendDays?, newExpiresAt?, clearTrial? }
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
    const validActions = ["revoke", "reactivate", "unbind", "renew"];
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
    let newExpiresAt = license.expires_at;

    if (action === "renew") {
      const explicitDate = body.newExpiresAt;
      if (explicitDate !== undefined) {
        const trimmed = String(explicitDate).trim();
        if (trimmed === "") {
          newExpiresAt = null; // explicit clear -> lifetime license
        } else {
          const parsed = new Date(trimmed);
          if (isNaN(parsed.getTime())) {
            return jsonResponse({ ok: false, error: "newExpiresAt is not a valid date." }, 400);
          }
          newExpiresAt = parsed.toISOString();
        }
      } else if (body.extendDays) {
        const days = Number(body.extendDays);
        if (!Number.isFinite(days) || days <= 0) {
          return jsonResponse({ ok: false, error: "extendDays must be a positive number." }, 400);
        }
        const currentExpiry = license.expires_at ? new Date(license.expires_at).getTime() : 0;
        const base = Math.max(currentExpiry, Date.now());
        newExpiresAt = new Date(base + days * 86400000).toISOString();
      } else {
        return jsonResponse({ ok: false, error: "Provide either extendDays or newExpiresAt to renew." }, 400);
      }
      var clearTrial = !!body.clearTrial;
      await db.prepare(
        "UPDATE licenses SET expires_at = ?, status_changed_at = ?" + (clearTrial ? ", is_trial = 0" : "") + " WHERE id = ?"
      ).bind(newExpiresAt, now, license.id).run();
    } else if (action === "revoke") {
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

    // "renew" is intentionally NOT logged to license_events: that table's
    // event_type column has a CHECK constraint (see 0001_init.sql) that
    // SQLite/D1 can't cheaply widen without recreating the whole table,
    // and renews are already fully auditable via licenses.expires_at and
    // status_changed_at directly -- not worth that risk for a log entry.
    if (action !== "renew") {
      await db.prepare(
        "INSERT INTO license_events (license_id, event_type, detail, created_at) VALUES (?, ?, ?, ?)"
      ).bind(license.id, action === "revoke" ? "revoked" : action === "reactivate" ? "reactivated" : "unbound", "", now).run();
    }

    return jsonResponse({
      ok: true,
      licenseKey,
      customerName: license.customer_name,
      status: newStatus,
      deviceId: newDeviceId,
      expiresAt: newExpiresAt,
      isTrial: action === "renew" && clearTrial ? false : !!license.is_trial
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
