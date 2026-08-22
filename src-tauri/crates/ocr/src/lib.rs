use anyhow::{Context, Result, bail};
use image::imageops;
use oar_ocr::prelude::{OAROCR, OAROCRBuilder, TextRegion};
use serde::{Deserialize, Serialize};
use std::path::Path;

pub const MODEL_VERSION: &str = "ppocrv6-small-0.7.0";
pub const DETECTION_MODEL: &str = "pp-ocrv6_small_det.onnx";
pub const RECOGNITION_MODEL: &str = "pp-ocrv6_small_rec.onnx";
pub const CHARACTER_DICTIONARY: &str = "ppocrv6_dict.txt";

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelativeRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrPoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrRegion {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub polygon: Vec<OcrPoint>,
    pub text: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionRecognition {
    pub text: String,
    pub confidence: f32,
}

pub struct OcrEngine {
    pipeline: OAROCR,
}

impl OcrEngine {
    pub fn new(model_directory: &Path) -> Result<Self> {
        for filename in [DETECTION_MODEL, RECOGNITION_MODEL, CHARACTER_DICTIONARY] {
            let path = model_directory.join(filename);
            if !path.is_file() {
                bail!("OCR model file is missing: {}", path.display());
            }
        }

        let pipeline = OAROCRBuilder::new(
            model_directory.join(DETECTION_MODEL),
            model_directory.join(RECOGNITION_MODEL),
            model_directory.join(CHARACTER_DICTIONARY),
        )
        .region_batch_size(64)
        .build()
        .context("failed to initialize PP-OCRv6")?;

        Ok(Self { pipeline })
    }

    pub fn recognize_page(&self, image_path: &Path) -> Result<Vec<OcrRegion>> {
        let image = image::open(image_path)
            .with_context(|| format!("failed to open image: {}", image_path.display()))?
            .to_rgb8();
        let (width, height) = image.dimensions();
        let results = self
            .pipeline
            .predict(vec![image])
            .context("PP-OCRv6 page inference failed")?;

        let mut regions = results[0]
            .text_regions
            .iter()
            .filter_map(|region| normalized_region(region, width, height))
            .collect::<Vec<_>>();
        sort_manga_regions(&mut regions);
        Ok(regions)
    }

    pub fn recognize_region(
        &self,
        image_path: &Path,
        rect: RelativeRect,
    ) -> Result<RegionRecognition> {
        validate_rect(rect)?;
        let image = image::open(image_path)
            .with_context(|| format!("failed to open image: {}", image_path.display()))?
            .to_rgb8();
        let (image_width, image_height) = image.dimensions();
        let x = (rect.x * image_width as f32).floor() as u32;
        let y = (rect.y * image_height as f32).floor() as u32;
        let width = (rect.width * image_width as f32).ceil() as u32;
        let height = (rect.height * image_height as f32).ceil() as u32;
        let width = width.min(image_width.saturating_sub(x));
        let height = height.min(image_height.saturating_sub(y));
        if width == 0 || height == 0 {
            bail!("OCR region is outside the image");
        }

        let crop = imageops::crop_imm(&image, x, y, width, height).to_image();
        let results = self
            .pipeline
            .predict(vec![crop])
            .context("PP-OCRv6 region inference failed")?;
        let recognized = results[0]
            .text_regions
            .iter()
            .filter_map(TextRegion::text_with_confidence)
            .collect::<Vec<_>>();
        if recognized.is_empty() {
            return Ok(RegionRecognition {
                text: String::new(),
                confidence: 0.0,
            });
        }

        Ok(RegionRecognition {
            text: recognized
                .iter()
                .map(|(text, _)| *text)
                .collect::<Vec<_>>()
                .join("\n"),
            confidence: recognized.iter().map(|(_, score)| score).sum::<f32>()
                / recognized.len() as f32,
        })
    }
}

fn normalized_region(region: &TextRegion, width: u32, height: u32) -> Option<OcrRegion> {
    let (text, confidence) = region.text_with_confidence()?;
    let points = &region.bounding_box.points;
    if points.is_empty() {
        return None;
    }
    let min_x = points.iter().map(|point| point.x).fold(f32::MAX, f32::min);
    let min_y = points.iter().map(|point| point.y).fold(f32::MAX, f32::min);
    let max_x = points.iter().map(|point| point.x).fold(f32::MIN, f32::max);
    let max_y = points.iter().map(|point| point.y).fold(f32::MIN, f32::max);
    let width_f = width as f32;
    let height_f = height as f32;

    Some(OcrRegion {
        x: (min_x / width_f).clamp(0.0, 1.0),
        y: (min_y / height_f).clamp(0.0, 1.0),
        width: ((max_x - min_x) / width_f).clamp(0.0, 1.0),
        height: ((max_y - min_y) / height_f).clamp(0.0, 1.0),
        polygon: points
            .iter()
            .map(|point| OcrPoint {
                x: (point.x / width_f).clamp(0.0, 1.0),
                y: (point.y / height_f).clamp(0.0, 1.0),
            })
            .collect(),
        text: text.to_owned(),
        confidence,
    })
}

fn validate_rect(rect: RelativeRect) -> Result<()> {
    let values = [rect.x, rect.y, rect.width, rect.height];
    if values.iter().any(|value| !value.is_finite())
        || rect.x < 0.0
        || rect.y < 0.0
        || rect.width <= 0.0
        || rect.height <= 0.0
        || rect.x + rect.width > 1.0001
        || rect.y + rect.height > 1.0001
    {
        bail!("invalid relative OCR region");
    }
    Ok(())
}

fn sort_manga_regions(regions: &mut [OcrRegion]) {
    regions.sort_by(|a, b| {
        let a_center_x = a.x + a.width / 2.0;
        let b_center_x = b.x + b.width / 2.0;
        let a_column = (a_center_x / 0.08).round() as i32;
        let b_column = (b_center_x / 0.08).round() as i32;
        if a_column == b_column {
            a.y.total_cmp(&b.y)
        } else {
            b_column.cmp(&a_column)
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ppocrv6_assets_use_a_matching_size() {
        assert!(DETECTION_MODEL.contains("small"));
        assert!(RECOGNITION_MODEL.contains("small"));
        assert_eq!(CHARACTER_DICTIONARY, "ppocrv6_dict.txt");
    }

    #[test]
    fn pipeline_can_cross_a_blocking_task_boundary() {
        fn assert_send<T: Send>() {}
        assert_send::<OAROCR>();
        assert_send::<OcrEngine>();
    }

    #[test]
    fn validates_relative_regions() {
        assert!(validate_rect(RelativeRect { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }).is_ok());
        assert!(validate_rect(RelativeRect { x: 0.9, y: 0.2, width: 0.2, height: 0.4 }).is_err());
        assert!(validate_rect(RelativeRect { x: 0.1, y: 0.2, width: 0.0, height: 0.4 }).is_err());
    }

    #[test]
    fn sorts_manga_columns_right_to_left_and_top_to_bottom() {
        let region = |x: f32, y: f32, text: &str| OcrRegion {
            x,
            y,
            width: 0.05,
            height: 0.1,
            polygon: Vec::new(),
            text: text.to_owned(),
            confidence: 1.0,
        };
        let mut regions = vec![
            region(0.2, 0.1, "left"),
            region(0.8, 0.5, "right-bottom"),
            region(0.8, 0.1, "right-top"),
        ];
        sort_manga_regions(&mut regions);
        assert_eq!(
            regions
                .iter()
                .map(|item| item.text.as_str())
                .collect::<Vec<_>>(),
            vec!["right-top", "right-bottom", "left"]
        );
    }
}
