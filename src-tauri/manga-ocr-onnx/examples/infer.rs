use candle_core::Tensor;
use manga_ocr_onnx::inference::TrOcrModel;
use zune_image::traits::OperationsTrait;

fn main() -> anyhow::Result<()> {
    // let model = OcrModel::from_file("../trocr-fixed.onnx", "../vocab.txt")?;

    // let img = image::open("../assets/examples/00.jpg")?;

    // let img_arr = OcrModel::preprocess_image(&img, 0, 0, 200, 178);

    // let res = model.generate(img_arr, 4, 300)?;
    // dbg!(&res);

    let img = image::open("../../assets/examples/01.jpg")?;
    let img_resized = img.resize_exact(224, 224, image::imageops::FilterType::CatmullRom);

    let out_buf = img_resized.to_rgb8();

    let img_arr = Tensor::from_slice(&out_buf, (1, 224, 224, 3), &candle_core::Device::Cpu)?;

    let x = Tensor::from_vec(vec![0.5f32], (1, 1, 1, 1), &candle_core::Device::Cpu)?;
    let y = Tensor::from_vec(vec![255.0f32], (1, 1, 1, 1), &candle_core::Device::Cpu)?;

    let img_arr = img_arr
        .to_dtype(candle_core::DType::F32)?
        .broadcast_div(&y)?
        .broadcast_sub(&x)?
        .broadcast_div(&x)?
        .permute((0, 3, 1, 2))?;

    let model = TrOcrModel::from_path(
        "/tmp/mocr/encoder_model.onnx",
        "/tmp/mocr/decoder_model.onnx",
        "/tmp/mocr/vocab.txt",
    )?;

    // let array = Tensor::ones(
    //     (1, 3, 224, 224),
    //     candle_core::DType::F32,
    //     &candle_core::Device::Cpu,
    // )?;

    model.generate(&img_arr)?;

    Ok(())
}
