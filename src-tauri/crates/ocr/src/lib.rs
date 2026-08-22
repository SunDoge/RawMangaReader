use anyhow::{bail, Context, Result};
use image::{imageops, RgbImage};
use oar_ocr::prelude::{OAROCRBuilder, TextRegion, OAROCR};
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

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct VerticalMergeOptions {
    pub enabled: bool,
    pub min_aspect_ratio: f32,
    pub min_overlap_ratio: f32,
    pub max_center_offset_ratio: f32,
    pub max_gap_width_ratio: f32,
}

impl Default for VerticalMergeOptions {
    fn default() -> Self {
        Self {
            enabled: true,
            min_aspect_ratio: 1.2,
            min_overlap_ratio: 0.5,
            max_center_offset_ratio: 0.15,
            max_gap_width_ratio: 1.5,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrPoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
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
        self.recognize_page_with_options(image_path, VerticalMergeOptions::default())
    }

    pub fn recognize_page_with_options(
        &self,
        image_path: &Path,
        merge_options: VerticalMergeOptions,
    ) -> Result<Vec<OcrRegion>> {
        let image = image::open(image_path)
            .with_context(|| format!("failed to open image: {}", image_path.display()))?
            .to_rgb8();
        self.recognize_page_image(&image, merge_options)
    }

    pub fn recognize_page_image(
        &self,
        image: &RgbImage,
        merge_options: VerticalMergeOptions,
    ) -> Result<Vec<OcrRegion>> {
        let (width, height) = image.dimensions();
        let results = self
            .pipeline
            .predict(vec![image.clone()])
            .context("PP-OCRv6 page inference failed")?;

        let mut regions = results[0]
            .text_regions
            .iter()
            .filter_map(|region| normalized_region(region, width, height))
            .collect::<Vec<_>>();
        if merge_options.enabled {
            regions = merge_vertical_regions(regions, width, height, merge_options);
        }
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
        self.recognize_region_image(&image, rect)
    }

    pub fn recognize_region_image(
        &self,
        image: &RgbImage,
        rect: RelativeRect,
    ) -> Result<RegionRecognition> {
        validate_rect(rect)?;
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

        let crop = imageops::crop_imm(image, x, y, width, height).to_image();
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

fn merge_vertical_regions(
    mut regions: Vec<OcrRegion>,
    image_width: u32,
    image_height: u32,
    options: VerticalMergeOptions,
) -> Vec<OcrRegion> {
    if regions.len() < 2 {
        return regions;
    }

    regions.sort_by(|a, b| {
        let a_center_x = a.x + a.width / 2.0;
        let b_center_x = b.x + b.width / 2.0;
        b_center_x.total_cmp(&a_center_x).then(a.y.total_cmp(&b.y))
    });

    let mut merged = Vec::with_capacity(regions.len());
    let mut consumed = vec![false; regions.len()];
    for start in 0..regions.len() {
        if consumed[start] {
            continue;
        }

        let mut column = regions[start].clone();
        consumed[start] = true;
        if !is_vertical_region(&column, image_width, image_height, options) {
            merged.push(column);
            continue;
        }

        loop {
            let next =
                (0..regions.len())
                    .filter(|&index| !consumed[index])
                    .filter(|&index| {
                        can_merge_vertical(
                            &column,
                            &regions[index],
                            image_width,
                            image_height,
                            options,
                        )
                    })
                    .min_by(|&left, &right| {
                        vertical_gap(&column, &regions[left], image_height)
                            .total_cmp(&vertical_gap(&column, &regions[right], image_height))
                    });
            let Some(next) = next else { break };
            column = merge_region_pair(column, &regions[next]);
            consumed[next] = true;
        }
        merged.push(column);
    }
    merged
}

fn is_vertical_region(
    region: &OcrRegion,
    image_width: u32,
    image_height: u32,
    options: VerticalMergeOptions,
) -> bool {
    let width = region.width * image_width as f32;
    let height = region.height * image_height as f32;
    height >= width * options.min_aspect_ratio
}

fn vertical_gap(upper: &OcrRegion, lower: &OcrRegion, image_height: u32) -> f32 {
    (lower.y - (upper.y + upper.height)).max(0.0) * image_height as f32
}

fn can_merge_vertical(
    upper: &OcrRegion,
    lower: &OcrRegion,
    image_width: u32,
    image_height: u32,
    options: VerticalMergeOptions,
) -> bool {
    if !is_vertical_region(lower, image_width, image_height, options) || lower.y < upper.y {
        return false;
    }

    let left = upper.x.max(lower.x);
    let right = (upper.x + upper.width).min(lower.x + lower.width);
    let overlap = (right - left).max(0.0) * image_width as f32;
    let upper_width = upper.width * image_width as f32;
    let lower_width = lower.width * image_width as f32;
    let overlap_ratio = overlap / upper_width.min(lower_width).max(1.0);
    let center_distance =
        ((upper.x + upper.width / 2.0) - (lower.x + lower.width / 2.0)).abs() * image_width as f32;
    let aligned = overlap_ratio >= options.min_overlap_ratio
        && center_distance <= upper_width.max(lower_width) * options.max_center_offset_ratio;

    let gap = vertical_gap(upper, lower, image_height);
    let max_gap = upper_width.max(lower_width) * options.max_gap_width_ratio;
    aligned && gap <= max_gap
}

fn merge_region_pair(upper: OcrRegion, lower: &OcrRegion) -> OcrRegion {
    let left = upper.x.min(lower.x);
    let top = upper.y.min(lower.y);
    let right = (upper.x + upper.width).max(lower.x + lower.width);
    let bottom = (upper.y + upper.height).max(lower.y + lower.height);
    let upper_weight = upper.text.chars().count().max(1) as f32;
    let lower_weight = lower.text.chars().count().max(1) as f32;

    OcrRegion {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        polygon: vec![
            OcrPoint { x: left, y: top },
            OcrPoint { x: right, y: top },
            OcrPoint {
                x: right,
                y: bottom,
            },
            OcrPoint { x: left, y: bottom },
        ],
        text: format!("{}{}", upper.text, lower.text),
        confidence: (upper.confidence * upper_weight + lower.confidence * lower_weight)
            / (upper_weight + lower_weight),
    }
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
        assert!(validate_rect(RelativeRect {
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.4
        })
        .is_ok());
        assert!(validate_rect(RelativeRect {
            x: 0.9,
            y: 0.2,
            width: 0.2,
            height: 0.4
        })
        .is_err());
        assert!(validate_rect(RelativeRect {
            x: 0.1,
            y: 0.2,
            width: 0.0,
            height: 0.4
        })
        .is_err());
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

    fn region(x: f32, y: f32, width: f32, height: f32, text: &str) -> OcrRegion {
        OcrRegion {
            x,
            y,
            width,
            height,
            polygon: Vec::new(),
            text: text.to_owned(),
            confidence: 0.9,
        }
    }

    #[test]
    fn merges_aligned_vertical_fragments_top_to_bottom() {
        let regions = vec![
            region(0.8, 0.28, 0.04, 0.12, "です"),
            region(0.805, 0.1, 0.04, 0.14, "こんにちは"),
        ];
        let merged = merge_vertical_regions(regions, 1000, 1000, VerticalMergeOptions::default());

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].text, "こんにちはです");
        assert_eq!(merged[0].polygon.len(), 4);
    }

    #[test]
    fn keeps_neighboring_columns_separate() {
        let regions = vec![
            region(0.8, 0.1, 0.04, 0.15, "右"),
            region(0.74, 0.27, 0.04, 0.15, "左"),
        ];

        assert_eq!(merge_vertical_regions(regions, 1000, 1000, VerticalMergeOptions::default()).len(), 2);
    }

    #[test]
    fn keeps_staggered_overlapping_bubbles_separate() {
        let regions = vec![
            region(0.1013, 0.4729, 0.0288, 0.0543, "ひとり？"),
            region(0.0650, 0.5271, 0.0525, 0.0517, "んだ"),
        ];

        assert_eq!(
            merge_vertical_regions(regions, 800, 1142, VerticalMergeOptions::default()).len(),
            2
        );
    }

    #[test]
    fn keeps_aligned_text_from_separate_enclosures_separate() {
        let regions = vec![
            region(0.8737, 0.0648, 0.0562, 0.0928, "品評会？"),
            region(0.8675, 0.1918, 0.0437, 0.0806, "農産物の"),
        ];

        assert_eq!(
            merge_vertical_regions(regions, 800, 1142, VerticalMergeOptions::default()).len(),
            2
        );
    }

    #[test]
    fn keeps_distant_vertical_fragments_separate() {
        let regions = vec![
            region(0.8, 0.1, 0.04, 0.1, "上"),
            region(0.8, 0.4, 0.04, 0.1, "下"),
        ];

        assert_eq!(merge_vertical_regions(regions, 1000, 1000, VerticalMergeOptions::default()).len(), 2);
    }

    #[test]
    fn does_not_merge_horizontal_lines() {
        let regions = vec![
            region(0.2, 0.1, 0.2, 0.04, "first"),
            region(0.2, 0.15, 0.2, 0.04, "second"),
        ];

        assert_eq!(merge_vertical_regions(regions, 1000, 1000, VerticalMergeOptions::default()).len(), 2);
    }
}
