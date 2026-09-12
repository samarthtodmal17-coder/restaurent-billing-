// Restaurant Billing - Tauri desktop shell.
//
// Phase 1 scope: wrap the existing HTML/CSS/JS billing app (unchanged UI)
// in a native Windows shell, and give it a real SQLite database instead of
// browser IndexedDB. tauri-plugin-sql owns the connection + the migration
// history table; every schema change from here on is a new file dropped in
// src-tauri/migrations/, never an edit to an old one (see section 18 of the
// platform plan: "5 -> 6", never "rewrite 5").
//
// The plugin runs pending migrations automatically the first time the JS
// side calls Database.load("sqlite:restaurant.db").
//
// v0.1.14-16 had an automatic on-disk backup system here (backup_database_
// file / list_database_backups / restore_database_backup): every launch
// copied restaurant.db to a timestamped .bak file before Database.load()
// ran, so a bad migration could be rolled back by hand. Removed in v0.1.17
// -- every one of those snapshots lived on the exact same disk as the live
// database, so it protected against a bad update/migration but did nothing
// for the device itself being lost, stolen, or its disk failing. That
// left customers with a false sense of security. The one thing that
// actually survives a dead device is the JSON export the app already
// prompts the owner to save onto a pendrive (see the weekly reminder
// banner in www/index.html) -- simpler to reason about than two backup
// systems covering overlapping but different failure modes.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init_schema",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
    // Next schema change ever needed: append a new Migration { version: 2, ... }
    // here. Do not edit version 1 once any customer has run it.
}

/// Real OS-level device identifier for license activation (replaces the
/// old browser-localStorage random UUID the PWA version used, which any
/// "clear site data" click would wipe -- see README-PHASE1.md). On
/// Windows this is HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid, set
/// once at Windows install time; it survives component swaps (new disk,
/// new RAM) but changes on an OS reinstall. That's the honest trade-off:
/// a real device anchor, not a spoofable browser value, but also not a
/// multi-component hardware fingerprint that would need admin/WMI access
/// to read reliably.
#[tauri::command]
fn get_device_fingerprint() -> Result<String, String> {
    machine_uid::get().map_err(|e| format!("could not read machine id: {e}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:restaurant.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        // Phase 6: signed automatic updates. Registering the plugin here is
        // enough for the JS side's check()/downloadAndInstall() to work,
        // driven by the "plugins.updater" block in tauri.conf.json (pubkey +
        // endpoints). tauri_plugin_process gives the JS side relaunch()
        // to restart into the newly-installed version.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_device_fingerprint])
        .run(tauri::generate_context!())
        .expect("error while running restaurant billing app");
}
