// Standalone verification harness for www/db.js -- NOT shipped to customers.
// Mocks window.__TAURI__.sql.Database against a real SQLite file (via
// Node's built-in node:sqlite) so loadData()/saveData() run for real,
// against the real migrations/0001_init.sql schema, with no Tauri runtime
// needed. Run with: node --experimental-sqlite test-db-adapter.mjs

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import vm from "node:vm";

const schema = fs.readFileSync(new URL("./src-tauri/migrations/0001_init.sql", import.meta.url), "utf8");
const dbJsSource = fs.readFileSync(new URL("./www/db.js", import.meta.url), "utf8");

const sqliteDb = new DatabaseSync(":memory:");
sqliteDb.exec(schema);

// Translate plugin-sql's $1,$2... placeholders to node:sqlite's ? style,
// in positional order, and adapt the sync node:sqlite API to the async
// {execute, select} shape tauri-plugin-sql's JS client exposes.
function toPositional(sql) {
  return sql.replace(/\$(\d+)/g, "?");
}
const mockDb = {
  execute: async (sql, params = []) => {
    if (sql.trim() === "BEGIN" || sql.trim() === "COMMIT" || sql.trim() === "ROLLBACK") {
      sqliteDb.exec(sql.trim());
      return { rowsAffected: 0 };
    }
    const stmt = sqliteDb.prepare(toPositional(sql));
    const info = stmt.run(...params);
    return { rowsAffected: info.changes, lastInsertId: info.lastInsertRowid };
  },
  select: async (sql, params = []) => {
    const stmt = sqliteDb.prepare(toPositional(sql));
    return stmt.all(...params);
  }
};

// Minimal stand-ins for the app-scope things db.js expects to already be
// in closure scope when it's spliced into index.html's IIFE.
function uid(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 10); }
const defaultData = {
  business: { name: "My Business", logo: "", address: "", phone: "", footer: "Thank you for your visit!",
    currency: "₹", taxLabel: "Tax", taxPercent: 0, serviceChargePercent: 0, billPrefix: "INV",
    receiptPaperWidth: "58", receiptPaperWidthCustom: 58, kotPaperWidth: "58", kotPaperWidthCustom: 58,
    packingChargeType: "amount", packingChargeValue: 0, rawBtAutoPrint: false, dailySeq: 1,
    lastBillDateKey: "", upiId: "", showUpiQr: false },
  categories: [{id:"cat1", name:"Food"}, {id:"cat2", name:"Drinks"}],
  subcategories: [], menuItems: [],
  tables: [{id:"tbl1", name:"T1"}, {id:"tbl2", name:"T2"}],
  openOrders: [], bills: [], deletedBillsLog: [], creditPayments: [], nextItemCode: 101
};
function mergeWithDefaults(parsed){
  parsed.business = Object.assign({}, defaultData.business, parsed.business || {});
  parsed.categories = parsed.categories || defaultData.categories;
  parsed.subcategories = parsed.subcategories || [];
  parsed.menuItems = parsed.menuItems || [];
  parsed.openOrders = parsed.openOrders || [];
  parsed.bills = parsed.bills || [];
  parsed.deletedBillsLog = parsed.deletedBillsLog || [];
  parsed.creditPayments = parsed.creditPayments || [];
  parsed.nextItemCode = parsed.nextItemCode || 101;
  parsed.tables = parsed.tables || defaultData.tables;
  return parsed;
}

// A realistic populated `data` object exercising every table: a menu item
// with variants, a plain-price item, an open order with a line item, a
// finished bill with an edit history entry, a deleted bill, a credit
// payment with an allocation.
const sampleData = {
  business: Object.assign({}, defaultData.business, { name: "Spice Route Kitchen", taxPercent: 5, dailySeq: 7 }),
  categories: [{id:"cat1", name:"Food"}, {id:"cat2", name:"Drinks"}],
  subcategories: [{id:"sub1", categoryId:"cat1", name:"Starters"}],
  tables: [{id:"tbl1", name:"T1"}, {id:"tbl2", name:"T2"}],
  menuItems: [
    {id:"item1", code:"101", name:"Paneer Tikka", categoryId:"cat1", subcategoryId:"sub1", price: 220, taxPercent: 5, favorite: true},
    {id:"item2", code:"102", name:"Masala Chai", categoryId:"cat2", subcategoryId: null,
     variants: [{label:"Small", price: 20}, {label:"Large", price: 35}], outOfStock: true}
  ],
  openOrders: [{
    id:"order1", tableId:"tbl2", table:"T2", customer:"Walk-in", customerPhone:"",
    items: [{itemId:"item1", variantId:null, name:"Paneer Tikka", price:220, qty:2, taxPercent:5,
             categoryId:"cat1", categoryName:"Food", subcategoryId:"sub1", subcategoryName:"Starters", rateEdited:false}],
    discountValue:0, discountType:"amount", paymentMode:"Cash", splitEnabled:false, splitPayments:null,
    isParcel:false, packingChargeOverride:null, kotSent:{}, createdAt:new Date().toISOString()
  }],
  bills: [{
    id:"bill1", billNo:"INV-0006", date:new Date().toISOString(), table:"T1", tableId:"tbl1",
    customer:"", customerPhone:"", paymentMode:"Cash", splitPayments:null, isCredit:false,
    items:[{itemId:"item2", variantId:"item2-v1", name:"Masala Chai (Large)", price:35, qty:1, taxPercent:5,
             categoryId:"cat2", categoryName:"Drinks", subcategoryId:null, subcategoryName:"", rateEdited:false}],
    subtotal:35, discountAmount:0, discountValue:0, discountType:"amount", taxLabel:"Tax", taxPercent:5,
    tax:1.75, taxByRate:{"5":1.75}, serviceChargePercent:0, service:0, isParcel:false, packingCharge:0,
    total:36.75, currency:"₹",
    editHistory: [{editedAt:new Date().toISOString(), previousItems:[], previousTotal:30, previousDiscountAmount:0,
                    previousTable:"T1", previousCustomer:"", previousPaymentMode:"Cash"}]
  }],
  deletedBillsLog: [Object.assign({}, {
    id:"del1", originalBillId:"bill-old", billNo:"INV-0003", date:new Date().toISOString(), total:150,
    items: [], deletedAt: new Date().toISOString()
  })],
  creditPayments: [{
    id:"cpay1", key:"9999999999", name:"Regular Customer", phone:"9999999999", amount:100, mode:"Cash",
    note:"", date:new Date().toISOString(), allocations:[{billId:"bill1", billNo:"INV-0006", amount:100}]
  }],
  nextItemCode: 103
};

// Build a sandbox context that mimics the IIFE scope db.js expects, plus
// the mocked window.__TAURI__ surface, then run db.js's source in it.
const sandbox = {
  data: sampleData,
  defaultData, mergeWithDefaults, uid,
  window: { __TAURI__: { core: { invoke: async () => "backup skipped in test" }, sql: { Database: { load: async () => mockDb } } } },
  console,
  Promise, JSON,
  setTimeout // in case anything schedules a microtask via it
};
vm.createContext(sandbox);
vm.runInContext(dbJsSource + "\n; this.__loadData = loadData; this.__saveData = saveData;", sandbox);

const results = { pass: 0, fail: 0 };
function check(label, cond, extra) {
  if (cond) { results.pass++; console.log("PASS -", label); }
  else { results.fail++; console.log("FAIL -", label, extra !== undefined ? JSON.stringify(extra) : ""); }
}

(async () => {
  await sandbox.__saveData();
  // saveData() is chained/async internally; give its promise chain a tick
  await new Promise(r => setTimeout(r, 50));

  const loaded = await sandbox.__loadData();

  check("business.name round-trips", loaded.business.name === "Spice Route Kitchen");
  check("business.taxPercent round-trips (number)", loaded.business.taxPercent === 5);
  check("2 categories loaded", loaded.categories.length === 2);
  check("1 subcategory loaded", loaded.subcategories.length === 1);
  check("2 tables loaded", loaded.tables.length === 2);
  check("2 menu items loaded", loaded.menuItems.length === 2);

  const simpleItem = loaded.menuItems.find(i => i.id === "item1");
  check("simple item has price, no variants", simpleItem && simpleItem.price === 220 && !simpleItem.variants, simpleItem);
  check("simple item favorite=true", simpleItem && simpleItem.favorite === true);

  const variantItem = loaded.menuItems.find(i => i.id === "item2");
  check("variant item has 2 variants, no top-level price", variantItem && variantItem.variants && variantItem.variants.length === 2 && variantItem.price === undefined, variantItem);
  check("variant item outOfStock=true", variantItem && variantItem.outOfStock === true);

  check("1 open order loaded", loaded.openOrders.length === 1);
  const order = loaded.openOrders[0];
  check("order has 1 line item", order && order.items.length === 1, order);
  check("order line item name correct", order && order.items[0].name === "Paneer Tikka");
  check("order kotSent parsed back to object", order && typeof order.kotSent === "object");

  check("1 bill loaded", loaded.bills.length === 1);
  const bill = loaded.bills[0];
  check("bill total correct", bill && bill.total === 36.75, bill && bill.total);
  check("bill has 1 line item", bill && bill.items.length === 1, bill && bill.items);
  check("bill taxByRate parsed back to object", bill && bill.taxByRate && bill.taxByRate["5"] === 1.75, bill && bill.taxByRate);
  check("bill editHistory has 1 entry", bill && bill.editHistory && bill.editHistory.length === 1, bill && bill.editHistory);

  check("1 deleted bill in log", loaded.deletedBillsLog.length === 1);
  check("deleted bill snapshot intact", loaded.deletedBillsLog[0].billNo === "INV-0003", loaded.deletedBillsLog[0]);

  check("1 credit payment loaded", loaded.creditPayments.length === 1);
  const cpay = loaded.creditPayments[0];
  check("credit payment has 1 allocation", cpay && cpay.allocations.length === 1, cpay);
  check("credit payment allocation amount correct", cpay && cpay.allocations[0].amount === 100);

  check("nextItemCode round-trips", loaded.nextItemCode === 103, loaded.nextItemCode);

  // Second save/load cycle -- catches bugs that only show up on UPDATE-style
  // re-saves (e.g. stale rows not cleared), not just first insert.
  sampleData.menuItems[0].outOfStock = true;
  sampleData.bills[0].total = 999;
  await sandbox.__saveData();
  await new Promise(r => setTimeout(r, 50));
  const loaded2 = await sandbox.__loadData();
  check("second save: menu item mutation persisted", loaded2.menuItems.find(i=>i.id==="item1").outOfStock === true);
  check("second save: bill mutation persisted, no duplicate bills", loaded2.bills.length === 1 && loaded2.bills[0].total === 999, loaded2.bills);
  check("second save: no duplicate categories/tables after resync", loaded2.categories.length === 2 && loaded2.tables.length === 2);

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch(err => { console.error("HARNESS ERROR:", err); process.exit(1); });
