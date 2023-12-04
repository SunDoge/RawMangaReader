use std::{path::Path, sync::Arc};

use image::{imageops::FilterType, DynamicImage, RgbImage};
use ndarray::{Array4, CowArray};
use ort::{
    tensor::OrtOwnedTensor, Environment, ExecutionProvider, GraphOptimizationLevel, Session,
    SessionBuilder, Value,
};

#[derive(Debug)]
pub struct OcrModel {
    session: Session,
    vocab: Vec<String>,
}

pub fn make_vocab(content: &str) -> Vec<String> {
    let vocab: Vec<_> = content.split('\n').map(|x| x.to_owned()).collect();
    vocab
}

pub fn make_vocab_from_file<P: AsRef<Path>>(path: P) -> std::io::Result<Vec<String>> {
    let content = std::fs::read_to_string(path)?;
    let vocab = make_vocab(&content);
    Ok(vocab)
}

impl OcrModel {
    pub fn new(session: Session, vocab: Vec<String>) -> Self {
        Self { session, vocab }
    }

    pub fn from_file(model_path: &str, vocab_path: &str) -> anyhow::Result<Self> {
        let environment = Arc::new(
            Environment::builder()
                .with_execution_providers([
                    ExecutionProvider::CUDA(Default::default()),
                    ExecutionProvider::CPU(Default::default()),
                ])
                .build()?,
        );

        let session = SessionBuilder::new(&environment)?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_model_from_file(model_path)?;

        let vocab = make_vocab_from_file(vocab_path)?;

        Ok(Self {
            // environment,
            session,
            vocab,
        })
    }

    /// image: [B, C, H, W]
    /// num_beams: default 4
    /// max_length: default 300
    pub fn generate(
        &self,
        image: Array4<f32>,
        num_beams: usize,
        max_length: usize,
    ) -> anyhow::Result<Vec<String>> {
        let batch_size = image.shape()[0];
        let max_length_array = CowArray::from(ndarray::arr0(max_length as i64)).into_dyn();
        let num_beams_array = CowArray::from(ndarray::arr0(num_beams as i64)).into_dyn();
        let image_array = CowArray::from(image).into_dyn();

        let allocator = self.session.allocator();

        let inputs = vec![
            Value::from_array(allocator, &image_array)?,
            Value::from_array(allocator, &num_beams_array)?,
            Value::from_array(allocator, &max_length_array)?,
        ];

        let outputs: Vec<Value> = self.session.run(inputs)?;

        let output_ids: OrtOwnedTensor<i64, _> = outputs[0].try_extract()?;

        // Shape: [batch_size, length]
        let output_ids_view = output_ids.view();

        let words: Vec<Vec<_>> = output_ids_view
            .axis_iter(ndarray::Axis(0))
            .map(|v| {
                v.iter()
                    .filter(|&&idx| idx > 14) // Check vocab.txt
                    .map(|&i| &self.vocab[i as usize])
                    // .filter(|&w| w != "[CLS]" && w != "[SEP]")
                    .map(|s| s.to_string())
                    .collect()
            })
            .collect();

        let sentences: Vec<String> = words.iter().map(|w| w.concat()).collect();

        assert_eq!(sentences.len(), batch_size);

        Ok(sentences)
    }

    pub fn preprocess_image(
        img: &DynamicImage,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Array4<f32> {
        let cropped = img.crop_imm(x, y, width, height);
        Self::preprocess_image_cropped(&cropped)
    }

    /// 针对已经crop好的图片
    pub fn preprocess_image_cropped(cropped: &DynamicImage) -> Array4<f32> {
        let resized = Self::transform_image(cropped);

        Array4::from_shape_vec(
            (1, resized.height() as usize, resized.width() as usize, 3),
            resized.into_vec(),
        )
        .unwrap()
        .permuted_axes([0, 3, 1, 2])
        .map(|&x| x as f32 / 255.0)
        .map(|&x| (x - 0.5) / 0.5)
    }

    pub fn transform_image(img: &DynamicImage) -> RgbImage {
        img.resize_exact(224, 224, FilterType::Triangle)
            .grayscale()
            .to_rgb8()
    }
}
