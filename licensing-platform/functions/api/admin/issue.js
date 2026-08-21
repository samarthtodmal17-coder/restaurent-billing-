/*
  Cloudflare Pages Function: POST /api/admin/issue

  Issues a new license, now product-aware: every key belongs to exactly
  one product_id, and can be attached to either a brand-new customer or
  an existing one (so a repeat customer buying a second product doesn't
  create a duplicate customer row).

  Body: {
    adminSecret,
    productId,               required, must already exist in `products`
    customerId,               optional -- attach to an existing customer
    customerName, customerEmail, customerPhone,  used only if customerId is omitted
    tier,                      optional
    licenseKey                 optional -- auto-generated if omitted
  }
*/

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const suppliedSecret = (body.adminSecret || "").trim();
    const realSecret = context.env.ADMIN_SECRET || "";
    if (!realSecret || suppliedSecret !== realSecret) {
      return jsonResponse({ ok: false, error: "Not authorized." }, 401);
    }

    const productId = (body.productId || "").trim();
    if (!productId) {
      return jsonResponse({ ok: false, error: "productId is required." }, 400);
    }

    const db = context.env.DB;
    const product = await db.prepare("SELECT id FROM products WHERE id = ? AND status = 'active'").bind(productId).first();
    if (!product) {
      return jsonResponse({ ok: false, error: "Unknown or discontinued productId." }, 400);
    }

    const now = new Date().toISOString();
    let customerId = (body.customerId || "").trim();

    if (customerId) {
      const existing = await db.prepare("SELECT id FROM customers WHERE id = ?").bind(customerId).first();
      if (!existing) {
        return jsonResponse({ ok: false, error: "customerId not found." }, 400);
      }
    } else {
      const customerName = (body.customerName || "").trim();
      if (!customerName) {
        return jsonResponse({ ok: false, error: "customerName is required when customerId is omitted." }, 400);
      }
      customerId = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO customers (id, name, email, phone, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(customerId, customerName, (body.customerEmail || "").trim() || null, (body.customerPhone || "").trim() || null, now).run();
    }

    let licenseKey = (body.licenseKey || "").trim();
    if (licenseKey) {
      const clash = await db.prepare("SELECT id FROM licenses WHERE license_key = ?").bind(licenseKey).first();
      if (clash) {
        return jsonResponse({ ok: false, error: "That license key is already in use." }, 400);
      }
    } else {
      licenseKey = await generateUniqueLicenseKey(db);
    }

    const licenseId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO licenses (id, license_key, customer_id, product_id, tier, status, issued_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`
    ).bind(licenseId, licenseKey, customerId, productId, (body.tier || "").trim() || null, now).run();

    await db.prepare(
      "INSERT INTO license_events (license_id, event_type, detail, created_at) VALUES (?, 'issued', ?, ?)"
    ).bind(licenseId, productId, now).run();

    return jsonResponse({ ok: true, licenseKey, customerId, licenseId });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server error, please try again." }, 500);
  }
}

async function generateUniqueLicenseKey(db) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  function block() {
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = "REST-" + block() + "-" + block() + "-" + block();
    const clash = await db.prepare("SELECT id FROM licenses WHERE license_key = ?").bind(key).first();
    if (!clash) return key;
  }
  throw new Error("Could not generate a unique license key after 5 attempts.");
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
