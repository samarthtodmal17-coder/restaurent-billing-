# Phase 1 + Phase 2 -- Tauri + SQLite desktop shell, central licensing platform, real device fingerprint, backups, and auto-updates

This file originally covered Phase 1 only (Tauri + SQLite). It's since grown to cover everything built in the follow-up pass: a central multi-product licensing platform (Cloudflare Pages + D1), a real OS-level device fingerprint replacing the old browser-localStorage one, backup/restore, and signed automatic updates. Phase 1's content is below unchanged; the new material starts at "Phase 2" further down.

## Phase 2 -- what's new

**`licensing-platform/`** is a second, separate Cloudflare Pages project (D1-backed, not KV) -- the "central platform" from the architecture discussion. One deployment of this can issue and manage licenses for every product you ever build, not just this one. It replaces the earlier single-product KV-based licensing built for the PWA version.

- `migrations/0001_init.sql` -- products / customers / licenses / license_events tables. Validated against a real SQLite engine with foreign keys and CHECK constraints turned on (matching how D1 actually enforces them), not just "the CREATE TABLE statements parse."
- `functions/api/activate.js` -- device activation + heartbeat, now product-aware (a license belongs to exactly one product).
- `functions/api/admin/issue.js`, `admin/revoke.js`, `admin/list.js`, `admin/products.js` -- issuing, revoke/reactivate/unbind (same three actions as before), a dashboard listing endpoint, and product registration.
- `admin.html` -- the private control panel: register a product once, issue licenses against it, revoke/reactivate/unbind, and see every license in a table with status/device/last-check-in.
- `test-functions.mjs` -- 23 real behavioral checks against the actual handler code (not a reimplementation): issue, first activation, same-device heartbeat, different-device denial, wrong-product denial, revoke blocking even the original device, reactivate restoring access, unbind freeing the key for a new device, and the admin list/summary counts. Run with `node --experimental-sqlite test-functions.mjs`.

**Real device fingerprint.** `src-tauri/src/main.rs` now has a `get_device_fingerprint` command backed by the `machine-uid` crate, which on Windows reads `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`. This is a genuine upgrade over the PWA's browser-localStorage device id, which any "clear site data" click would wipe -- this one survives that, and survives component swaps (new disk, new RAM), though it does change on a full OS reinstall. `www/index.html`'s `getDeviceId()` now calls this via `invoke()` when running under Tauri, falling back to the old localStorage approach only if that call fails or the page is opened outside Tauri.

**Backup / restore, actually complete now.** Phase 1 only had `backup_database_file` (called automatically before migrations). Now there's also `list_database_backups` and `restore_database_backup`, plus a "Local Backups (Desktop)" card in Settings (only visible when running under Tauri) listing every backup with a Restore button. Restoring makes its own safety copy first, so a restore is itself undoable. Note it needs an app restart to take effect -- the running SQLite connection doesn't notice the file changing underneath it, so the UI message says exactly that.

**Signed automatic updates.** `tauri-plugin-updater` is wired into `Cargo.toml`, `main.rs`, `tauri.conf.json`, and `capabilities/default.json`. `www/index.html` checks for updates ~5 seconds after the app becomes usable (never blocking startup), and if one is found, downloads, installs, and restarts automatically via `tauri-plugin-process`'s `relaunch()`. `.github/workflows/build-windows.yml` now uses the official `tauri-apps/tauri-action`, which builds the signed installer, creates a GitHub Release, and generates the `latest.json` file the updater endpoint reads from.

### One-time setup this phase needs on your machine (can't be done in this sandbox)

1. **Generate the update-signing keypair**: `npm run tauri signer generate -- -w ~/.tauri/restaurant-billing.key`. This needs the Tauri CLI, which needs Rust -- same reason the compile itself couldn't happen here.
2. Paste the printed **public** key into `src-tauri/tauri.conf.json`'s `plugins.updater.pubkey` (currently a placeholder).
3. In your GitHub repo's Settings -> Secrets and variables -> Actions, add `TAURI_SIGNING_PRIVATE_KEY` (the private key file's contents) and, if you set a password on it, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Never commit the private key file itself.
4. Update `tauri.conf.json`'s `plugins.updater.endpoints` URL to your actual `owner/repo` once this is pushed to GitHub.
5. Deploy `licensing-platform/` to its own Cloudflare Pages project: same Direct Upload approach as the app itself, but bind a **D1 database** (not KV) named e.g. `LICENSING_DB`, run the migration (`wrangler d1 execute LICENSING_DB --file=migrations/0001_init.sql`, or paste it into the D1 console in the dashboard), and set an `ADMIN_SECRET` environment variable the same way as before.
6. Update `www/index.html`'s `LICENSE_API_BASE` (currently a placeholder) to that Pages project's real URL, and confirm `PRODUCT_ID` matches what you register via `admin.html`.
7. Open `admin.html` on that deployed URL, register the `restaurant-pos` product, issue yourself a test key, and activate it in the running app.

### Verified this pass, same discipline as Phase 1

Every new Rust API call (`machine_uid::get()`, the `Manager`/`PathResolver` methods reused, `tauri-plugin-updater`'s config shape and `Cargo.toml` entries) was checked against Tauri's and the crate's current, live documentation before being written -- not recalled from memory. The D1 Pages Functions were exercised with 23 real assertions against the actual handler code using a D1-shaped mock backed by a real SQLite engine, the same rigor as Phase 1's `test-db-adapter.mjs`. What still can't happen in this sandbox is an actual `cargo build` -- that first real compile is still the one step that has to happen on your machine or in CI.

---

# Phase 1 -- Tauri + SQLite desktop shell

What this folder is: your existing restaurant billing app, wrapped in a native Windows desktop shell (Tauri), with its storage layer swapped from browser IndexedDB to a real SQLite database file on the customer's PC. The billing screens themselves are untouched -- same HTML, same CSS, same business logic, same `loadData()` / `saveData()` calls throughout. Only the *implementation* of those two functions changed.

## How far this was actually verified

There is no Rust toolchain available in the environment this scaffold was built in, and the sandbox's network access blocks `static.rust-lang.org` (where `rustup` downloads Rust from), so `cargo check` / `cargo build` could not be run here -- that's a hard environment limit, not something retrying would fix. To get as close to real verification as possible without a compiler, every non-trivial API call in `src-tauri/` was cross-checked against Tauri's current, live documentation (not just recalled from memory) -- the `tauri-plugin-sql` README, the `Manager`/`PathResolver` docs.rs pages, and the `tauri.conf.json` v2 schema reference. That pass caught one real bug: `Cargo.toml` originally declared a `[lib]` target pointing at `src/lib.rs`, a file that doesn't exist in this scaffold (only `src/main.rs` does) -- that would have failed to compile immediately. It's been removed; a single `src/main.rs` binary crate needs no `[lib]`/`[[bin]]` section at all. Everything else checked out exactly as written: the migration API, the `$1,$2...` SQL placeholder syntax, the JS `db.execute`/`db.select` calls, the `sql:allow-*` permission identifiers in `capabilities/default.json`, and `app.path().app_data_dir()` in the `backup_database_file` command.

That said, this is real verification of *correctness against the docs*, not proof the code compiles -- a compiler catches things documentation cross-checking can't (typos in a spot I didn't think to check, a version mismatch between crates, a missing trait bound). The very first thing to do on your own machine is exactly what real testing looks like: `npm install` then `npm run dev`, and see what, if anything, it complains about.

## What's actually done vs. what's still needed

Done and verified in this scaffold:

- A full SQLite schema (`src-tauri/migrations/0001_init.sql`) covering every piece of data the app already tracks -- business settings, categories, subcategories, tables, menu items (including variants), open orders, bills (including edit history), the deleted-bills audit log, credit payments and their allocations, and a counters table for the next item code. Verified by actually running the schema against a real SQLite engine (`python3 -c "import sqlite3..."`), not just eyeballed.
- `www/index.html` -- your app, with the old IndexedDB block replaced in place by a SQLite-backed version. This is not a template or a "paste this yourself" file -- the swap has already been made. All 3 inline `<script>` blocks pass `node --check`, and brace/paren balance matches the original file's own baseline.
- The storage adapter was tested with a real round-trip: a Node test harness (`test-db-adapter.mjs`) creates a realistic sample dataset (menu items with and without variants, an open order, a finished bill with edit history, a deleted bill, a credit payment with an allocation), runs it through `saveData()` against a real SQLite database (Node's built-in `node:sqlite`), then `loadData()`s it back and checks every field survived correctly -- including a second save/load cycle to catch bugs that only show up on updates, not first inserts. All 28 checks pass. Run it yourself any time with `node --experimental-sqlite test-db-adapter.mjs`.
- A Tauri v2 project scaffold: `src-tauri/Cargo.toml`, `tauri.conf.json`, `src/main.rs` (registers `tauri-plugin-sql` with the migration, plus a `backup_database_file` command that copies the database file before any migration runs), and `capabilities/default.json` (the permissions file Tauri v2 requires).
- `.github/workflows/build-windows.yml` -- builds the actual Windows installer on a real `windows-latest` GitHub Actions runner. This matters because there's no Windows machine available in the environment this scaffold was built in, and Tauri Windows builds don't reliably cross-compile from Linux -- so this workflow is not a placeholder, it's the intended real build path (and is how most Tauri teams build Windows installers even when they do own a Windows PC, since it's reproducible).

Not done, and can't be done without a real machine and a few of your own decisions:

- Nobody has run `cargo tauri dev` or `cargo tauri build` against this yet, because there's no Rust toolchain available in this sandbox. The code is syntactically correct and the SQL/JS logic is functionally tested in isolation, but the Rust side (`main.rs`, `Cargo.toml`) has not been compiled. First thing to do on your own machine (see below).
- The 5 icon files are still the same placeholder mark generated earlier for the PWA version -- swap them for your real logo before shipping anything to a customer.
- Windows code signing isn't set up. Without it, Windows SmartScreen will warn customers the installer is from an "unknown publisher." Getting a code-signing certificate and wiring it into the GitHub Actions workflow is a separate, later step -- flagging it now so it doesn't surprise you at launch time.
- Nothing here migrates existing customer data from the PWA/IndexedDB version (the Cloudflare Pages one built earlier in this project) into this new SQLite format. If you've already sold that version to real customers, that migration tool needs to be built before switching them over -- don't do that silently.
- The licensing/device-binding/update system described in the platform plan (sections 10-33) isn't part of this Phase 1 scaffold at all -- this phase is specifically "get the app running on SQLite inside a native shell." Licensing comes in a later phase, reusing lessons from the Cloudflare KV system already built for the PWA version.

## What you need on your own machine to actually run this

You need a Windows PC (or any machine, for local dev) with:

1. **Rust** -- install via [rustup.rs](https://rustup.rs). This sandbox has no Rust toolchain, so none of the Rust code has been compiled yet, only hand-verified for correctness.
2. **Node.js** (v18+).
3. **Tauri's platform prerequisites** -- on Windows this means the "Desktop development with C++" workload from Visual Studio Build Tools, and WebView2 (pre-installed on modern Windows 10/11, Tauri's installer will prompt if missing). Full list: https://v2.tauri.app/start/prerequisites/

Then, from this `tauri-app` folder:

```
npm install
npm run dev      # opens the app in a native window, live-reloading, for testing
npm run build     # produces the real Windows installer (.exe / .msi) locally
```

`npm run dev` is where you'll actually find out if anything doesn't compile -- do this before anything else.

## Generating real icons

Once you have your actual logo file, don't hand-edit the 5 placeholder PNGs -- run:

```
npm run tauri icon path/to/your-logo.png
```

This regenerates every icon size and format Windows/the installer needs (including the `.ico` the current scaffold doesn't have yet) from one source image.

## How the storage swap works, if you want to verify it yourself

`www/index.html`'s `loadData()` now does 15 parallel `SELECT`s (one per table) and reassembles them into the exact same JavaScript object shape (`{business, categories, subcategories, menuItems, tables, openOrders, bills, deletedBillsLog, creditPayments, nextItemCode}`) that the old `mergeWithDefaults()`-based loader produced. `saveData()` wraps a full delete-and-reinsert of every table in a single SQL transaction, so a save either fully succeeds or fully rolls back -- there's no way to end up with half-written data.

This is a "full resync on every save" design, not incremental per-field writes. That's a deliberate simplification: it means one storage function to get right instead of touching the ~70 call sites across the app that call `saveData()`. At normal restaurant POS volume (tens of menu items, low hundreds of bills a day) this is fast. If a very high-volume site ever makes this measurably slow, the fix is incremental writes at specific mutation points -- not a reason to hold off on shipping this version now.

## Extending the schema later

Never edit `0001_init.sql` once a customer has a database built from it. Add a new migration instead, in `src-tauri/src/main.rs`'s `migrations()` function:

```rust
Migration {
    version: 2,
    description: "add_something",
    sql: "ALTER TABLE menu_items ADD COLUMN ...;",
    kind: MigrationKind::Up,
}
```

`tauri-plugin-sql` tracks which migrations have run per database and applies only the new ones automatically the next time the app starts -- this is the mechanism behind section 18 of the platform plan ("5 -> 6, never rewrite 5").

## On GitHub

The build workflow uses a private GitHub repository for source control and CI, not GitHub Pages. Nothing here is publicly hosted -- the built installer is a downloadable workflow artifact you retrieve and distribute yourself. This doesn't conflict with the earlier decision to avoid GitHub Pages for distributing the web version.
