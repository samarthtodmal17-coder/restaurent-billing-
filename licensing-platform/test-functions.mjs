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

const schema = fs.readFileSync(new URL("./migrations/0001_init.sql", import.meta.url), "utf8");
const sqliteDb = new DatabaseSync(":memory:");
sqliteDb.exec("PRAGMA foreign_keys = ON;"); // D1 enforces FKs by default; mirror that here
sqliteDb.exec(schema);

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

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch(err => { console.error("HARNESS ERROR:", err); process.exit(1); });
