// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use std::{collections::HashMap, sync::Mutex};
use tauri_plugin_aptabase::EventTracker;

use image::DynamicImage;
use manga_ocr_onnx::inference::OcrModel;
use serde::Deserialize;
use tauri::Manager;
use tauri::PathResolver;
use tauri_plugin_log::LogTarget;

type Model = Mutex<Option<OcrModel>>;
// Map<Path, Image>
type ImageMap = Mutex<HashMap<String, DynamicImage>>;

/// All fields are in percentage.
#[derive(Debug, Deserialize)]
pub struct Bbox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Bbox {
    pub fn scale(&self, image_width: u32, image_height: u32) -> (u32, u32, u32, u32) {
        let x = (self.x * image_width as f64) as u32;
        let y = (self.y * image_height as f64) as u32;
        let width = (self.width * image_width as f64) as u32;
        let height = (self.height * image_height as f64) as u32;
        (x, y, width, height)
    }
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Load model from file, set model.
#[tauri::command]
async fn model_new(
    model_path: &str,
    vocab_path: &str,
    model: tauri::State<'_, Model>,
) -> Result<(), String> {
    *model.lock().unwrap() =
        Some(OcrModel::from_file(model_path, vocab_path).map_err(|err| err.to_string())?);
    Ok(())
}

/// Use index to fetch image, use bbox to crop it and get the ocr result.
#[tauri::command]
async fn model_infer(
    path: &str,
    bbox: Bbox,
    image_map: tauri::State<'_, ImageMap>,
    model: tauri::State<'_, Model>,
) -> Result<String, String> {
    let mut image_map = image_map.lock().unwrap();
    let model = model.lock().unwrap();

    let img = image_map
        .entry(path.to_string())
        .or_insert_with(|| image::open(path).unwrap());

    if let Some(m) = model.as_ref() {
        let (x, y, width, height) = bbox.scale(img.width(), img.height());
        let img_arr = OcrModel::preprocess_image(img, x, y, width, height);
        let mut res = m.generate(img_arr, 4, 300).unwrap();
        Ok(res.pop().unwrap())
    } else {
        Err("OcrModel not init".to_string())
    }
}

#[tauri::command]
async fn model_infer_base64(
    model: tauri::State<'_, Model>,
    image_buffer: String,
) -> Result<String, String> {
    let buf = base64_simd::STANDARD_NO_PAD
        .decode_to_vec(&image_buffer)
        .unwrap();
    let img = image::load_from_memory_with_format(&buf, image::ImageFormat::Png).unwrap();
    if let Some(m) = model.lock().unwrap().as_ref() {
        let img_arr = OcrModel::preprocess_image_cropped(&img);
        let mut res = m.generate(img_arr, 4, 300).unwrap();
        Ok(res.pop().unwrap())
    } else {
        Err("OcrModel not init".to_string())
    }
}

fn set_ort_env(path_resolver: &PathResolver) {
    let dynamic_library_name = if cfg!(target_os = "linux") {
        "libonnxruntime.so"
    } else if cfg!(target_os = "windows") {
        "onnxruntime.dll"
        // return; // windows下自动加载同一目录下的dll
    } else if cfg!(target_os = "macos") {
        "libonnxruntime.dylib"
    } else {
        panic!("unknown os")
    };

    let dynamic_library_path = path_resolver
        .resolve_resource(dynamic_library_name)
        .expect("fail to resolve dynamic library path");

    info!("dynamic lib: {}", dynamic_library_path.display());
    std::env::set_var("ORT_DYLIB_PATH", dynamic_library_path);
}

const APP_KEY: &'static str = "A-EU-6545056706";

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_aptabase::Builder::new(APP_KEY).build())
        .plugin(tauri_plugin_clipboard::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
                .with_colors(Default::default())
                .level_for("tauri_plugin_aptabase", log::LevelFilter::Error)
                .build(),
        )
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }

            app.track_event("app_started", None);
            set_ort_env(&app.path_resolver());
            Ok(())
        })
        // .plugin(tauri_plugin_persisted_scope::init())
        // OcrModel
        .manage::<Model>(Mutex::new(None))
        // Store all images
        .manage::<ImageMap>(Mutex::new(HashMap::new()))
        .invoke_handler(tauri::generate_handler![
            greet,
            model_new,
            model_infer,
            model_infer_base64,
        ])
        .build(tauri::generate_context!())
        .expect("fail to build")
        .run(|handler, event| match event {
            tauri::RunEvent::Exit => {
                handler.track_event("app_exited", None);
                handler.flush_events_blocking();
            }
            _ => {}
        });
}
