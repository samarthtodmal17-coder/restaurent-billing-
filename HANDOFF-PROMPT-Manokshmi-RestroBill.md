# HANDOFF PROMPT — Manokshmi RestroBill (paste this at the start of a new chat)

You are continuing work with me (Samarth) on my product **Manokshmi RestroBill**. Read this whole brief first. It replaces all prior chat context. After reading, reply only with a 5-line confirmation of what you understood, then wait for my next request.

---

## 1. Who I am and how to work with me

- I'm Samarth, based in Maharashtra, India. I run **Manokshmi Technologies**, where I build and sell software tools (billing/management) to business owners. I also do educational advisory work (separate from this project).
- **I do not write code.** I make product decisions and direct the build. You write, edit, verify and ship the code. Explain things in simple, plain language, but be exact.
- My customers are restaurant owners and staff, often non-technical. Assume the UI must be simple, big, keyboard-friendly, and "illiterate-friendly" (icons + short words).
- **What I expect from you (learned the hard way):**
  1. Find the real root cause. No surface patches or guesses. If you can't diagnose from what I told you, ask me 1-2 sharp questions or add logging first.
  2. Be honest about remaining risk and about what you could NOT verify.
  3. Actually verify: run `node --check` on all inline `<script>` blocks, and for database changes run the real SQL against a real SQLite DB (Python `sqlite3`) with `PRAGMA foreign_keys=ON`.
  4. When I report several bugs, fix all of them. When I say "check for more bugs and solve", find AND fix.
  5. Keep replies short. I read on a phone/PC between customers.
  6. Do not start new scope without my confirmation, except bugs directly caused by/related to what I reported.

---

## 2. The product

**Manokshmi RestroBill** — a Windows desktop restaurant billing/POS app (offline-first, per-device license).

- Stack: **Tauri v2** shell (Rust, `src-tauri/src/main.rs`) + a single-page web UI in **`www/index.html`** (plain HTML/CSS/JS, one huge file, 3 inline `<script>` blocks) + **SQLite** via `tauri-plugin-sql` (sqlx). Plugins: sql, fs, updater, process.
- Windows installers: NSIS + MSI, install mode `currentUser`. Auto-update via the Tauri updater plugin (signed).
- Identifier: `in.manokshmitechnologies.restaurantbilling`. Product name: "Manokshmi RestroBill".
- **Current version: 0.1.47** (last shipped when this brief was written).

### Where everything lives (my PC)
- Project root: `C:\Desktop\BILLING SOFTWARE\Latest Version\Restaurant\tauri-app-phase2-v2`
- Main UI/logic: `www\index.html` (version string is `var APP_VERSION = "0.1.xx";` near line ~4902)
- DB adapter: `www\db.js` (older), migrations in `src-tauri\migrations\0001_init.sql` … `0005_cancelled_session.sql`
- Rust shell: `src-tauri\src\main.rs`; permissions: `src-tauri\capabilities\default.json`
- Version lives in FOUR places and must be bumped together: `www/index.html` (APP_VERSION), `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- CI build: `.github\workflows\build-windows.yml` (runs on any pushed tag `v*`; builds with tauri-action; release is created as a **draft** — I must publish it on GitHub for customers' updater to see it)
- Licensing platform (separate backend): `licensing-platform\` (admin.html + Cloudflare Pages Functions in `functions\api\...` + D1 migrations 0001–0005)
- Docs/PDFs in `licensing-platform\`: `Manokshmi-Business-Technical-Reference.pdf`, `Android-Printing-RawBT-Setup-Guide.pdf`, `manokshmi-software-source.zip`; setup notes in `README-PHASE1.md`
- A separate standalone single-file HTML version exists ("EASY-v41", offline browser version). Older features were ported to it; ask me before touching it.

### Important links
- GitHub repo: https://github.com/samarthtodmal17-coder/restaurent-billing-
- Releases (installers): https://github.com/samarthtodmal17-coder/restaurent-billing-/releases
- Latest release page example: https://github.com/samarthtodmal17-coder/restaurent-billing-/releases/tag/v0.1.43
- GitHub Actions (build status): https://github.com/samarthtodmal17-coder/restaurent-billing-/actions
- Updater endpoint used by the app: https://github.com/samarthtodmal17-coder/restaurent-billing-/releases/latest/download/latest.json
- Licensing API base used by the app (`LICENSE_API_BASE`): https://licensing-platform.pages.dev  (product id `restaurant-pos`; admin page is `admin.html` on that site; admin API uses an `ADMIN_SECRET` env var set in Cloudflare — never paste or store the secret in chat)
- Hosting: Cloudflare Pages + D1 (licensing). Signing key for updater: GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (never ask me to paste these).

---

## 3. Business workflow (how I sell and support)

1. I sell the app to a restaurant. I issue a **license** in my admin dashboard (licensing platform): per customer, per device, with expiry, optional trial → convert to paid, sale price tracking, notes, device labels, revocation, renewal-reminder message generator, inactive-customer alerts, CSV export, customer history.
2. Customer installs the Windows installer from GitHub Releases, activates with the license key. The app fingerprints the device (Rust `machine-uid`) and calls my licensing API.
3. I ship fixes by bumping version → commit → tag → push; GitHub Actions builds signed installers → I publish the draft release → customers' apps auto-update (updater, "passive" install mode).
4. Support is mostly WhatsApp/phone: customers report a problem in plain words ("not closing", "data gone", "import not working"). I relay to you. Many reports are vague — ask the minimum needed to diagnose, then fix.

### My standard ship commands (always include the `cd` — I once ran git from the wrong folder)
```
cd "C:\Desktop\BILLING SOFTWARE\Latest Version\Restaurant\tauri-app-phase2-v2"
git add -A
git commit -m "vX.Y.Z: <short description>"
git tag vX.Y.Z
git push origin main --tags
```
(The "LF will be replaced by CRLF" warning is harmless.) After the push, the release shows up on GitHub; check it and publish if it's still a draft.

---

## 4. App features (what exists today)

**Billing screen (everything on one screen):** Tables panel (collapsible floor plan with occupied/free tiles, Move, Merge, Rename), Bill Details (table/room, customer, phone), Add Items (search by code/name, categories/subcategories, favourites bar, photo cards, variants/sizes, out-of-stock), Current Bill (cart, discount, tax by item rate, service charge, payment mode incl. Split and Credit/"Udhari", packing charge for parcel), KOT printing (kitchen printer profile), Save & Print receipt (58/80mm, UPI QR).

**Dine-in vs Parcel/Takeaway:** each order has `isParcel`. Dine-in must be linked to a real table before items can be added (v0.1.45). Parcel/Takeaway = walk-in order with no table; shows as a chip at the bottom ("walk-in orders").

**Keyboard-first billing (F-keys, only on Billing screen):** F1 legend toggle · F2 item search · **F3 type a table name/number and Enter to jump to it ("Table X not found" if no match; Esc cancels)** · F4 customer · F5 payment mode · F6 new order · **F7 switch table: cycles RUNNING tables first (in floor-plan display order); if none running, walks every table in display order** · F8 print KOT · F9 save & print.

**Other screens:** Menu & Rates (add/edit items, photos, variants, categories, export/import/erase menu, recipes), Inventory (ingredients, purchases, wastage, low-stock, stock valuation, recipe-based auto-deduction on bill save), Bill History (date filters, edited/deleted bill logs, cancelled-items info), Credit book (customer dues, partial-payment allocation), Dashboard (sales, tax, payment mode, dine vs parcel, categories, best sellers, hours/weekday, discount/rate-override oversight), Settings (business details, display/font size, printer profiles, UPI QR, data & backup, owner/staff accounts with PIN login, import/export backup).

**Roles:** Owner and Staff accounts with PIN login. Settings/Dashboard/cost views are Owner-only. Edits/deletes are attributed to the logged-in user.

**Anti-theft:** clearing a KOT-sent order or removing a KOT-sent item requires a reason and is logged (`cleared_orders_log`, session-based `cancelledSession`, consolidated into one entry per order). As of v0.1.44 the walk-in order chip's ✕ button also goes through this log (it used to delete silently).

**Data safety layers:** crash-safe `doSave()` (upsert-then-cleanup, no delete-first), empty-table wipe guards (menu, bills, staff, inventory, credit, tables, categories), automatic rotating backups + backup on close, weekly JSON export reminder, honest failure toasts (`saveDataOrThrow` for Import/Reset), persisted debug log at `Documents\Manokshmi RestroBill Backups\debug.log`.

---

## 5. Hard-won technical knowledge (don't re-learn these)

- **DB location:** `%APPDATA%\in.manokshmitechnologies.restaurantbilling\restaurant.db`. Uninstall/reinstall does NOT delete it (by design). To truly reset a device: close app, delete that file.
- **`foreign_keys=ON` always** (sqlx default; confirmed in upstream source). So any dangling reference makes an INSERT fail and aborts the rest of `doSave()`'s sequential table loop. Fix pattern: filter/null dangling FKs before inserting (done for subcategories, menu items, recipe lines, open orders, inventory ledgers).
- **Never use `INSERT OR REPLACE` on tables with `ON DELETE CASCADE` children** — it deletes then inserts, cascading child deletions. Use `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`. (Done for all parent tables.)
- `_saveChain` serializes all saves; anything that waits on it must also reassign its own promise back into it. `saveData()` swallows errors (toast only); `saveDataOrThrow()` re-throws for callers that show their own success message.
- **App close:** Tauri `onCloseRequested` needs `event.preventDefault()`; `destroy()` alone didn't terminate reliably in the field. Current handler: wait for pending save → end-of-day backup (5s cap) → `db.close()` (2s cap) → `process.exit(0)`, fallback `destroy()`. Needs `process:default` and `sql:allow-close` capabilities (present).
- Release builds have no DevTools and `debugLog` is console-only → use `persistDebugLog()` for anything needing field diagnosis.
- Tables are a card inside the Billing screen (id `cardTables`), not a separate tab. Orders: `data.openOrders` (each has `tableId`, `table`, `items`, `isParcel`, `kotSent`, `cancelledSession`). `findOrderForTable`, `switchOrder`, `createNewOrder`, `discardOrder`, `pickDefaultActiveOrder`, `addToCart` (the single choke point for adding items), `resolveOrderCancelReason` + `logOrderClear` (shared cancel-logging).
- Verification recipe: extract the 3 inline `<script>` blocks with a Python regex to `/tmp/script_N.js`, run `node --check` on each. For SQL changes, build an in-memory SQLite DB from all 5 migrations with `PRAGMA foreign_keys=ON` and run the real statements.
- In the sandbox the project is mounted at `/sessions/<session>/mnt/tauri-app-phase2-v2/` (path differs per session; check the system prompt).
- Web fetch/search restrictions: don't bypass blocked fetches with curl/python.

---

## 6. Version history of this long session (for context)

0.1.38 surface save failures + empty-menu save guard · 0.1.39–0.1.41 fix "app not closing" (preventDefault → destroy → process.exit + persisted log) · 0.1.40 big hardening pass (INSERT OR REPLACE cascade fix, generalized wipe guards, race fixes, child-table ordering) · 0.1.42 close handler waits for saves and closes DB (fixes "data gone on reopen"/import failing) · 0.1.43 dangling-FK defence + honest Import failure (fixes "import succeeds but only the same few items remain"; confirmed working on the customer's device) · 0.1.44 walk-in order close now logs cancellations · 0.1.45 Dine-in requires a table; typing an existing table name links to it · 0.1.46 F7 skips blank placeholder; F3 always lets you jump to a table with "not found" feedback · 0.1.47 F7 = running tables first, else display order.

## 7. Known open items / ideas (not started unless I say so)

- Android version of the product: task list items (compile spike, per-platform fingerprint, register as separate product in licensing platform, mobile-responsive UI, printing via RawBT, signing/distribution) — spike was in progress, others pending.
- Release is built as a **draft** by the workflow; consider whether to auto-publish.
- `Cargo.lock` / CRLF warnings are cosmetic.
- Possible future checks: more audits of lifecycle/async code, EASY-v41 parity for newer fixes.

---

## 8. Other products of mine (context only, don't touch unless asked)

Cloth-shop billing (boutique), Hotel Pro (bar/restaurant management web app), Nutrifitist (food/fitness PWA), a trading-signal project (alerts only), and an earlier single-file restaurant billing web app (`billing-app_restaurent.html`: credit ledger, live rate editing, gold-accent UI).

---

## 9. How to start the next chat

1. Confirm in ≤5 lines what you understood (product, stack, my working rules, ship process, current version).
2. If I give a bug report: locate the code first, find the root cause, fix it, run the verification recipe, bump the version in all 4 files, and give me the ship commands (with the `cd`).
3. If you need the real repo state, read `www/index.html`, `src-tauri/src/main.rs`, `src-tauri/capabilities/default.json`, the migrations, and `.github/workflows/build-windows.yml` from the project folder above.
