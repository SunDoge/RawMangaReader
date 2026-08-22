use oar_ocr::prelude::load_image;
use std::path::Path;
use std::time::Instant;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let image_path = std::env::args()
        .nth(1)
        .ok_or("usage: cargo run -p ocr --example smoke -- <image> <model-directory>")?;
    let model_directory = std::env::args()
        .nth(2)
        .ok_or("usage: cargo run -p ocr --example smoke -- <image> <model-directory>")?;

    let load_started = Instant::now();
    let ocr = ocr::create_ppocrv6(Path::new(&model_directory))?;
    eprintln!("model_load_ms={}", load_started.elapsed().as_millis());

    let inference_started = Instant::now();
    let results = ocr.predict(vec![load_image(Path::new(&image_path))?])?;
    eprintln!("inference_ms={}", inference_started.elapsed().as_millis());

    let regions = &results[0].text_regions;
    println!("regions={}", regions.len());
    for region in regions {
        if let Some((text, confidence)) = region.text_with_confidence() {
            println!("{confidence:.4}\t{text}");
        }
    }

    Ok(())
}
