use oar_ocr::prelude::{OAROCR, OAROCRBuilder};
use std::path::Path;

pub const DETECTION_MODEL: &str = "pp-ocrv6_small_det.onnx";
pub const RECOGNITION_MODEL: &str = "pp-ocrv6_small_rec.onnx";
pub const CHARACTER_DICTIONARY: &str = "ppocrv6_dict.txt";

pub fn create_ppocrv6(
    model_directory: &Path,
) -> Result<OAROCR, Box<dyn std::error::Error>> {
    Ok(OAROCRBuilder::new(
        model_directory.join(DETECTION_MODEL),
        model_directory.join(RECOGNITION_MODEL),
        model_directory.join(CHARACTER_DICTIONARY),
    )
    .build()?)
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
    }
}
