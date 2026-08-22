/*
  Cloudflare Pages Function: POST /api/backup/restore

  The other half of upload.js -- fetches the most recent cloud backup for
  a license so a NEW device (after the admin unbinds the old one and the
  customer activates on the replacement PC) can pull the customer's real
  data back down, instead of starting from an empty database. This is
  what makes the "new computer" story in platform-plan section 20 actually
  work end to end, rather than only removing the device lock.

  Body: { licenseKey, productId, deviceId }
  Returns: { ok, backupData, backedUpAt } where backupData is base64 --
  the frontend hands this straight to the save_cloud_backup_bytes Tauri
  command, then to the existing, already-tested restore_database_backup
  command (see src-tauri/src/main.rs).

  Security check is intentionally the SAME shape as upload.js: the calling
  device must already be the one bound to this active license. In the
  "new PC" flow this works naturally because the customer activates on
  the new device FIRST (which binds it), then restores -- so by the time
  this endpoint is called, deviceId already matches what's on file.
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

    if (!licenseKey || !productId || !deviceId) {
      return jsonResponse({ ok: false, error: "Missing licenseKey, productId, or deviceId." }, 400);
    }

    const db = context.env.DB;
    const license = await db.prepare(
      `SELECT id, customer_id, status, device_id, last_backup_at FROM licenses WHERE license_key = ? AND product_id = ?`
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

    const r2Key = `${license.customer_id}/${productId}/${licenseKey}/latest.db`;
    const obj = await context.env.BACKUPS.get(r2Key);
    if (!obj) {
      return jsonResponse({ ok: false, error: "No cloud backup found for this license yet." }, 404);
    }

    const bytes = new Uint8Array(await obj.arrayBuffer());
    const backupData = bytesToBase64(bytes);

    return jsonResponse({
      ok: true,
      backupData,
      backedUpAt: obj.customMetadata && obj.customMetadata.backedUpAt || license.last_backup_at || null
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server error, please try again." }, 500);
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
