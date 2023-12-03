use manga_ocr_onnx::inference::OcrModel;

fn main() -> anyhow::Result<()> {
    let model = OcrModel::from_file("../trocr-fixed.onnx", "../vocab.txt")?;

    let img = image::open("../assets/examples/00.jpg")?;

    let img_arr = OcrModel::preprocess_image(&img, 0, 0, 200, 178);

    let res = model.generate(img_arr, 4, 300)?;
    dbg!(&res);
    Ok(())
}
