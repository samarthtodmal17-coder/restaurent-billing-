// Smoke test for admin.html's client-side JS -- loads the real file into
// jsdom, stubs window.fetch with canned responses matching each endpoint's
// real shape, and drives the UI (login, tab switching, table render,
// opening the Manage License and Customer History overlays, running a
// renew action) to catch DOM/JS wiring bugs that a syntax check alone
// can't -- e.g. missing elements, bad selectors, listeners never attached.
//
// Run with: node test-admin-html-smoke.mjs   (needs jsdom, installed in /tmp)

import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";
import fs from "node:fs";

const html = fs.readFileSync(new URL("./admin.html", import.meta.url), "utf8");

const results = { pass: 0, fail: 0 };
function check(label, cond, extra) {
  if (cond) { results.pass++; console.log("PASS -", label); }
  else { results.fail++; console.log("FAIL -", label, extra !== undefined ? JSON.stringify(extra) : ""); }
}

const sampleLicense = {
  license_key: "REST-AAAA-BBBB-CCCC", tier: "Standard", status: "active",
  device_id: "dev-1", device_label: null, app_version: "0.1.0", db_version: "1",
  issued_at: new Date().toISOString(), activated_at: new Date().toISOString(),
  last_checkin_at: new Date().toISOString(), expires_at: null, last_backup_at: null,
  amount: 4999, currency: "INR", is_trial: 0,
  customer_id: "cust-1", customer_name: "Spice Route Kitchen",
  product_id: "restaurant-pos", product_name: "Restaurant POS"
};

const responses = {
  "/api/admin/products": { ok: true, products: [{ id: "restaurant-pos", name: "Restaurant POS" }] },
  "/api/admin/list": { ok: true, licenses: [sampleLicense], summary: { totalLicenses: 1, active: 1, expired: 0, revoked: 0, activatedDevices: 1, uniqueCustomers: 1 } },
  "/api/admin/dashboard": {
    ok: true,
    totals: { totalCustomers: 1, totalLicenses: 1, activeLicenses: 1, revokedLicenses: 0, expiredLicenses: 0 },
    expiringSoon: [{ license_key: "REST-EXP1", customer_name: "Expiring Co", product_name: "Restaurant POS", expires_at: new Date(Date.now() + 5 * 86400000).toISOString() }],
    inactiveCustomers: [{ license_key: "REST-INACT", customer_name: "Stale Co", product_name: "Restaurant POS", last_checkin_at: new Date(Date.now() - 20 * 86400000).toISOString() }],
    recentActivity: [{ event_type: "issued", created_at: new Date().toISOString(), customer_name: "Spice Route Kitchen", product_name: "Restaurant POS", license_key: "REST-AAAA-BBBB-CCCC" }],
    revenueThisMonth: [{ currency: "INR", total: 4999, count: 1 }],
    revenueAllTime: [{ currency: "INR", total: 4999, count: 1 }]
  },
  "/api/admin/customer-history": {
    ok: true,
    customer: { id: "cust-1", name: "Spice Route Kitchen", email: "owner@spiceroute.example", phone: "9998887777", notes: "Prefers WhatsApp." },
    licenses: [sampleLicense],
    events: [{ event_type: "issued", created_at: new Date().toISOString(), product_name: "Restaurant POS", license_key: "REST-AAAA-BBBB-CCCC", detail: "" }]
  },
  "/api/admin/revoke": { ok: true, licenseKey: "REST-AAAA-BBBB-CCCC", customerName: "Spice Route Kitchen", status: "active", deviceId: "dev-1", expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(), isTrial: false },
  "/api/admin/label-device": { ok: true, licenseKey: "REST-AAAA-BBBB-CCCC", deviceLabel: "Front counter PC" },
  "/api/admin/notes": { ok: true, customerId: "cust-1", notes: "Prefers WhatsApp." }
};

(async () => {
  const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable", url: "https://example.pages.dev/admin.html" });
  const { window } = dom;

  // Stub localStorage (jsdom's is fine, but start clean) and fetch.
  window.localStorage.clear();
  window.fetch = async (path, opts) => {
    const body = JSON.parse(opts.body);
    const data = responses[path];
    if (!data) throw new Error("No stub for " + path);
    return { json: async () => data };
  };
  window.navigator.clipboard = { writeText: async () => {} };

  // Wait for jsdom to finish parsing/executing the inline <script>.
  await new Promise((resolve) => {
    if (window.document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve);
  });

  const doc = window.document;
  const $ = (sel) => doc.querySelector(sel);

  // 1. Initial state: dashboard section active, others hidden.
  check("dashboard section starts active", $('.section[data-section="dashboard"]').classList.contains("active"));
  check("licenses section starts hidden", !$('.section[data-section="licenses"]').classList.contains("active"));

  // 2. Tab switching.
  $('.navBtn[data-section="licenses"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  check("clicking Licenses nav activates the licenses section", $('.section[data-section="licenses"]').classList.contains("active"));
  check("clicking Licenses nav deactivates the dashboard section", !$('.section[data-section="dashboard"]').classList.contains("active"));

  // 3. Login flow: type password, blur -> triggers loadEverything (products, dashboard, list).
  $("#adminSecret").value = "test-secret-123";
  $("#adminSecret").dispatchEvent(new window.Event("blur", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50)); // let the stubbed-fetch promise chains settle

  check("password gets saved to localStorage", window.localStorage.getItem("licensingAdminSecret_v1") === "test-secret-123");
  check("login note updates after login", $("#loginNote").textContent.indexOf("remembered") !== -1, $("#loginNote").textContent);
  check("product dropdown populated after login", $("#issueProduct").innerHTML.indexOf("Restaurant POS") !== -1);
  check("dashboard stats populated after login", $("#dashboardStats").innerHTML.indexOf("Customers") !== -1 || $("#dashboardStats").querySelectorAll(".statBox").length === 5, $("#dashboardStats").innerHTML.slice(0,200));
  check("dashboard expiring-soon list populated", $("#dashboardExpiring").textContent.indexOf("Expiring Co") !== -1);
  check("dashboard inactive-customers list populated", $("#dashboardInactive").textContent.indexOf("Stale Co") !== -1);
  check("license table populated with the sample row", $("#listTable tbody").textContent.indexOf("Spice Route Kitchen") !== -1);
  check("nav badge shows the license count", $("#navBadgeLicenses").textContent === "1", $("#navBadgeLicenses").textContent);

  // 4. Manage License overlay opens from the table row and shows real data.
  var manageBtn = $(".btnManage");
  check("a Manage button was rendered in the table", !!manageBtn);
  manageBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("manage overlay becomes visible", !$("#manageOverlay").classList.contains("hidden"));
  check("manage panel shows the correct license key", $("#manageBody").textContent.indexOf("REST-AAAA-BBBB-CCCC") !== -1);
  check("manage panel has a Renew button", !!$("#mRenew"));

  // 5. Run a renew action from inside the panel; confirm result shows and overlay refreshes.
  $("#mRenew").dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  check("renew shows a success result message", $("#manageResult").textContent.indexOf("Renewed") !== -1, $("#manageResult").textContent);

  // 6. Close Manage, open Customer History overlay via the History button.
  $("#btnCloseManage").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("manage overlay closes", $("#manageOverlay").classList.contains("hidden"));

  var historyBtn = $(".btnHistory");
  check("a History button was rendered in the table", !!historyBtn);
  historyBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  check("history overlay becomes visible", !$("#historyOverlay").classList.contains("hidden"));
  check("history panel shows the customer's notes", $("#historyBody").textContent.indexOf("Prefers WhatsApp") !== -1);
  check("history panel shows the customer ID", $("#historyBody").textContent.indexOf("cust-1") !== -1);

  // 7. Logout clears localStorage and the password field.
  $("#btnCloseHistory").dispatchEvent(new window.Event("click", { bubbles: true }));
  $("#btnLogout").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("logout clears localStorage", window.localStorage.getItem("licensingAdminSecret_v1") === null);
  check("logout clears the password field", $("#adminSecret").value === "");

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch((err) => { console.error("HARNESS ERROR:", err); process.exit(1); });
