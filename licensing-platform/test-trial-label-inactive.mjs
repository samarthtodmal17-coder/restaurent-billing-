// Verification harness for: trial licenses + Convert to Paid (issue.js's
// isTrial, revoke.js's clearTrial), device labels (label-device.js), and
// dashboard.js's inactiveCustomers list. Same node:sqlite-backed D1 mock
// pattern as the other test-*.mjs files -- exercises the real handlers.
//
// Run with: node --experimental-sqlite test-trial-label-inactive.mjs

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
const labelDevice = await import("./functions/api/admin/label-device.js");
const dashboard = await import("./functions/api/admin/dashboard.js");
const list = await import("./functions/api/admin/list.js");

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

  // --- trial licenses ---
  let r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Trial Kitchen", isTrial: true });
  check("trial with no explicit duration defaults to a 14-day expiry", r.data.isTrial === true && !!r.data.expiresAt, r.data);
  const trialDaysLeft = Math.round((new Date(r.data.expiresAt).getTime() - Date.now()) / 86400000);
  check("trial default expiry is ~14 days out", trialDaysLeft === 14, trialDaysLeft);
  const trialKey = r.data.licenseKey;

  let dbRow = sqliteDb.prepare("SELECT is_trial FROM licenses WHERE license_key = ?").get(trialKey);
  check("is_trial = 1 actually persisted in D1", dbRow.is_trial === 1, dbRow);

  // A trial with an explicit duration should NOT be overridden to 14 days.
  r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Trial With Custom Length", isTrial: true, durationDays: 30 });
  const customDaysLeft = Math.round((new Date(r.data.expiresAt).getTime() - Date.now()) / 86400000);
  check("explicit durationDays on a trial is respected, not forced to 14", customDaysLeft === 30, customDaysLeft);

  // Non-trial issue leaves is_trial at 0.
  r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Regular Customer" });
  check("regular (non-trial) issue returns isTrial: false", r.data.isTrial === false, r.data);

  // --- Convert to Paid (renew with clearTrial) ---
  r = await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: trialKey, action: "renew", extendDays: 365, clearTrial: true });
  check("convert-to-paid (renew + clearTrial) succeeds", r.status === 200 && r.data.ok === true && r.data.isTrial === false, r.data);
  dbRow = sqliteDb.prepare("SELECT is_trial, expires_at FROM licenses WHERE license_key = ?").get(trialKey);
  check("is_trial actually flipped to 0 in D1", dbRow.is_trial === 0, dbRow);

  // A plain renew (no clearTrial) on a still-trial license leaves is_trial untouched.
  let r4 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Another Trial", isTrial: true });
  await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey: r4.data.licenseKey, action: "renew", extendDays: 7 });
  dbRow = sqliteDb.prepare("SELECT is_trial FROM licenses WHERE license_key = ?").get(r4.data.licenseKey);
  check("renew without clearTrial leaves is_trial = 1 untouched", dbRow.is_trial === 1, dbRow);

  // --- device labels ---
  await callJson(activate, { licenseKey: trialKey, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.0", dbVersion: "1" });
  r = await callJson(labelDevice, { adminSecret: ADMIN_SECRET, licenseKey: trialKey, deviceLabel: "Front counter PC" });
  check("label-device succeeds", r.status === 200 && r.data.ok === true, r.data);
  dbRow = sqliteDb.prepare("SELECT device_label FROM licenses WHERE license_key = ?").get(trialKey);
  check("device_label actually persisted", dbRow.device_label === "Front counter PC", dbRow);

  r = await callJson(labelDevice, { adminSecret: ADMIN_SECRET, licenseKey: "NOPE-0000-0000-0000", deviceLabel: "x" });
  check("label-device 404s for an unknown license key", r.status === 404 && !r.data.ok, r.data);

  r = await callJson(list, { adminSecret: ADMIN_SECRET, search: trialKey });
  check("list.js surfaces the device_label", r.data.licenses[0].device_label === "Front counter PC", r.data.licenses[0]);

  // --- inactive customers ---
  // Backdate this license's last_checkin_at to 20 days ago, directly in D1
  // (simulating time passing -- the handler itself has no way to fast-forward).
  const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString();
  sqliteDb.prepare("UPDATE licenses SET last_checkin_at = ? WHERE license_key = ?").run(twentyDaysAgo, trialKey);

  r = await callJson(dashboard, { adminSecret: ADMIN_SECRET });
  check("dashboard flags the 20-day-stale license as inactive", r.data.inactiveCustomers.some(c => c.license_key === trialKey), r.data.inactiveCustomers);

  // A license checked in yesterday should NOT show up as inactive.
  await callJson(activate, { licenseKey: r4.data.licenseKey, productId: "restaurant-pos", deviceId: "device-B", appVersion: "0.1.0", dbVersion: "1" });
  r = await callJson(dashboard, { adminSecret: ADMIN_SECRET });
  check("a freshly-checked-in license is NOT flagged as inactive", !r.data.inactiveCustomers.some(c => c.license_key === r4.data.licenseKey), r.data.inactiveCustomers);

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch(err => { console.error("HARNESS ERROR:", err); process.exit(1); });
