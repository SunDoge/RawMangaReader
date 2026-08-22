use ocr::{
    OcrEngine, OcrRegion, RegionRecognition, RelativeRect, CHARACTER_DICTIONARY, DETECTION_MODEL,
    MODEL_VERSION, RECOGNITION_MODEL,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

const RELEASE_BASE_URL: &str = "https://github.com/GreatV/oar-ocr/releases/download/v0.7.0";

struct ModelFile {
    name: &'static str,
    sha256: &'static str,
    size: u64,
}

const MODEL_FILES: [ModelFile; 3] = [
    ModelFile {
        name: DETECTION_MODEL,
        sha256: "d73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e",
        size: 9_880_512,
    },
    ModelFile {
        name: RECOGNITION_MODEL,
        sha256: "5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634",
        size: 21_159_378,
    },
    ModelFile {
        name: CHARACTER_DICTIONARY,
        sha256: "b5f2bfe2bdd9448429e3e82b51c789775d9b42f2403d082b00662eb77e401c5d",
        size: 74_947,
    },
];

pub struct OcrState {
    engine: Mutex<Option<OcrEngine>>,
    download_lock: Mutex<()>,
}

impl Default for OcrState {
    fn default() -> Self {
        Self {
            engine: Mutex::new(None),
            download_lock: Mutex::new(()),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    installed: bool,
    ready: bool,
    version: &'static str,
    downloaded_bytes: u64,
    total_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelProgress {
    file: String,
    downloaded_bytes: u64,
    total_bytes: u64,
}

fn model_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("models").join(MODEL_VERSION))
        .map_err(|error| error.to_string())
}

fn total_model_bytes() -> u64 {
    MODEL_FILES.iter().map(|file| file.size).sum()
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn file_is_valid(directory: &Path, model_file: &ModelFile) -> bool {
    let path = directory.join(model_file.name);
    path.metadata()
        .is_ok_and(|metadata| metadata.len() == model_file.size)
        && sha256_file(&path).is_ok_and(|hash| hash == model_file.sha256)
}

fn model_status_at(directory: &Path, ready: bool) -> ModelStatus {
    let downloaded_bytes = MODEL_FILES
        .iter()
        .filter(|file| file_is_valid(directory, file))
        .map(|file| file.size)
        .sum();
    ModelStatus {
        installed: downloaded_bytes == total_model_bytes(),
        ready,
        version: MODEL_VERSION,
        downloaded_bytes,
        total_bytes: total_model_bytes(),
    }
}

#[tauri::command]
pub async fn get_ocr_model_status(
    app: AppHandle,
    state: State<'_, Arc<OcrState>>,
) -> Result<ModelStatus, String> {
    let directory = model_directory(&app)?;
    let ready = state
        .engine
        .lock()
        .map_err(|_| "OCR state lock is poisoned".to_string())?
        .is_some();
    tauri::async_runtime::spawn_blocking(move || model_status_at(&directory, ready))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn download_ocr_model(
    app: AppHandle,
    state: State<'_, Arc<OcrState>>,
) -> Result<ModelStatus, String> {
    let state = Arc::clone(state.inner());
    let directory = model_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _download_guard = state
            .download_lock
            .lock()
            .map_err(|_| "OCR download lock is poisoned".to_string())?;
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        let client = reqwest::blocking::Client::builder()
            .user_agent("RawMangaReader/0.1")
            .build()
            .map_err(|error| error.to_string())?;
        let mut completed_bytes = MODEL_FILES
            .iter()
            .filter(|file| file_is_valid(&directory, file))
            .map(|file| file.size)
            .sum::<u64>();

        for model_file in &MODEL_FILES {
            if file_is_valid(&directory, model_file) {
                continue;
            }
            let target = directory.join(model_file.name);
            let partial = directory.join(format!("{}.part", model_file.name));
            let url = format!("{RELEASE_BASE_URL}/{}", model_file.name);
            let mut response = client
                .get(url)
                .send()
                .and_then(reqwest::blocking::Response::error_for_status)
                .map_err(|error| format!("failed to download {}: {error}", model_file.name))?;
            let mut output = File::create(&partial).map_err(|error| error.to_string())?;
            let mut file_bytes = 0_u64;
            let mut buffer = [0_u8; 64 * 1024];
            loop {
                let read = response
                    .read(&mut buffer)
                    .map_err(|error| error.to_string())?;
                if read == 0 {
                    break;
                }
                output
                    .write_all(&buffer[..read])
                    .map_err(|error| error.to_string())?;
                file_bytes += read as u64;
                let _ = app.emit(
                    "ocr-model-progress",
                    ModelProgress {
                        file: model_file.name.to_owned(),
                        downloaded_bytes: completed_bytes + file_bytes,
                        total_bytes: total_model_bytes(),
                    },
                );
            }
            output.sync_all().map_err(|error| error.to_string())?;
            if partial.metadata().map_err(|error| error.to_string())?.len() != model_file.size
                || sha256_file(&partial)? != model_file.sha256
            {
                let _ = fs::remove_file(&partial);
                return Err(format!("model checksum failed: {}", model_file.name));
            }
            if target.exists() {
                fs::remove_file(&target).map_err(|error| error.to_string())?;
            }
            fs::rename(&partial, &target).map_err(|error| error.to_string())?;
            completed_bytes += model_file.size;
        }

        *state
            .engine
            .lock()
            .map_err(|_| "OCR state lock is poisoned".to_string())? = None;
        Ok(model_status_at(&directory, false))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn remove_ocr_model(
    app: AppHandle,
    state: State<'_, Arc<OcrState>>,
) -> Result<ModelStatus, String> {
    let state = Arc::clone(state.inner());
    let directory = model_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        *state
            .engine
            .lock()
            .map_err(|_| "OCR state lock is poisoned".to_string())? = None;
        if directory.exists() {
            fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        }
        Ok(model_status_at(&directory, false))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn with_engine<T>(
    state: &OcrState,
    directory: &Path,
    operation: impl FnOnce(&OcrEngine) -> anyhow::Result<T>,
) -> Result<T, String> {
    let mut engine = state
        .engine
        .lock()
        .map_err(|_| "OCR state lock is poisoned".to_string())?;
    if engine.is_none() {
        if !MODEL_FILES
            .iter()
            .all(|file| file_is_valid(directory, file))
        {
            return Err("OCR 模型尚未下载或校验失败".to_string());
        }
        *engine = Some(OcrEngine::new(directory).map_err(|error| error.to_string())?);
    }
    operation(engine.as_ref().expect("OCR engine initialized")).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn recognize_page(
    app: AppHandle,
    state: State<'_, Arc<OcrState>>,
    image_path: String,
    merge_options: Option<ocr::VerticalMergeOptions>,
) -> Result<Vec<OcrRegion>, String> {
    let state = Arc::clone(state.inner());
    let directory = model_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        with_engine(&state, &directory, |engine| {
            engine.recognize_page_with_options(
                Path::new(&image_path),
                merge_options.unwrap_or_default(),
            )
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn recognize_region(
    app: AppHandle,
    state: State<'_, Arc<OcrState>>,
    image_path: String,
    rect: RelativeRect,
) -> Result<RegionRecognition, String> {
    let state = Arc::clone(state.inner());
    let directory = model_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        with_engine(&state, &directory, |engine| {
            engine.recognize_region(Path::new(&image_path), rect)
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_size_matches_known_assets() {
        assert_eq!(total_model_bytes(), 31_114_837);
        assert!(MODEL_FILES.iter().all(|file| file.sha256.len() == 64));
    }
}
