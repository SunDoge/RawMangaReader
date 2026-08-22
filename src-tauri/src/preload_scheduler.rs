use crate::image_store::ImageStore;
use crate::ocr_commands::{model_directory, recognize_page_cached, OcrModelKind, OcrState};
use ocr::{OcrRegion, VerticalMergeOptions};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

const PRELOAD_QUEUE_CAPACITY: usize = 4;
pub const OCR_PREFETCH_EVENT: &str = "ocr-prefetched";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreloadRequest {
    request_id: String,
    image_ids: Vec<String>,
    merge_options: VerticalMergeOptions,
    recognize: bool,
    model_kind: OcrModelKind,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PrefetchedOcr {
    request_id: String,
    image_id: String,
    regions: Vec<OcrRegion>,
    raw_regions: Vec<OcrRegion>,
}

pub struct PreloadScheduler {
    sender: mpsc::Sender<PreloadRequest>,
}

impl PreloadScheduler {
    pub fn new(app: AppHandle, images: Arc<ImageStore>, ocr: Arc<OcrState>) -> Self {
        let (sender, mut receiver) = mpsc::channel::<PreloadRequest>(PRELOAD_QUEUE_CAPACITY);
        tauri::async_runtime::spawn(async move {
            while let Some(mut request) = receiver.recv().await {
                'generation: loop {
                    let Ok(directory) = model_directory(&app, request.model_kind) else {
                        return;
                    };
                    for image_id in request.image_ids.clone() {
                        let preload_images = Arc::clone(&images);
                        let preload_id = image_id.clone();
                        let preloaded = tauri::async_runtime::spawn_blocking(move || {
                            preload_images.decoded(&preload_id)
                        })
                        .await;
                        let mut replacement = None;
                        while let Ok(newer) = receiver.try_recv() {
                            replacement = Some(newer);
                        }
                        if let Some(newer) = replacement {
                            request = newer;
                            continue 'generation;
                        }
                        if !matches!(preloaded, Ok(Ok(_))) || !request.recognize {
                            continue;
                        }
                        let result = recognize_page_cached(
                            Arc::clone(&ocr),
                            Arc::clone(&images),
                            directory.clone(),
                            image_id.clone(),
                            request.merge_options,
                            request.model_kind,
                        )
                        .await;
                        let mut replacement = None;
                        while let Ok(newer) = receiver.try_recv() {
                            replacement = Some(newer);
                        }
                        if let Some(newer) = replacement {
                            request = newer;
                            continue 'generation;
                        }
                        let Ok(result) = result else { continue };
                        let _ = app.emit(
                            OCR_PREFETCH_EVENT,
                            PrefetchedOcr {
                                request_id: request.request_id.clone(),
                                image_id,
                                regions: result.regions,
                                raw_regions: result.raw_regions,
                            },
                        );
                    }
                    break;
                }
            }
        });
        Self { sender }
    }

    async fn schedule(&self, request: PreloadRequest) -> Result<(), String> {
        self.sender
            .send(request)
            .await
            .map_err(|_| "image preload scheduler is unavailable".to_string())
    }
}

#[tauri::command]
pub async fn schedule_image_preload(
    scheduler: State<'_, PreloadScheduler>,
    request: PreloadRequest,
) -> Result<(), String> {
    scheduler.schedule(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preload_queue_is_bounded() {
        assert_eq!(PRELOAD_QUEUE_CAPACITY, 4);
    }
}
