// use tauri_plugin_log::{Target, TargetKind};

use tauri_plugin_aptabase::EventTracker;

const APTABASE_APP_KEY: &'static str = "A-EU-6545056706";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_aptabase::Builder::new(APTABASE_APP_KEY).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let _ = app.track_event("app_started", None);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .build(tauri::generate_context!())
        .expect("error while running tauri app")
        .run(|handler, event| match event {
            tauri::RunEvent::Exit { .. } => {
                let _ = handler.track_event("app_exited", None);
                handler.flush_events_blocking();
            }
            _ => {}
        });
}
