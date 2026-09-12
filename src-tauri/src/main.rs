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

/// How many restaurant.db.bak-* snapshots to keep on disk. backup_database_file
/// runs on every app launch (see its own doc comment below), so with no cap
/// this list -- and the disk space it uses -- grows forever for as long as
/// the app is ever used, which for a one-time-purchase product with no
/// planned end date is exactly the kind of "fine for the first year, a
/// slow-motion problem by year five" issue worth avoiding up front. 30 keeps
/// roughly a month of daily-launch history (more if the app is opened less
/// than once a day) while still capping worst-case growth at
/// 30 x database-size, not unbounded.
const MAX_KEPT_BACKUPS: usize = 30;

#[derive(Serialize)]
struct BackupInfo {
    filename: String,
    created_at_unix: u64,
    size_bytes: u64,
}

/// Scans the app data directory for restaurant.db.bak-<unix-seconds> files
/// and returns them (path, unix-seconds-stamp), newest first. Shared by
/// list_database_backups (reporting) and backup_database_file (pruning) so
/// the two can't quietly disagree on what counts as a backup file.
fn scan_backup_files(dir: &std::path::Path) -> Result<Vec<(std::path::PathBuf, u64)>, String> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut backups = vec![];
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(stamp_str) = name.strip_prefix("restaurant.db.bak-") {
            if let Ok(stamp) = stamp_str.parse::<u64>() {
                backups.push((entry.path(), stamp));
            }
        }
    }
    backups.sort_by(|a, b| b.1.cmp(&a.1));
    Ok(backups)
}

/// Copies restaurant.db -> restaurant.db.bak-<unix-seconds> in the app's
/// data directory before migrations run, so there is always a rollback
/// point. Safe to call even if no database file exists yet (first run).
/// Also prunes anything past the newest MAX_KEPT_BACKUPS -- best-effort;
/// a pruning failure (e.g. a file locked by antivirus) is logged and
/// swallowed rather than failing the backup itself, since a slightly
/// longer backup list is a far smaller problem than skipping the backup.
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

    if let Ok(existing) = scan_backup_files(&dir) {
        for (old_path, _) in existing.into_iter().skip(MAX_KEPT_BACKUPS) {
            let _ = std::fs::remove_file(old_path);
        }
    }

    Ok(backup_path.to_string_lossy().to_string())
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
    let backups = scan_backup_files(&dir)?
        .into_iter()
        .map(|(path, stamp)| {
            let filename = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            BackupInfo { filename, created_at_unix: stamp, size_bytes: size }
        })
        .collect();
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
        .invoke_handler(tauri::generate_handler![
            backup_database_file,
            list_database_backups,
            restore_database_backup,
            get_device_fingerprint
        ])
        .run(tauri::generate_context!())
        .expect("error while running restaurant billing app");
}
