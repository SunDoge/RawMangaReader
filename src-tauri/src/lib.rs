mod image_store;
mod ocr_commands;

use image_store::ImageStore;
use ocr_commands::OcrState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(OcrState::default()))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let cache_directory = app.path().app_cache_dir()?.join("image-cache");
            let images = tauri::async_runtime::block_on(ImageStore::new(cache_directory))?;
            app.manage(Arc::new(images));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ocr_commands::get_ocr_model_status,
            ocr_commands::download_ocr_model,
            ocr_commands::remove_ocr_model,
            ocr_commands::recognize_page,
            ocr_commands::recognize_region,
            ocr_commands::register_images,
            ocr_commands::release_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
