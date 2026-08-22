mod export_commands;
mod image_store;
mod library_commands;
mod network;
mod ocr_commands;
mod preload_scheduler;

use image_store::ImageStore;
use network::NetworkState;
use ocr_commands::OcrState;
use preload_scheduler::PreloadScheduler;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ocr = Arc::new(OcrState::default());
    tauri::Builder::default()
        .manage(Arc::clone(&ocr))
        .manage(NetworkState::default())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(move |app| {
            let cache_directory = app.path().app_cache_dir()?.join("image-cache");
            let images = Arc::new(tauri::async_runtime::block_on(ImageStore::new(
                cache_directory,
            ))?);
            app.manage(Arc::clone(&images));
            app.manage(PreloadScheduler::new(
                app.handle().clone(),
                images,
                Arc::clone(&ocr),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            export_commands::read_export_source,
            export_commands::write_exported_image,
            export_commands::write_exported_text,
            ocr_commands::get_ocr_model_status,
            ocr_commands::download_ocr_model,
            ocr_commands::remove_ocr_model,
            ocr_commands::recognize_page,
            ocr_commands::recognize_region,
            ocr_commands::register_images,
            ocr_commands::release_images,
            ocr_commands::get_image_cache_stats,
            ocr_commands::clear_image_cache,
            library_commands::list_image_files,
            network::set_http_proxy,
            preload_scheduler::schedule_image_preload,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
