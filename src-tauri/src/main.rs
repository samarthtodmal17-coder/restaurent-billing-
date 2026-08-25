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
// side calls Database.load("sqlite:restaurant.db"). Before that call, the
// frontend invokes backup_database_file below, so there is always a
// pre-migration copy of the previous, known-good database sitting next to
// it if a migration ever needs to be rolled back by hand.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use tauri::Manager;
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

/// Copies restaurant.db -> restaurant.db.bak-<unix-seconds> in the app's
/// data directory before migrations run, so there is always a rollback
/// point. Safe to call even if no database file exists yet (first run).
#[tauri::command]
fn backup_database_file(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let db_path = dir.join("restaurant.db");
    if !db_path.exists() {
        return Ok("no existing database, nothing to back up".into());
    }

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let backup_path = dir.join(format!("restaurant.db.bak-{stamp}"));

    std::fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;
    Ok(backup_path.to_string_lossy().to_string())
}

#[derive(Serialize)]
struct BackupInfo {
    filename: String,
    created_at_unix: u64,
    size_bytes: u64,
}

/// Lists every restaurant.db.bak-<unix-seconds> file in the app data
/// directory, newest first. Powers a "Restore from backup" list in
/// Settings so the owner can see how many backups exist and how old the
/// most recent one is, without needing to know the file system location.
#[tauri::command]
fn list_database_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut backups = vec![];
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(stamp_str) = name.strip_prefix("restaurant.db.bak-") {
            if let Ok(stamp) = stamp_str.parse::<u64>() {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                backups.push(BackupInfo { filename: name, created_at_unix: stamp, size_bytes: size });
            }
        }
    }
    backups.sort_by(|a, b| b.created_at_unix.cmp(&a.created_at_unix));
    Ok(backups)
}

/// Restores restaurant.db from a previously-made backup file. Only
/// accepts filenames that exactly match the restaurant.db.bak-<digits>
/// pattern this app itself generates (rejects anything else, including
/// any path separators) -- this is the one place a filename picked
/// earlier in the JS layer flows back into a file system path, so it's
/// deliberately strict rather than trusting the caller.
///
/// Restoring makes its OWN backup of the current (about-to-be-replaced)
/// database first, under the same restaurant.db.bak-<stamp> naming, so a
/// restore is itself undoable the same way a bad migration is.
///
/// IMPORTANT: this only replaces the file on disk. The already-open
/// SQLite connection in the webview (owned by tauri-plugin-sql) does not
/// automatically pick up a swapped-out file underneath it. The frontend
/// must prompt the user to restart the app after calling this -- treat
/// the returned Ok(..) as "the file is ready", not "the running app now
/// reflects it".
#[tauri::command]
fn restore_database_backup(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let is_valid_name = filename.starts_with("restaurant.db.bak-")
        && filename["restaurant.db.bak-".len()..].chars().all(|c| c.is_ascii_digit())
        && !filename.contains('/')
        && !filename.contains('\\');
    if !is_valid_name {
        return Err("Invalid backup filename.".into());
    }

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    let backup_path = dir.join(&filename);
    if !backup_path.exists() {
        return Err("That backup file no longer exists.".into());
    }

    // Snapshot the current database before overwriting it, so restoring
    // is itself reversible.
    let _ = backup_database_file(app.clone());

    let db_path = dir.join("restaurant.db");
    std::fs::copy(&backup_path, &db_path).map_err(|e| e.to_string())?;

    Ok("Backup restored. Please restart the app for it to take effect.".into())
}

/// TEMPORARY DIAGNOSTIC: appends a timestamped line to a plain text file
/// on the user's Desktop, deliberately NOT using app.path().app_data_dir()
/// -- the whole point is to have one write path that does not depend on
/// the same Tauri path-resolution logic used by tauri-plugin-sql and the
/// backup/restore commands above, in case THAT resolution is itself the
/// root cause of a data-loss report (data added during a session vanishes
/// on restart, with no restaurant.db found anywhere on disk via a full
/// search, and no alert() popup from the JS-side diagnostic ever
/// appearing -- suggesting either alert() is being silently swallowed by
/// this webview, or the code never reaches that point at all). Reading
/// USERPROFILE directly from the OS environment is about as low-level and
/// dependency-free as a Windows path lookup gets. Remove once the root
/// cause is confirmed and fixed.
#[tauri::command]
fn write_debug_log(text: String) -> Result<String, String> {
    // v0.1.2 hardcoded USERPROFILE\Desktop and the file never appeared,
    // even after a clean uninstall + reinstall. Most likely explanation:
    // this machine has OneDrive "Known Folder Move" turned on, which
    // relocates Desktop (and often Documents/Pictures) into
    // USERPROFILE\OneDrive\Desktop and leaves nothing at the plain
    // USERPROFILE\Desktop path -- so create(true) failed at the open()
    // call because the PARENT folder itself doesn't exist there anymore
    // (create(true) makes the file, not missing parent directories), and
    // that error was being silently swallowed by the JS-side .catch().
    // Try several locations in order and use whichever actually works,
    // so this diagnostic no longer depends on guessing this machine's
    // folder layout correctly.
    let profile = std::env::var("USERPROFILE").unwrap_or_default();
    let onedrive = std::env::var("OneDrive").unwrap_or_default();
    let temp = std::env::var("TEMP").or_else(|_| std::env::var("TMP")).unwrap_or_default();

    let mut candidates: Vec<std::path::PathBuf> = vec![];
    if !onedrive.is_empty() {
        candidates.push(std::path::Path::new(&onedrive).join("Desktop"));
    }
    if !profile.is_empty() {
        candidates.push(std::path::Path::new(&profile).join("Desktop"));
        candidates.push(std::path::Path::new(&profile).to_path_buf());
    }
    if !temp.is_empty() {
        candidates.push(std::path::Path::new(&temp).to_path_buf());
    }

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    use std::io::Write;
    let mut attempts: Vec<String> = vec![];
    for dir in &candidates {
        let path = dir.join("billing_debug.txt");
        match std::fs::OpenOptions::new().create(true).append(true).open(&path) {
            Ok(mut file) => {
                if writeln!(file, "[{stamp}] {text}").is_ok() {
                    return Ok(path.to_string_lossy().to_string());
                }
                attempts.push(format!("{}: write failed", path.display()));
            }
            Err(e) => attempts.push(format!("{}: {e}", path.display())),
        }
    }
    Err(format!("all candidate paths failed: {}", attempts.join(" | ")))
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

/// Cloud backup (Phase 7), read side: reads the LIVE restaurant.db file
/// (not a .bak- snapshot) and returns it as a base64 string, so the JS
/// side can POST it to the licensing platform's /api/backup/upload
/// endpoint (R2-backed, scoped to this device's active license -- see
/// licensing-platform/functions/api/backup/upload.js). invoke() can only
/// carry JSON, not raw bytes, hence base64 as the bridge.
#[tauri::command]
fn read_database_bytes(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    let db_path = dir.join("restaurant.db");
    if !db_path.exists() {
        return Err("No local database found yet -- nothing to back up.".into());
    }
    let bytes = std::fs::read(&db_path).map_err(|e| e.to_string())?;
    Ok(BASE64.encode(bytes))
}

/// Cloud backup (Phase 7), write side: takes a base64 database pulled down
/// from /api/backup/restore and writes it to disk using the SAME
/// restaurant.db.bak-<unix-seconds> naming convention as the existing
/// local backups made by backup_database_file. That means it shows up
/// automatically in list_database_backups and can be applied with the
/// already-tested restore_database_backup command below -- no separate,
/// duplicate "restore from cloud" logic needed on the Rust side. Returns
/// the filename so the JS side can immediately call
/// restore_database_backup with it.
#[tauri::command]
fn save_cloud_backup_bytes(app: tauri::AppHandle, data: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let bytes = BASE64
        .decode(data)
        .map_err(|e| format!("corrupted cloud backup data: {e}"))?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let filename = format!("restaurant.db.bak-{stamp}");
    let path = dir.join(&filename);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;

    Ok(filename)
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
        .invoke_handler(tauri::generate_handler![
            backup_database_file,
            list_database_backups,
            restore_database_backup,
            get_device_fingerprint,
            write_debug_log,
            read_database_bytes,
            save_cloud_backup_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running restaurant billing app");
}
