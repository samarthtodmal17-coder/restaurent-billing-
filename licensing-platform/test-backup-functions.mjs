// Verification harness for functions/api/backup/{upload,restore}.js -- NOT
// shipped/deployed. Same approach as test-functions.mjs: mocks D1 against
// a real node:sqlite database running the actual migrations (0001 + 0002),
// mocks R2 with a plain in-memory Map that mimics the R2Bucket interface
// (put/get -> object with arrayBuffer()/customMetadata), then calls the
// real onRequestPost handlers with real Request-shaped objects.
//
// Run with: node --experimental-sqlite test-backup-functions.mjs

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

// Minimal R2Bucket-shaped mock: put(key, bytes, {customMetadata}) and
// get(key) -> null | { arrayBuffer(): Promise<ArrayBuffer>, customMetadata }.
function makeR2Mock() {
  const store = new Map();
  return {
    async put(key, bytes, opts) {
      store.set(key, { bytes: new Uint8Array(bytes), customMetadata: (opts && opts.customMetadata) || {} });
    },
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        customMetadata: entry.customMetadata,
        async arrayBuffer() { return entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.byteLength); }
      };
    }
  };
}

const ADMIN_SECRET = "test-secret-123";
const env = { DB: makeD1Mock(), BACKUPS: makeR2Mock(), ADMIN_SECRET };

const products = await import("./functions/api/admin/products.js");
const issue = await import("./functions/api/admin/issue.js");
const activate = await import("./functions/api/activate.js");
const revoke = await import("./functions/api/admin/revoke.js");
const upload = await import("./functions/api/backup/upload.js");
const restore = await import("./functions/api/backup/restore.js");

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

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, "binary").toString("base64");
}

(async () => {
  await callJson(products, { adminSecret: ADMIN_SECRET, action: "create", id: "restaurant-pos", name: "Restaurant POS", currentVersion: "0.1.0" });

  let r = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Spice Route Kitchen" });
  const licenseKey = r.data.licenseKey;

  // Activate on device-A first -- upload/restore require an already-bound device.
  await callJson(activate, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", appVersion: "0.1.0", dbVersion: "1" });

  const fakeDbBytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255]);
  const fakeDbBase64 = bytesToBase64(fakeDbBytes);

  // 1. Upload from the wrong (unbound) device is denied
  r = await callJson(upload, { licenseKey, productId: "restaurant-pos", deviceId: "device-B", backupData: fakeDbBase64 });
  check("upload denied from a device that isn't the bound one", r.status === 403 && !r.data.ok, r.data);

  // 2. Upload from the correct, bound device succeeds
  r = await callJson(upload, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", backupData: fakeDbBase64 });
  check("upload succeeds from the bound device", r.status === 200 && r.data.ok === true && r.data.sizeBytes === fakeDbBytes.length, r.data);

  // 3. Restore from the wrong device is denied
  r = await callJson(restore, { licenseKey, productId: "restaurant-pos", deviceId: "device-B" });
  check("restore denied from a device that isn't the bound one", r.status === 403 && !r.data.ok, r.data);

  // 4. Restore from the correct device returns the exact bytes uploaded
  r = await callJson(restore, { licenseKey, productId: "restaurant-pos", deviceId: "device-A" });
  check("restore succeeds and returns ok", r.status === 200 && r.data.ok === true, r.data);
  const roundTripBytes = Buffer.from(r.data.backupData, "base64");
  check("restored bytes exactly match what was uploaded", Buffer.compare(roundTripBytes, Buffer.from(fakeDbBytes)) === 0);

  // 5. Restore when no backup exists yet for a different (unbacked-up) license
  let r2 = await callJson(issue, { adminSecret: ADMIN_SECRET, productId: "restaurant-pos", customerName: "Second Restaurant" });
  const licenseKey2 = r2.data.licenseKey;
  await callJson(activate, { licenseKey: licenseKey2, productId: "restaurant-pos", deviceId: "device-Z", appVersion: "0.1.0", dbVersion: "1" });
  r = await callJson(restore, { licenseKey: licenseKey2, productId: "restaurant-pos", deviceId: "device-Z" });
  check("restore 404s when no cloud backup exists yet", r.status === 404 && !r.data.ok, r.data);

  // 6. Revoked license can neither upload nor restore
  await callJson(revoke, { adminSecret: ADMIN_SECRET, licenseKey, action: "revoke" });
  r = await callJson(upload, { licenseKey, productId: "restaurant-pos", deviceId: "device-A", backupData: fakeDbBase64 });
  check("upload denied once license is revoked", r.status === 403 && !r.data.ok, r.data);
  r = await callJson(restore, { licenseKey, productId: "restaurant-pos", deviceId: "device-A" });
  check("restore denied once license is revoked", r.status === 403 && !r.data.ok, r.data);

  // 7. last_backup_at got written to D1 by the successful upload in step 2
  const row = sqliteDb.prepare("SELECT last_backup_at FROM licenses WHERE license_key = ?").get(licenseKey);
  check("last_backup_at column was populated on successful upload", !!row.last_backup_at, row);

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch(err => { console.error("HARNESS ERROR:", err); process.exit(1); });
