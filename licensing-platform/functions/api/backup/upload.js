/*
  Cloudflare Pages Function: POST /api/backup/upload

  Closes the "no off-machine backup" gap from the platform-plan audit
  (section 19): the desktop app already makes LOCAL backup copies on the
  same PC before every migration, but if that PC's disk dies, the local
  backups die with it. This endpoint gives every licensed device one place
  to push its current database to -- R2 -- so a "new PC, unbind, restore"
  recovery (section 20) actually has something to restore FROM.

  Body: { licenseKey, productId, deviceId, backupData }
  backupData is the SQLite file as a base64 string (see read_database_bytes
  in src-tauri/src/main.rs -- invoke() can only carry JSON, not raw bytes).

  Security model: only the device currently bound to an ACTIVE license for
  this exact product may push a backup for it -- the same license+device
  check used by /api/activate, so a stolen license key alone (without also
  controlling the bound device) can't read or overwrite anyone's backup.

  Storage layout in R2: one object per license, overwritten each time --
  "latest.db" under a path scoped to customer/product/license, so admin
  tooling can browse it by customer without needing a database join.
*/

export async function onRequestOptions(context) {
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
    const backupData = body.backupData || "";

    if (!licenseKey || !productId || !deviceId || !backupData) {
      return jsonResponse({ ok: false, error: "Missing licenseKey, productId, deviceId, or backupData." }, 400);
    }

    const db = context.env.DB;
    const license = await db.prepare(
      `SELECT id, customer_id, status, device_id FROM licenses WHERE license_key = ? AND product_id = ?`
    ).bind(licenseKey, productId).first();

    if (!license) {
      return jsonResponse({ ok: false, error: "License not found for this product." }, 404);
    }
    if (license.status === "revoked") {
      return jsonResponse({ ok: false, error: "This license has been revoked." }, 403);
    }
    if (license.device_id !== deviceId) {
      return jsonResponse({ ok: false, error: "This device is not the one bound to this license." }, 403);
    }

    let bytes;
    try {
      bytes = base64ToBytes(backupData);
    } catch (e) {
      return jsonResponse({ ok: false, error: "Corrupted backup data." }, 400);
    }

    const r2Key = `${license.customer_id}/${productId}/${licenseKey}/latest.db`;
    const now = new Date().toISOString();

    await context.env.BACKUPS.put(r2Key, bytes, {
      customMetadata: { backedUpAt: now, deviceId }
    });

    await db.prepare(`UPDATE licenses SET last_backup_at = ? WHERE id = ?`).bind(now, license.id).run();

    return jsonResponse({ ok: true, backedUpAt: now, sizeBytes: bytes.length });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server error, please try again." }, 500);
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
