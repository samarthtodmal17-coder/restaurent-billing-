// Verification harness for functions/api/admin/customer-history.js -- NOT
// shipped/deployed. Same node:sqlite-backed D1 mock approach as the other
// test-*.mjs files: applies the real migrations, then calls the real
// handler functions with real Request-shaped objects.
//
// Run with: node --experimental-sqlite test-customer-history.mjs

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const sqliteDb = new DatabaseSync(":memory:");
sqliteDb.exec("PRAGMA foreign_keys = ON;");
for (const file of ["0001_init.sql", "0002_add_backup_tracking.sql", "0003_add_license_expiry.sql", "0004_notes_and_sale_price.sql", "0005_trial_flag.sql"]) {
  sqliteDb.exec(fs.readFileSync(new URL(`./migrations/${file}`, import.meta.url), "utf8"));
}

function makeD1Mock() {
  return {
    prepare(sql) {
      return {
        _sql: sql,
        _args: [],
        bind(...args) { this._args = args; return this; },
        async first() {
          const row = sqliteDb.prepare(this._sql).get(...this._args);
          return row === undefined ? null : row;
        },
        async run() {
          const info = sqliteDb.prepare(this._sql).run(...this._args);
          return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
        },
        async all() {
          const rows = sqliteDb.prepare(this._sql).all(...this._args);
          return { results: rows, success: true };
        }
      };
    }
  };
}

const ADMIN_SECRET = "test-secret-123";
const env = { DB: makeD1Mock(), ADMIN_SECRET };

const products = await import("./functions/api/admin/products.js");
const issue = await import("./functions/api/admin/issue.js");
const activate = await import("./functions/api/activate.js");
const revoke = await import("./functions/api/admin/revoke.js");
const history = await import("./functions/api/admin/customer-history.js");

function makeContext(body) {
  return { env, request: { json: async () => body } };
}
async function callJson(handlerModule, body) {
  const res = await handlerModule.onRequestPost(makeContext(body));
  return { status: res.status, data: await res.json() };
}

const results = { pass: 0, fail: 0 };
function check(label, cond, extra) {
  if (cond) { results.pass++; console.log("PASS -", label); }
  else { results.fail++; console.log("FAIL -", label, extra !== undefined ? JSON.stringify(extra) : ""); }
}

(async () => {
  await callJson(products, { adminSecret: ADMIN_SECRET, action: "create", id: "restaurant-pos", name: "Restaurant POS", currentVersion: "0.1.0" });
  await callJson(products, { adminSecret: ADMIN_SECRET, action: "create", id: "inventory", name: "Inventory", currentVersion: "0.1.0" });

  // First license for a brand-new customer.
  let r1 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Spice Route Kitchen", customerEmail: "owner@spiceroute.example" });
  const customerId = r1.data.customerId;
  const key1 = r1.data.licenseKey;

  // Second license for the SAME customer, reusing customerId (multi-product scenario).
  let r2 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "inventory", customerId: customerId });
  const key2 = r2.data.licenseKey;
  check("second license reuses the same customerId", r2.data.customerId === customerId, r2.data);

  // Generate some events: activate key1, then revoke it, then reactivate.
  await callJson(activate, { licenseKey: key1, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.0", dbVersion: "1" });
  await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: key1, action: "revoke" });
  await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: key1, action: "reactivate" });

  // Unauthorized request is rejected.
  let r = await callJson(history, { adminSecret: "wrong", customerId });
  check("wrong admin secret is rejected", r.status === 401 && !r.data.ok, r.data);

  // Unknown customer ID 404s.
  r = await callJson(history, { adminSecret: ADMIN_SECRET, customerId: "cust_doesnotexist" });
  check("unknown customerId 404s", r.status === 404 && !r.data.ok, r.data);

  // Real lookup: customer record present with correct fields.
  r = await callJson(history, { adminSecret: ADMIN_SECRET, customerId });
  check("customer-history returns ok", r.status === 200 && r.data.ok === true, r.data);
  check("customer record has correct name/email", r.data.customer.name === "Spice Route Kitchen" && r.data.customer.email === "owner@spiceroute.example", r.data.customer);

  // Both licenses (across both products) show up.
  const licenseKeys = r.data.licenses.map(l => l.license_key).sort();
  check("both licenses across both products are listed", licenseKeys.length === 2 && licenseKeys.includes(key1) && licenseKeys.includes(key2), licenseKeys);

  // Events include issued (x2), activated, revoked, reactivated -- for key1's product only where relevant.
  const eventTypes = r.data.events.map(e => e.event_type);
  check("events include issued, activated, revoked, reactivated",
    eventTypes.includes("issued") && eventTypes.includes("activated") && eventTypes.includes("revoked") && eventTypes.includes("reactivated"),
    eventTypes);

  // Events are scoped to this customer only -- a second, unrelated customer's events must not leak in.
  let r3 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Second Restaurant" });
  await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: r3.data.licenseKey, action: "revoke" });
  r = await callJson(history, { adminSecret: ADMIN_SECRET, customerId });
  const leaked = r.data.events.some(e => e.license_key === r3.data.licenseKey);
  check("a different customer's events do not leak into this history", !leaked);

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch(err => { console.error("HARNESS ERROR:", err); process.exit(1); });
