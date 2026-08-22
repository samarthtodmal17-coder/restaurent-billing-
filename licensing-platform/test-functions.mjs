// Verification harness for the four Pages Functions in functions/api/ --
// NOT shipped/deployed. Mocks Cloudflare's D1Database JS interface
// (prepare/bind/first/run/all) against a real SQLite database (node:sqlite)
// running the actual migrations/0001_init.sql schema, then calls the real
// onRequestPost handlers with real Request objects -- so this exercises
// the actual deployed code, not a re-implementation of it.
//
// Run with: node --experimental-sqlite test-functions.mjs

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const sqliteDb = new DatabaseSync(":memory:");
sqliteDb.exec("PRAGMA foreign_keys = ON;"); // D1 enforces FKs by default; mirror that here
for (const file of ["0001_init.sql", "0002_add_backup_tracking.sql", "0003_add_license_expiry.sql", "0004_notes_and_sale_price.sql", "0005_trial_flag.sql"]) {
  sqliteDb.exec(fs.readFileSync(new URL(`./migrations/${file}`, import.meta.url), "utf8"));
}

// D1Database-shaped mock: prepare(sql) -> { bind(...args) -> { first(), run(), all() } }
function makeD1Mock() {
  return {
    prepare(sql) {
      return {
        _sql: sql,
        _args: [],
        bind(...args) { this._args = args; return this; },
        async first() {
          const stmt = sqliteDb.prepare(this._sql);
          const row = stmt.get(...this._args);
          return row === undefined ? null : row;
        },
        async run() {
          const stmt = sqliteDb.prepare(this._sql);
          const info = stmt.run(...this._args);
          return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
        },
        async all() {
          const stmt = sqliteDb.prepare(this._sql);
          const rows = stmt.all(...this._args);
          return { results: rows, success: true };
        }
      };
    }
  };
}

const ADMIN_SECRET = "test-secret-123";
const env = { DB: makeD1Mock(), ADMIN_SECRET };

const activate = await import("./functions/api/activate.js");
const issue = await import("./functions/api/admin/issue.js");
const revoke = await import("./functions/api/admin/revoke.js");
const list = await import("./functions/api/admin/list.js");
const products = await import("./functions/api/admin/products.js");

function makeContext(body) {
  return { env, request: { json: async () => body } };
}
async function callJson(handlerModule, body) {
  const res = await handlerModule.onRequestPost(makeContext(body));
  const status = res.status;
  const data = await res.json();
  return { status, data };
}

const results = { pass: 0, fail: 0 };
function check(label, cond, extra) {
  if (cond) { results.pass++; console.log("PASS -", label); }
  else { results.fail++; console.log("FAIL -", label, extra !== undefined ? JSON.stringify(extra) : ""); }
}

(async () => {
  // 1. Register a product
  let r = await callJson(products, { adminSecret: ADMIN_SECRET, action: "create", id: "restaurant-pos", name: "Restaurant POS", currentVersion: "0.1.0" });
  check("product create ok", r.status === 200 && r.data.ok === true, r.data);

  r = await callJson(products, { adminSecret: ADMIN_SECRET, action: "list" });
  check("product list has 1 product", r.data.ok && r.data.products.length === 1 && r.data.products[0].id === "restaurant-pos", r.data);

  // 2. Wrong admin secret is rejected everywhere
  r = await callJson(issue, { adminSecret: "wrong", productId: "restaurant-pos", customerName: "X" });
  check("issue rejects wrong admin secret", r.status === 401);

  // 3. Issue a license for a new customer
  r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Spice Route Kitchen", customerEmail: "owner@spiceroute.test", tier: "Standard" });
  check("issue succeeds", r.status === 200 && r.data.ok === true, r.data);
  const licenseKey = r.data.licenseKey;
  const customerId = r.data.customerId;
  check("issued key matches REST-XXXX-XXXX-XXXX format", /^REST-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey), licenseKey);

  // 4. Issue a second license for the SAME customer, different (hypothetical) product would need
  //    that product registered too -- here we just prove customerId reuse works for the same product.
  r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerId, tier: "Standard" });
  check("issue with existing customerId reuses customer (no new customer row)", r.status === 200 && r.data.customerId === customerId, r.data);

  // 5. Unknown product is rejected
  r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "does-not-exist", customerName: "X" });
  check("issue rejects unknown productId", r.status === 400 && !r.data.ok);

  // 6. Activate on device A -- first activation succeeds
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.0", dbVersion: "1" });
  check("first activation succeeds", r.status === 200 && r.data.ok === true && r.data.customerName === "Spice Route Kitchen", r.data);

  // 7. Same device checking in again -- heartbeat, still ok
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.1", dbVersion: "1" });
  check("same-device re-check-in (heartbeat) succeeds", r.status === 200 && r.data.ok === true, r.data);

  // 8. Different device -- denied
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-B", appVersion: "0.1.0", dbVersion: "1" });
  check("different-device activation denied with 409", r.status === 409 && r.data.ok === false, r.data);

  // 9. Wrong product for a real key -- not found (proves the productId filter in the query works)
  await callJson(products, { adminSecret: ADMIN_SECRET, action: "create", id: "inventory", name: "Inventory" });
  r = await callJson(activate, { licenseKey, productId: "inventory", deviceId: "device-A", appVersion: "0.1.0", dbVersion: "1" });
  check("activation against wrong productId is 404", r.status === 404, r.data);

  // 10. Revoke, then activation is denied even from the original device
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey, action: "revoke" });
  check("revoke succeeds", r.status === 200 && r.data.status === "revoked", r.data);
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.1", dbVersion: "1" });
  check("revoked license denies even the original device", r.status === 403 && r.data.revoked === true, r.data);

  // 11. Reactivate -- device lock still intact, original device works again
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey, action: "reactivate" });
  check("reactivate succeeds", r.status === 200 && r.data.status === "active", r.data);
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.1", dbVersion: "1" });
  check("original device works again after reactivate", r.status === 200 && r.data.ok === true, r.data);
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-B", appVersion: "0.1.0", dbVersion: "1" });
  check("device lock still enforced after reactivate (device-B still denied)", r.status === 409, r.data);

  // 12. Unbind -- device lock cleared, a NEW device can now claim the key
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey, action: "unbind" });
  check("unbind succeeds and clears deviceId", r.status === 200 && r.data.deviceId === null, r.data);
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-C", appVersion: "0.2.0", dbVersion: "1" });
  check("new device can claim the key after unbind", r.status === 200 && r.data.ok === true, r.data);
  r = await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.1", dbVersion: "1" });
  check("old device (device-A) is now denied post-unbind, since device-C claimed it", r.status === 409, r.data);

  // 13. Admin list / summary
  r = await callJson(list, { adminSecret: ADMIN_SECRET });
  check("admin list returns licenses", r.data.ok && r.data.licenses.length === 2, r.data.licenses && r.data.licenses.length);
  check("admin list summary counts active licenses", r.data.summary.active === 2, r.data.summary);
  check("admin list summary counts unique customers", r.data.summary.uniqueCustomers === 1, r.data.summary);

  r = await callJson(list, { adminSecret: ADMIN_SECRET, productId: "inventory" });
  check("admin list filters by productId (0 results for unrelated product)", r.data.ok && r.data.licenses.length === 0, r.data);

  // 14. Issue a license that already expired yesterday -- activation must be denied
  r = await callJson(issue, {
    adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Already Expired Cafe",
    expiresAt: new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  });
  check("issuing with a past expiresAt succeeds (server doesn't reject it up front)", r.status === 200 && r.data.ok, r.data);
  const expiredKey = r.data.licenseKey;
  r = await callJson(activate, { licenseKey: expiredKey, productId: "restaurant-pos", deviceId: "device-X", appVersion: "0.1.0", dbVersion: "1" });
  check("activation denied for an already-expired license", r.status === 403 && r.data.expired === true, r.data);

  // 15. Issue with durationDays, confirm expiresAt is set in the future, activation succeeds
  r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Fresh Subscriber", durationDays: 30 });
  check("issuing with durationDays sets a future expiresAt", r.data.ok && new Date(r.data.expiresAt).getTime() > Date.now(), r.data);
  const subKey = r.data.licenseKey;
  r = await callJson(activate, { licenseKey: subKey, productId: "restaurant-pos", deviceId: "device-Y", appVersion: "0.1.0", dbVersion: "1" });
  check("activation succeeds for a license that hasn't expired yet", r.status === 200 && r.data.ok === true, r.data);

  // 16. Renew the already-expired license by extendDays -- should become active again
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: expiredKey, action: "renew", extendDays: 365 });
  check("renew with extendDays succeeds and returns a future expiresAt", r.status === 200 && r.data.ok && new Date(r.data.expiresAt).getTime() > Date.now(), r.data);
  r = await callJson(activate, { licenseKey: expiredKey, productId: "restaurant-pos", deviceId: "device-X", appVersion: "0.1.0", dbVersion: "1" });
  check("previously-expired license activates fine after renewal", r.status === 200 && r.data.ok === true, r.data);

  // 17. Renew with an explicit newExpiresAt
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: subKey, action: "renew", newExpiresAt: "2099-01-01" });
  check("renew with an explicit newExpiresAt sets that exact date", r.status === 200 && r.data.expiresAt.slice(0, 4) === "2099", r.data);

  // 18. Renew with newExpiresAt: "" clears expiry -> lifetime license
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: subKey, action: "renew", newExpiresAt: "" });
  check("renew with an empty newExpiresAt clears expiry (lifetime)", r.status === 200 && r.data.expiresAt === null, r.data);
  const rowAfterClear = sqliteDb.prepare("SELECT expires_at FROM licenses WHERE license_key = ?").get(subKey);
  check("cleared expiry is actually NULL in the database", rowAfterClear.expires_at === null, rowAfterClear);

  // 19. Renew with neither extendDays nor newExpiresAt is rejected
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: subKey, action: "renew" });
  check("renew with no date info is rejected with 400", r.status === 400 && !r.data.ok, r.data);

  // 20. admin list summary counts expired licenses separately from active
  r = await callJson(list, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos" });
  check("admin list summary has an expired count field", typeof r.data.summary.expired === "number", r.data.summary);

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch(err => { console.error("HARNESS ERROR:", err); process.exit(1); });
