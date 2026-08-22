import { onRequestPost as __api_admin_customer_history_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\customer-history.js"
import { onRequestPost as __api_admin_dashboard_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\dashboard.js"
import { onRequestPost as __api_admin_issue_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\issue.js"
import { onRequestPost as __api_admin_label_device_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\label-device.js"
import { onRequestPost as __api_admin_list_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\list.js"
import { onRequestPost as __api_admin_notes_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\notes.js"
import { onRequestPost as __api_admin_products_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\products.js"
import { onRequestPost as __api_admin_revoke_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\admin\\revoke.js"
import { onRequestOptions as __api_backup_restore_js_onRequestOptions } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\backup\\restore.js"
import { onRequestPost as __api_backup_restore_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\backup\\restore.js"
import { onRequestOptions as __api_backup_upload_js_onRequestOptions } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\backup\\upload.js"
import { onRequestPost as __api_backup_upload_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\backup\\upload.js"
import { onRequestOptions as __api_activate_js_onRequestOptions } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\activate.js"
import { onRequestPost as __api_activate_js_onRequestPost } from "C:\\Desktop\\BILLING SOFTWARE\\Latest Version\\Restaurant\\tauri-app-phase2-v2\\licensing-platform\\functions\\api\\activate.js"

export const routes = [
    {
      routePath: "/api/admin/customer-history",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_customer_history_js_onRequestPost],
    },
  {
      routePath: "/api/admin/dashboard",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_dashboard_js_onRequestPost],
    },
  {
      routePath: "/api/admin/issue",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_issue_js_onRequestPost],
    },
  {
      routePath: "/api/admin/label-device",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_label_device_js_onRequestPost],
    },
  {
      routePath: "/api/admin/list",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_list_js_onRequestPost],
    },
  {
      routePath: "/api/admin/notes",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_notes_js_onRequestPost],
    },
  {
      routePath: "/api/admin/products",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_products_js_onRequestPost],
    },
  {
      routePath: "/api/admin/revoke",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_revoke_js_onRequestPost],
    },
  {
      routePath: "/api/backup/restore",
      mountPath: "/api/backup",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_backup_restore_js_onRequestOptions],
    },
  {
      routePath: "/api/backup/restore",
      mountPath: "/api/backup",
      method: "POST",
      middlewares: [],
      modules: [__api_backup_restore_js_onRequestPost],
    },
  {
      routePath: "/api/backup/upload",
      mountPath: "/api/backup",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_backup_upload_js_onRequestOptions],
    },
  {
      routePath: "/api/backup/upload",
      mountPath: "/api/backup",
      method: "POST",
      middlewares: [],
      modules: [__api_backup_upload_js_onRequestPost],
    },
  {
      routePath: "/api/activate",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_activate_js_onRequestOptions],
    },
  {
      routePath: "/api/activate",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_activate_js_onRequestPost],
    },
  ]