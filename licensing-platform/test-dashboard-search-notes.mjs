// Verification harness for the dashboard bundle: functions/api/admin/dashboard.js,
// functions/api/admin/notes.js, and list.js's new `search` param, plus
// issue.js's new amount/currency fields feeding the revenue summary.
// Same node:sqlite-backed D1 mock pattern as the other test-*.mjs files.
//
// Run with: node --experimental-sqlite test-dashboard-search-notes.mjs

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
const list = await import("./functions/api/admin/list.js");
const notes = await import("./functions/api/admin/notes.js");
const dashboard = await import("./functions/api/admin/dashboard.js");
const revoke = await import("./functions/api/admin/revoke.js");

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

  // Issue a license with a sale price attached.
  let r1 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Spice Route Kitchen", customerEmail: "owner@spiceroute.example", customerPhone: "9998887777", amount: 4999, currency: "inr" });
  check("issue stores amount and uppercases currency", r1.data.amount === 4999 && r1.data.currency === "INR", r1.data);
  const customerId1 = r1.data.customerId;

  // Issue a second, unrelated license with no sale price.
  let r2 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Second Restaurant" });
  check("issue with no amount leaves amount/currency null", r2.data.amount === null && r2.data.currency === null, r2.data);

  // Issue a license expiring in 10 days, to exercise the dashboard's expiring-soon list.
  let r3 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Third Cafe", durationDays: 10 });

  // --- search ---
  let r = await callJson(list, { adminSecret: ADMIN_SECRET, search: "spice route" });
  check("search matches by customer name (case-insensitive)", r.data.licenses.length === 1 && r.data.licenses[0].customer_name === "Spice Route Kitchen", r.data.licenses);

  r = await callJson(list, { adminSecret: ADMIN_SECRET, search: "9998887777" });
  check("search matches by phone", r.data.licenses.length === 1 && r.data.licenses[0].customer_id === customerId1, r.data.licenses);

  r = await callJson(list, { adminSecret: ADMIN_SECRET, search: r2.data.licenseKey });
  check("search matches by license key", r.data.licenses.length === 1 && r.data.licenses[0].license_key === r2.data.licenseKey, r.data.licenses);

  r = await callJson(list, { adminSecret: ADMIN_SECRET, search: "no such customer anywhere" });
  check("search with no matches returns an empty list, not an error", r.data.ok === true && r.data.licenses.length === 0, r.data);

  // --- notes ---
  r = await callJson(notes, { adminSecret: ADMIN_SECRET, customerId: customerId1, notes: "Asked for a discount, prefers WhatsApp." });
  check("notes save succeeds", r.status === 200 && r.data.ok === true, r.data);

  const custRow = sqliteDb.prepare("SELECT notes FROM customers WHERE id = ?").get(customerId1);
  check("notes were actually written to the customers table", custRow.notes === "Asked for a discount, prefers WhatsApp.", custRow);

  r = await callJson(notes, { adminSecret: ADMIN_SECRET, customerId: "cust_doesnotexist", notes: "x" });
  check("notes save 404s for an unknown customer", r.status === 404 && !r.data.ok, r.data);

  // Notes can be cleared back to empty.
  r = await callJson(notes, { adminSecret: ADMIN_SECRET, customerId: customerId1, notes: "" });
  const clearedRow = sqliteDb.prepare("SELECT notes FROM customers WHERE id = ?").get(customerId1);
  check("notes can be cleared to empty/null", clearedRow.notes === null, clearedRow);

  // --- dashboard ---
  r = await callJson(dashboard, { adminSecret: "wrong" });
  check("dashboard rejects a wrong admin secret", r.status === 401 && !r.data.ok, r.data);

  r = await callJson(dashboard, { adminSecret: ADMIN_SECRET });
  check("dashboard returns ok", r.status === 200 && r.data.ok === true, r.data);
  check("dashboard totals count all 3 issued licenses", r.data.totals.totalLicenses === 3, r.data.totals);
  check("dashboard totals count 3 distinct customers", r.data.totals.totalCustomers === 3, r.data.totals);
  check("dashboard expiringSoon includes the 10-day license", r.data.expiringSoon.some(l => l.license_key === r3.data.licenseKey), r.data.expiringSoon);
  check("dashboard expiringSoon does NOT include the lifetime licenses", !r.data.expiringSoon.some(l => l.license_key === r1.data.licenseKey), r.data.expiringSoon);
  check("dashboard recentActivity includes 'issued' events", r.data.recentActivity.some(e => e.event_type === "issued"), r.data.recentActivity.length);
  check("dashboard revenueAllTime sums the one INR sale correctly", r.data.revenueAllTime.some(row => row.currency === "INR" && row.total === 4999 && row.count === 1), r.data.revenueAllTime);
  check("dashboard revenueThisMonth also reflects the same sale (issued today)", r.data.revenueThisMonth.some(row => row.currency === "INR" && row.total === 4999), r.data.revenueThisMonth);

  // Revoking a license updates activeLicenses/revokedLicenses on the dashboard.
  await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: r2.data.licenseKey, action: "revoke" });
  r = await callJson(dashboard, { adminSecret: ADMIN_SECRET });
  check("dashboard reflects a revoke immediately", r.data.totals.revokedLicenses === 1 && r.data.totals.activeLicenses === 2, r.data.totals);

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch(err => { console.error("HARNESS ERROR:", err); process.exit(1); });
