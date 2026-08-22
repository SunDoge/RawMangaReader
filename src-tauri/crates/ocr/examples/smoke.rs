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
    let ocr = ocr::OcrEngine::new(Path::new(&model_directory))?;
    eprintln!("model_load_ms={}", load_started.elapsed().as_millis());

    let inference_started = Instant::now();
    let regions = ocr.recognize_page(Path::new(&image_path))?;
    eprintln!("inference_ms={}", inference_started.elapsed().as_millis());

    println!("regions={}", regions.len());
    for region in regions {
        println!("{:.4}\t{}", region.confidence, region.text);
    }

    Ok(())
}
