use anyhow::{bail, Context, Result};
use foyer::{
    BlockEngineConfig, Cache, CacheBuilder, DeviceBuilder, FsDeviceBuilder, HybridCache,
    HybridCacheBuilder, HybridCachePolicy, PsyncIoEngineConfig,
};
use image::RgbImage;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use slotmap::{DefaultKey, Key, KeyData, SlotMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;

const DECODED_CACHE_BYTES: usize = 512 * 1024 * 1024;
const OCR_MEMORY_CACHE_BYTES: usize = 32 * 1024 * 1024;
const OCR_DISK_CACHE_BYTES: usize = 512 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredImage {
    pub id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheStats {
    pub active_images: usize,
    pub decoded_entries: usize,
    pub decoded_bytes: usize,
    pub decoded_capacity_bytes: usize,
    pub ocr_memory_entries: usize,
    pub ocr_memory_bytes: usize,
    pub ocr_memory_capacity_bytes: usize,
    pub ocr_disk_capacity_bytes: usize,
    pub ocr_disk_read_bytes: usize,
    pub ocr_disk_write_bytes: usize,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CacheKind {
    Decoded,
    Ocr,
    All,
}

#[derive(Debug, Clone)]
struct ImageResource {
    path: PathBuf,
    fingerprint: String,
}

pub struct ImageStore {
    resources: Mutex<SlotMap<DefaultKey, ImageResource>>,
    decoded: Cache<String, Arc<RgbImage>>,
    ocr: HybridCache<String, Vec<u8>>,
}

impl ImageStore {
    pub async fn new(cache_directory: PathBuf) -> Result<Self> {
        let ocr_directory = cache_directory.join("ocr");
        fs::create_dir_all(&ocr_directory).with_context(|| {
            format!(
                "failed to create cache directory: {}",
                ocr_directory.display()
            )
        })?;

        let decoded = CacheBuilder::new(DECODED_CACHE_BYTES)
            .with_name("decoded-images")
            .with_weighter(|_, image: &Arc<RgbImage>| image.as_raw().len())
            .build();
        let ocr = HybridCacheBuilder::new()
            .with_name("ocr-results")
            .with_policy(HybridCachePolicy::WriteOnInsertion)
            .memory(OCR_MEMORY_CACHE_BYTES)
            .with_weighter(|key: &String, value: &Vec<u8>| key.len() + value.len())
            .storage()
            .with_io_engine_config(PsyncIoEngineConfig::new())
            .with_engine_config(BlockEngineConfig::new(
                FsDeviceBuilder::new(&ocr_directory)
                    .with_capacity(OCR_DISK_CACHE_BYTES)
                    .build()
                    .context("failed to create foyer cache device")?,
            ))
            .build()
            .await
            .context("failed to open foyer OCR cache")?;

        Ok(Self {
            resources: Mutex::new(SlotMap::new()),
            decoded,
            ocr,
        })
    }

    pub fn register_paths(&self, paths: Vec<String>) -> Result<Vec<RegisteredImage>> {
        let resources = paths
            .into_iter()
            .map(|path| {
                let path = PathBuf::from(path);
                let canonical = path
                    .canonicalize()
                    .with_context(|| format!("failed to resolve image: {}", path.display()))?;
                if !canonical.is_file() {
                    bail!("image is not a file: {}", canonical.display());
                }
                let fingerprint = image_fingerprint(&canonical)?;
                Ok(ImageResource {
                    path: canonical,
                    fingerprint,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let mut store = self
            .resources
            .lock()
            .map_err(|_| anyhow::anyhow!("image store lock is poisoned"))?;
        Ok(resources
            .into_iter()
            .map(|resource| {
                let path = resource.path.to_string_lossy().into_owned();
                let key = store.insert(resource);
                RegisteredImage {
                    id: encode_key(key),
                    path,
                }
            })
            .collect())
    }

    pub fn release(&self, ids: &[String]) -> Result<()> {
        let mut store = self
            .resources
            .lock()
            .map_err(|_| anyhow::anyhow!("image store lock is poisoned"))?;
        for id in ids {
            if let Some(key) = decode_key(id) {
                store.remove(key);
            }
        }
        Ok(())
    }

    pub fn fingerprint(&self, id: &str) -> Result<String> {
        Ok(self.resource(id)?.fingerprint)
    }

    pub fn decoded(&self, id: &str) -> Result<Arc<RgbImage>> {
        let resource = self.resource(id)?;
        if let Some(entry) = self.decoded.get(&resource.fingerprint) {
            return Ok(Arc::clone(entry.value()));
        }

        let image = Arc::new(
            image::open(&resource.path)
                .with_context(|| format!("failed to open image: {}", resource.path.display()))?
                .to_rgb8(),
        );
        self.decoded
            .insert(resource.fingerprint, Arc::clone(&image));
        Ok(image)
    }

    pub fn ocr_cache(&self) -> &HybridCache<String, Vec<u8>> {
        &self.ocr
    }

    pub fn stats(&self) -> Result<ImageCacheStats> {
        let active_images = self
            .resources
            .lock()
            .map_err(|_| anyhow::anyhow!("image store lock is poisoned"))?
            .len();
        let ocr_memory = self.ocr.memory();
        let disk = self.ocr.storage().statistics();
        Ok(ImageCacheStats {
            active_images,
            decoded_entries: self.decoded.entries(),
            decoded_bytes: self.decoded.usage(),
            decoded_capacity_bytes: self.decoded.capacity(),
            ocr_memory_entries: ocr_memory.entries(),
            ocr_memory_bytes: ocr_memory.usage(),
            ocr_memory_capacity_bytes: ocr_memory.capacity(),
            ocr_disk_capacity_bytes: OCR_DISK_CACHE_BYTES,
            ocr_disk_read_bytes: disk.disk_read_bytes(),
            ocr_disk_write_bytes: disk.disk_write_bytes(),
        })
    }

    pub async fn clear(&self, kind: CacheKind) -> Result<()> {
        if matches!(kind, CacheKind::Decoded | CacheKind::All) {
            self.decoded.clear();
        }
        if matches!(kind, CacheKind::Ocr | CacheKind::All) {
            self.ocr.clear().await?;
        }
        Ok(())
    }

    fn resource(&self, id: &str) -> Result<ImageResource> {
        let key = decode_key(id).ok_or_else(|| anyhow::anyhow!("invalid image id"))?;
        self.resources
            .lock()
            .map_err(|_| anyhow::anyhow!("image store lock is poisoned"))?
            .get(key)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("image id is no longer available"))
    }
}

pub fn ocr_cache_key(
    fingerprint: &str,
    model_version: &str,
    merge_options: &impl Serialize,
) -> Result<String> {
    let mut hasher = Sha256::new();
    hasher.update(fingerprint.as_bytes());
    hasher.update([0]);
    hasher.update(model_version.as_bytes());
    hasher.update([0]);
    hasher.update(serde_json::to_vec(merge_options)?);
    Ok(format!("{:x}", hasher.finalize()))
}

fn image_fingerprint(path: &Path) -> Result<String> {
    let metadata = path.metadata()?;
    let modified = metadata.modified()?.duration_since(UNIX_EPOCH)?;
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(modified.as_nanos().to_le_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

fn encode_key(key: DefaultKey) -> String {
    format!("{:016x}", key.data().as_ffi())
}

fn decode_key(id: &str) -> Option<DefaultKey> {
    u64::from_str_radix(id, 16)
        .ok()
        .map(|value| DefaultKey::from(KeyData::from_ffi(value)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn image_ids_preserve_slotmap_generations() {
        let mut map = SlotMap::<DefaultKey, ()>::new();
        let old = map.insert(());
        let encoded = encode_key(old);
        assert_eq!(decode_key(&encoded), Some(old));
        map.remove(old);
        let replacement = map.insert(());
        assert_ne!(old, replacement);
        assert_ne!(encode_key(old), encode_key(replacement));
    }

    #[test]
    fn ocr_keys_change_with_model_and_options() {
        let defaults = ocr::VerticalMergeOptions::default();
        let mut changed = defaults;
        changed.max_gap_width_ratio = 2.0;
        assert_ne!(
            ocr_cache_key("image", "model-a", &defaults).unwrap(),
            ocr_cache_key("image", "model-a", &changed).unwrap()
        );
        assert_ne!(
            ocr_cache_key("image", "model-a", &defaults).unwrap(),
            ocr_cache_key("image", "model-b", &defaults).unwrap()
        );
    }

    #[test]
    fn registers_decodes_and_invalidates_images() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("raw-manga-reader-{nonce}"));
        fs::create_dir_all(&directory).unwrap();
        let image_path = directory.join("page.png");
        RgbImage::from_pixel(2, 3, image::Rgb([1, 2, 3]))
            .save(&image_path)
            .unwrap();

        let store =
            tauri::async_runtime::block_on(ImageStore::new(directory.join("cache"))).unwrap();
        let registered = store
            .register_paths(vec![image_path.to_string_lossy().into_owned()])
            .unwrap();
        assert_eq!(
            store.decoded(&registered[0].id).unwrap().dimensions(),
            (2, 3)
        );
        let stats = store.stats().unwrap();
        assert_eq!(stats.active_images, 1);
        assert_eq!(stats.decoded_entries, 1);
        assert_eq!(stats.decoded_bytes, 18);
        store.release(&[registered[0].id.clone()]).unwrap();
        assert!(store.decoded(&registered[0].id).is_err());
        assert_eq!(store.stats().unwrap().active_images, 0);

        store.ocr.insert("page-key".to_owned(), vec![1, 2, 3]);
        tauri::async_runtime::block_on(store.ocr.storage().wait());
        let cached = tauri::async_runtime::block_on(store.ocr.get("page-key"))
            .unwrap()
            .unwrap();
        assert_eq!(&*cached, &[1, 2, 3]);
        tauri::async_runtime::block_on(store.clear(CacheKind::All)).unwrap();
        assert_eq!(store.stats().unwrap().decoded_entries, 0);
        assert!(tauri::async_runtime::block_on(store.ocr.get("page-key"))
            .unwrap()
            .is_none());
        tauri::async_runtime::block_on(store.ocr.close()).unwrap();
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }
}
