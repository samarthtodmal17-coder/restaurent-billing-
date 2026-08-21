/* ================= STORAGE ENGINE (SQLite via Tauri) - REFERENCE COPY =================
   This is a REFERENCE copy for readability/review. The actual, live version
   of this code has ALREADY been spliced into index.html (inside the same
   (function(){ "use strict"; ... })() IIFE that declares `data`), replacing
   the old IndexedDB block. This standalone file is not loaded by the app --
   index.html does not <script src="db.js">  it. If you change the storage
   logic, edit it in both places, or delete this file and treat index.html
   as the single source of truth (see README-PHASE1.md).
   ========================================================================= */

  var DB_URL = "sqlite:restaurant.db";
  var _dbHandle = null;

  function getDb(){
    if(_dbHandle) return Promise.resolve(_dbHandle);
    var backup = (window.__TAURI__ && window.__TAURI__.core)
      ? window.__TAURI__.core.invoke("backup_database_file").catch(function(e){
          console.error("pre-migration backup failed (continuing anyway)", e);
        })
      : Promise.resolve();
    return backup.then(function(){
      return window.__TAURI__.sql.Database.load(DB_URL);
    }).then(function(db){
      _dbHandle = db;
      return db;
    });
  }

  // ---- row <-> JS object helpers, shared by open_orders/order_items and bills/bill_items ----
  function lineItemRowToObj(r){
    return {
      itemId: r.item_id || null,
      variantId: r.variant_id || null,
      name: r.name,
      price: r.price,
      qty: r.qty,
      taxPercent: r.tax_percent,
      categoryId: r.category_id || null,
      categoryName: r.category_name,
      subcategoryId: r.subcategory_id || null,
      subcategoryName: r.subcategory_name || "",
      rateEdited: !!r.rate_edited
    };
  }

  // ================= LOAD =================
  function loadData(){
    return getDb().then(function(db){
      return Promise.all([
        db.select("SELECT * FROM business_settings WHERE id = 1"),
        db.select("SELECT id, name FROM categories ORDER BY sort_order, rowid"),
        db.select("SELECT id, category_id, name FROM subcategories"),
        db.select("SELECT id, name FROM tables ORDER BY sort_order, rowid"),
        db.select("SELECT * FROM menu_items"),
        db.select("SELECT * FROM menu_item_variants ORDER BY sort_order, rowid"),
        db.select("SELECT * FROM open_orders"),
        db.select("SELECT * FROM order_items ORDER BY sort_order, rowid"),
        db.select("SELECT * FROM bills WHERE deleted_at IS NULL"),
        db.select("SELECT * FROM bill_items ORDER BY sort_order, rowid"),
        db.select("SELECT * FROM bill_edit_history ORDER BY id"),
        db.select("SELECT * FROM deleted_bills_log ORDER BY deleted_at"),
        db.select("SELECT * FROM credit_payments"),
        db.select("SELECT * FROM credit_payment_allocations"),
        db.select("SELECT value FROM counters WHERE key = 'next_item_code'")
      ]).then(function(results){
        var biz = results[0][0] || {};
        var categoryRows = results[1];
        var subcategoryRows = results[2];
        var tableRows = results[3];
        var menuItemRows = results[4];
        var variantRows = results[5];
        var orderRows = results[6];
        var orderItemRows = results[7];
        var billRows = results[8];
        var billItemRows = results[9];
        var editHistRows = results[10];
        var deletedRows = results[11];
        var creditRows = results[12];
        var allocRows = results[13];
        var counterRows = results[14];

        var business = {
          name: biz.name, logo: biz.logo, address: biz.address, phone: biz.phone,
          footer: biz.footer, currency: biz.currency, taxLabel: biz.tax_label,
          taxPercent: biz.tax_percent, serviceChargePercent: biz.service_charge_percent,
          billPrefix: biz.bill_prefix, receiptPaperWidth: biz.receipt_paper_width,
          receiptPaperWidthCustom: biz.receipt_paper_width_custom, kotPaperWidth: biz.kot_paper_width,
          kotPaperWidthCustom: biz.kot_paper_width_custom, packingChargeType: biz.packing_charge_type,
          packingChargeValue: biz.packing_charge_value, rawBtAutoPrint: !!biz.rawbt_auto_print,
          dailySeq: biz.daily_seq, lastBillDateKey: biz.last_bill_date_key, upiId: biz.upi_id,
          showUpiQr: !!biz.show_upi_qr
        };

        var categories = categoryRows.map(function(r){ return {id: r.id, name: r.name}; });
        var subcategories = subcategoryRows.map(function(r){ return {id: r.id, categoryId: r.category_id, name: r.name}; });
        var tables = tableRows.map(function(r){ return {id: r.id, name: r.name}; });

        var variantsByItem = {};
        variantRows.forEach(function(v){
          (variantsByItem[v.menu_item_id] = variantsByItem[v.menu_item_id] || []).push({label: v.label, price: v.price});
        });
        var menuItems = menuItemRows.map(function(r){
          var item = {id: r.id, code: r.code, name: r.name, categoryId: r.category_id, subcategoryId: r.subcategory_id};
          if(r.photo) item.photo = r.photo;
          if(r.send_to_kitchen !== null && r.send_to_kitchen !== undefined) item.sendToKitchen = !!r.send_to_kitchen;
          if(r.favorite) item.favorite = true;
          if(r.out_of_stock) item.outOfStock = true;
          if(r.tax_percent !== null && r.tax_percent !== undefined) item.taxPercent = r.tax_percent;
          var vs = variantsByItem[r.id];
          if(vs && vs.length){ item.variants = vs; } else { item.price = r.price; }
          return item;
        });

        var itemsByOrder = {};
        orderItemRows.forEach(function(it){
          (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(lineItemRowToObj(it));
        });
        var openOrders = orderRows.map(function(o){
          var order = {
            id: o.id, tableId: o.table_id, table: o.table_name, customer: o.customer,
            customerPhone: o.customer_phone, items: itemsByOrder[o.id] || [],
            discountValue: o.discount_value, discountType: o.discount_type, paymentMode: o.payment_mode,
            splitEnabled: !!o.split_enabled, splitPayments: o.split_payments ? JSON.parse(o.split_payments) : null,
            isParcel: !!o.is_parcel, packingChargeOverride: o.packing_charge_override,
            kotSent: JSON.parse(o.kot_sent || "{}"), createdAt: o.created_at
          };
          if(o.editing_bill_id) order.editingBillId = o.editing_bill_id;
          return order;
        });

        var itemsByBill = {};
        billItemRows.forEach(function(it){
          (itemsByBill[it.bill_id] = itemsByBill[it.bill_id] || []).push(lineItemRowToObj(it));
        });
        var historyByBill = {};
        editHistRows.forEach(function(h){
          (historyByBill[h.bill_id] = historyByBill[h.bill_id] || []).push({
            editedAt: h.edited_at,
            previousItems: h.previous_items ? JSON.parse(h.previous_items) : [],
            previousTotal: h.previous_total,
            previousDiscountAmount: h.previous_discount_amount,
            previousTable: h.previous_table,
            previousCustomer: h.previous_customer,
            previousPaymentMode: h.previous_payment_mode
          });
        });
        var bills = billRows.map(function(b){
          var bill = {
            id: b.id, billNo: b.bill_no, date: b.date, table: b.table_name, tableId: b.table_id,
            customer: b.customer, customerPhone: b.customer_phone, paymentMode: b.payment_mode,
            splitPayments: b.split_payments ? JSON.parse(b.split_payments) : null,
            isCredit: !!b.is_credit, items: itemsByBill[b.id] || [], subtotal: b.subtotal,
            discountAmount: b.discount_amount, discountValue: b.discount_value, discountType: b.discount_type,
            taxLabel: b.tax_label, taxPercent: b.tax_percent, tax: b.tax,
            taxByRate: b.tax_by_rate ? JSON.parse(b.tax_by_rate) : undefined,
            serviceChargePercent: b.service_charge_percent, service: b.service, isParcel: !!b.is_parcel,
            packingCharge: b.packing_charge, total: b.total, currency: b.currency
          };
          if(b.is_credit) bill.creditPaid = b.credit_paid || 0;
          if(b.edited_at) bill.editedAt = b.edited_at;
          if(historyByBill[b.id]) bill.editHistory = historyByBill[b.id];
          return bill;
        });

        var deletedBillsLog = deletedRows.map(function(r){ return JSON.parse(r.bill_snapshot); });

        var allocByPayment = {};
        allocRows.forEach(function(a){
          (allocByPayment[a.credit_payment_id] = allocByPayment[a.credit_payment_id] || []).push({
            billId: a.bill_id, billNo: a.bill_no, amount: a.amount
          });
        });
        var creditPayments = creditRows.map(function(c){
          return {
            id: c.id, key: c.account_key, name: c.name, phone: c.phone, amount: c.amount,
            mode: c.mode, note: c.note, date: c.date, allocations: allocByPayment[c.id] || []
          };
        });

        var nextItemCode = (counterRows[0] && counterRows[0].value) || 101;

        return mergeWithDefaults({
          business: business, categories: categories, subcategories: subcategories,
          menuItems: menuItems, tables: tables, openOrders: openOrders, bills: bills,
          deletedBillsLog: deletedBillsLog, creditPayments: creditPayments, nextItemCode: nextItemCode
        });
      });
    }).catch(function(err){
      console.error("SQLite load failed, starting from an empty in-memory dataset", err);
      return JSON.parse(JSON.stringify(defaultData));
    });
  }

  // ================= SAVE =================
  // Full-resync save: on every call, wipes and rewrites every table from
  // the current in-memory `data` object, inside one transaction. Simpler
  // and much less error-prone than tracking per-field diffs across a
  // 6000-line app with dozens of call sites, and fast enough at normal
  // restaurant POS volume (tens of menu items, low hundreds of bills/day).
  // If this ever becomes a measurable perf issue at a very high-volume
  // site, the next step is targeted incremental writes per mutation --
  // not a reason to avoid shipping this first, correct version now.
  var _saveChain = Promise.resolve();
  function saveData(){
    itemCodeIndexCache = null;
    _saveChain = _saveChain.then(function(){ return doSave(); }).catch(function(err){
      console.error("SQLite save failed", err);
    });
    return _saveChain;
  }

  function doSave(){
    return getDb().then(function(db){
      return db.execute("BEGIN").then(function(){
        var biz = data.business;
        return db.execute(
          "UPDATE business_settings SET name=$1, logo=$2, address=$3, phone=$4, footer=$5, currency=$6, " +
          "tax_label=$7, tax_percent=$8, service_charge_percent=$9, bill_prefix=$10, receipt_paper_width=$11, " +
          "receipt_paper_width_custom=$12, kot_paper_width=$13, kot_paper_width_custom=$14, packing_charge_type=$15, " +
          "packing_charge_value=$16, rawbt_auto_print=$17, daily_seq=$18, last_bill_date_key=$19, upi_id=$20, show_upi_qr=$21 " +
          "WHERE id=1",
          [biz.name, biz.logo, biz.address, biz.phone, biz.footer, biz.currency, biz.taxLabel, biz.taxPercent,
           biz.serviceChargePercent, biz.billPrefix, biz.receiptPaperWidth, biz.receiptPaperWidthCustom,
           biz.kotPaperWidth, biz.kotPaperWidthCustom, biz.packingChargeType, biz.packingChargeValue,
           biz.rawBtAutoPrint ? 1 : 0, biz.dailySeq, biz.lastBillDateKey, biz.upiId, biz.showUpiQr ? 1 : 0]
        );
      })
      .then(function(){ return db.execute("DELETE FROM categories"); })
      .then(function(){ return runSequential(data.categories, function(c, i){
        return db.execute("INSERT INTO categories (id, name, sort_order) VALUES ($1,$2,$3)", [c.id, c.name, i]);
      }); })
      .then(function(){ return db.execute("DELETE FROM subcategories"); })
      .then(function(){ return runSequential(data.subcategories, function(s){
        return db.execute("INSERT INTO subcategories (id, category_id, name) VALUES ($1,$2,$3)", [s.id, s.categoryId || null, s.name]);
      }); })
      .then(function(){ return db.execute("DELETE FROM tables"); })
      .then(function(){ return runSequential(data.tables, function(t, i){
        return db.execute("INSERT INTO tables (id, name, sort_order) VALUES ($1,$2,$3)", [t.id, t.name, i]);
      }); })
      .then(function(){ return db.execute("DELETE FROM menu_item_variants"); })
      .then(function(){ return db.execute("DELETE FROM menu_items"); })
      .then(function(){ return runSequential(data.menuItems, function(m){
        return db.execute(
          "INSERT INTO menu_items (id, code, name, category_id, subcategory_id, price, tax_percent, photo, send_to_kitchen, favorite, out_of_stock) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [m.id, m.code || null, m.name, m.categoryId || null, m.subcategoryId || null,
           m.variants ? null : (m.price != null ? m.price : null), m.taxPercent != null ? m.taxPercent : null,
           m.photo || null, m.sendToKitchen === undefined ? null : (m.sendToKitchen ? 1 : 0),
           m.favorite ? 1 : 0, m.outOfStock ? 1 : 0]
        ).then(function(){
          if(!m.variants || !m.variants.length) return;
          return runSequential(m.variants, function(v, i){
            return db.execute("INSERT INTO menu_item_variants (id, menu_item_id, label, price, sort_order) VALUES ($1,$2,$3,$4,$5)",
              [m.id + "-v" + i, m.id, v.label, v.price, i]);
          });
        });
      }); })
      .then(function(){ return db.execute("DELETE FROM order_items"); })
      .then(function(){ return db.execute("DELETE FROM open_orders"); })
      .then(function(){ return runSequential(data.openOrders, function(o){
        return db.execute(
          "INSERT INTO open_orders (id, table_id, table_name, customer, customer_phone, discount_value, discount_type, " +
          "payment_mode, split_enabled, split_payments, is_parcel, packing_charge_override, kot_sent, editing_bill_id, created_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
          [o.id, o.tableId || null, o.table || "", o.customer || "", o.customerPhone || "", o.discountValue || 0,
           o.discountType || "amount", o.paymentMode || "Cash", o.splitEnabled ? 1 : 0,
           o.splitPayments ? JSON.stringify(o.splitPayments) : null, o.isParcel ? 1 : 0,
           o.packingChargeOverride != null ? o.packingChargeOverride : null, JSON.stringify(o.kotSent || {}),
           o.editingBillId || null, o.createdAt]
        ).then(function(){
          return runSequential(o.items || [], function(it, i){ return insertLineItem(db, "order_items", "order_id", o.id, it, i); });
        });
      }); })
      .then(function(){ return db.execute("DELETE FROM bill_items"); })
      .then(function(){ return db.execute("DELETE FROM bill_edit_history"); })
      .then(function(){ return db.execute("DELETE FROM bills"); })
      .then(function(){ return runSequential(data.bills, function(b){
        return db.execute(
          "INSERT INTO bills (id, bill_no, date, table_id, table_name, customer, customer_phone, payment_mode, " +
          "split_payments, is_credit, credit_paid, subtotal, discount_amount, discount_value, discount_type, tax_label, " +
          "tax_percent, tax, tax_by_rate, service_charge_percent, service, is_parcel, packing_charge, total, currency, edited_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)",
          [b.id, b.billNo, b.date, b.tableId || null, b.table || null, b.customer || null, b.customerPhone || null,
           b.paymentMode || null, b.splitPayments ? JSON.stringify(b.splitPayments) : null, b.isCredit ? 1 : 0,
           b.isCredit ? (b.creditPaid || 0) : null, b.subtotal || 0, b.discountAmount || 0, b.discountValue || 0,
           b.discountType || "amount", b.taxLabel || null, b.taxPercent != null ? b.taxPercent : null, b.tax || 0,
           b.taxByRate ? JSON.stringify(b.taxByRate) : null, b.serviceChargePercent != null ? b.serviceChargePercent : null,
           b.service || 0, b.isParcel ? 1 : 0, b.packingCharge || 0, b.total || 0, b.currency || null, b.editedAt || null]
        ).then(function(){
          return runSequential(b.items || [], function(it, i){ return insertLineItem(db, "bill_items", "bill_id", b.id, it, i); });
        }).then(function(){
          if(!b.editHistory || !b.editHistory.length) return;
          return runSequential(b.editHistory, function(h){
            return db.execute(
              "INSERT INTO bill_edit_history (bill_id, edited_at, previous_items, previous_total, previous_discount_amount, previous_table, previous_customer, previous_payment_mode) " +
              "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
              [b.id, h.editedAt, JSON.stringify(h.previousItems || []), h.previousTotal || 0, h.previousDiscountAmount || 0,
               h.previousTable || null, h.previousCustomer || null, h.previousPaymentMode || null]
            );
          });
        });
      }); })
      .then(function(){ return db.execute("DELETE FROM deleted_bills_log"); })
      .then(function(){ return runSequential(data.deletedBillsLog, function(d){
        return db.execute("INSERT INTO deleted_bills_log (id, original_bill_id, deleted_at, bill_snapshot) VALUES ($1,$2,$3,$4)",
          [d.id, d.originalBillId || null, d.deletedAt, JSON.stringify(d)]);
      }); })
      .then(function(){ return db.execute("DELETE FROM credit_payment_allocations"); })
      .then(function(){ return db.execute("DELETE FROM credit_payments"); })
      .then(function(){ return runSequential(data.creditPayments, function(c){
        return db.execute("INSERT INTO credit_payments (id, account_key, name, phone, amount, mode, note, date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [c.id, c.key || null, c.name || null, c.phone || null, c.amount || 0, c.mode || null, c.note || null, c.date]
        ).then(function(){
          return runSequential(c.allocations || [], function(a){
            return db.execute("INSERT INTO credit_payment_allocations (credit_payment_id, bill_id, bill_no, amount) VALUES ($1,$2,$3,$4)",
              [c.id, a.billId, a.billNo, a.amount]);
          });
        });
      }); })
      .then(function(){
        return db.execute("UPDATE counters SET value=$1 WHERE key='next_item_code'", [data.nextItemCode || 101]);
      })
      .then(function(){ return db.execute("COMMIT"); })
      .catch(function(err){
        return db.execute("ROLLBACK").catch(function(){}).then(function(){ throw err; });
      });
    });
  }

  function insertLineItem(db, table, fkColumn, fkValue, it, sortOrder){
    var sql = "INSERT INTO " + table + " (" + fkColumn + ", item_id, variant_id, name, price, qty, tax_percent, " +
      "category_id, category_name, subcategory_id, subcategory_name, rate_edited, sort_order) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)";
    return db.execute(sql, [
      fkValue, it.itemId || null, it.variantId || null, it.name, it.price, it.qty,
      it.taxPercent != null ? it.taxPercent : null, it.categoryId || null, it.categoryName || null,
      it.subcategoryId || null, it.subcategoryName || null, it.rateEdited ? 1 : 0, sortOrder
    ]);
  }

  // Runs async step(item, index) for each item strictly one-at-a-time
  // (not Promise.all) so writes inside a single transaction stay ordered.
  function runSequential(list, step){
    var p = Promise.resolve();
    (list || []).forEach(function(item, i){
      p = p.then(function(){ return step(item, i); });
    });
    return p;
  }

  /* ================= END STORAGE ENGINE ================= */
