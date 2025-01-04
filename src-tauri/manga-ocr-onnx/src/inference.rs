use std::{path::Path, sync::Arc};

use anyhow::Result;
use image::{imageops::FilterType, DynamicImage, RgbImage};

use ort::{
    session::{builder::GraphOptimizationLevel, Session},
    value::Tensor,
};

use crate::beam_search::Beam;
use candle_core::IndexOp;

pub struct TrOcrModel {
    encoder_session: Session,
    decoder_session: Session,
}

impl TrOcrModel {
    pub fn from_path(encoder_path: &str, decoder_path: &str, vocab_path: &str) -> Result<Self> {
        let encoder_session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .commit_from_file(encoder_path)?;
        let decoder_session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .commit_from_file(decoder_path)?;
        // let vocab = make_vocab_from_file(vocab_path)?;
        Ok(Self {
            encoder_session,
            decoder_session,
        })
    }

    pub fn generate(&self, image: &candle_core::Tensor) -> Result<()> {
        dbg!(&image.shape(), &image.dtype());

        let shape = image.shape().clone().into_dims();
        let data = image.flatten_all()?.to_vec1::<f32>()?;

        let pixel_values: Tensor<f32> = Tensor::from_array((shape, data))?;

        dbg!(&pixel_values.shape());

        let encoder_hidden_state = {
            let mut binding = self.encoder_session.create_binding()?;
            binding.bind_input("pixel_values", &pixel_values)?;
            binding.bind_output_to_device(
                "last_hidden_state",
                &self.encoder_session.allocator().memory_info(),
            )?;
            let mut outputs = binding.run()?;
            outputs
                .remove("last_hidden_state")
                .expect("encoder_hidden_state not found")
        };

        // dbg!(&encoder_hidden_state.try_extract_raw_tensor::<f32>()?);

        dbg!(encoder_hidden_state.shape()?);

        let mut beams = vec![Beam::new(2)];
        let mut finished_beams: Vec<Beam> = Vec::new();

        let max_length = 300;
        for _ in 0..max_length {
            let mut candidates = Vec::new();
            for beam in beams.iter() {
                let input_ids =
                    Tensor::from_array(([1, beam.token_ids.len()], beam.token_ids.as_ref()))?;
                let mut binding = self.decoder_session.create_binding()?;
                binding.bind_input("input_ids", &input_ids)?;
                binding.bind_input("encoder_hidden_states", &encoder_hidden_state)?;
                binding.bind_output_to_device(
                    "logits",
                    &self.decoder_session.allocator().memory_info(),
                )?;
                let outputs = binding.run()?;

                let (shape, data) = outputs["logits"].try_extract_raw_tensor::<f32>()?;

                let shape: Vec<usize> = shape.into_iter().map(|x| *x as usize).collect();

                let logits =
                    candle_core::Tensor::from_slice(data, shape, &candle_core::Device::Cpu)?;

                let n = logits.shape().dim(1)?;
                let last_logits = logits.i((0, n - 1, ..))?;
                dbg!(&last_logits.shape());
                let log_probs = log_softmax(&last_logits)?;
                // dbg!(log_probs.to_vec1::<f32>()?);
                let topk_indices = log_probs.arg_sort_last_dim(false)?.narrow(0, 0, 4)?;
                let topk_values = log_probs.index_select(&topk_indices, 0)?;

                dbg!(&topk_indices);
                dbg!(&topk_values);

                let indices = topk_indices.to_vec1::<u32>()?;
                let values = topk_values.to_vec1::<f32>()?;

                for (index, log_prob) in indices.into_iter().zip(values) {
                    let mut new_seq = beam.token_ids.clone();
                    new_seq.push(index as i64);
                    let new_beam = Beam {
                        token_ids: new_seq,
                        log_prob: beam.log_prob + log_prob,
                    };
                    if index == 3 {
                        finished_beams.push(new_beam);
                    } else {
                        candidates.push(new_beam);
                    }
                }
            }

            if finished_beams.len() >= 4 {
                break;
            }

            candidates.sort_by(|a, b| {
                let v1 = a.log_prob / (a.token_ids.len() as f32).powf(2.0);
                let v2 = b.log_prob / (b.token_ids.len() as f32).powf(2.0);
                v2.partial_cmp(&v1).unwrap()
            });

            beams = candidates.into_iter().take(4).collect();
        }

        let best_beam = if !finished_beams.is_empty() {
            finished_beams.sort_by(|a, b| {
                let v1 = a.log_prob / (a.token_ids.len() as f32).powf(2.0);
                let v2 = b.log_prob / (b.token_ids.len() as f32).powf(2.0);
                v2.partial_cmp(&v1).unwrap()
            });
            finished_beams.first().unwrap()
        } else {
            beams.first().unwrap()
        };

        // dbg!(&finished_beams);
        dbg!(&best_beam);
        Ok(())
    }
}

#[inline]
fn log_softmax(logits: &candle_core::Tensor) -> Result<candle_core::Tensor> {
    let max_value = logits.max_keepdim(0)?;
    let diff = logits.broadcast_sub(&max_value)?;
    let sum_exp = diff.exp()?.sum_keepdim(0)?;
    let log_sum_exp = diff.broadcast_sub(&sum_exp.log()?)?;
    Ok(log_sum_exp)
}

// #[derive(Debug)]
// pub struct OcrModel {
//     session: Session,
//     vocab: Vec<String>,
// }

// pub fn make_vocab(content: &str) -> Vec<String> {
//     let vocab: Vec<_> = content.split('\n').map(|x| x.to_owned()).collect();
//     vocab
// }

// pub fn make_vocab_from_file<P: AsRef<Path>>(path: P) -> std::io::Result<Vec<String>> {
//     let content = std::fs::read_to_string(path)?;
//     let vocab = make_vocab(&content);
//     Ok(vocab)
// }

// impl OcrModel {
//     pub fn new(session: Session, vocab: Vec<String>) -> Self {
//         Self { session, vocab }
//     }

//     pub fn from_file(model_path: &str, vocab_path: &str) -> anyhow::Result<Self> {
//         let environment = Arc::new(
//             Environment::builder()
//                 .with_execution_providers([
//                     ExecutionProvider::CUDA(Default::default()),
//                     ExecutionProvider::CPU(Default::default()),
//                 ])
//                 .build()?,
//         );

//         let session = SessionBuilder::new(&environment)?
//             .with_optimization_level(GraphOptimizationLevel::Level3)?
//             .with_model_from_file(model_path)?;

//         let vocab = make_vocab_from_file(vocab_path)?;

//         Ok(Self {
//             // environment,
//             session,
//             vocab,
//         })
//     }

//     /// image: [B, C, H, W]
//     /// num_beams: default 4
//     /// max_length: default 300
//     pub fn generate(
//         &self,
//         image: Array4<f32>,
//         num_beams: usize,
//         max_length: usize,
//     ) -> anyhow::Result<Vec<String>> {
//         let batch_size = image.shape()[0];
//         let max_length_array = CowArray::from(ndarray::arr0(max_length as i64)).into_dyn();
//         let num_beams_array = CowArray::from(ndarray::arr0(num_beams as i64)).into_dyn();
//         let image_array = CowArray::from(image).into_dyn();

//         let allocator = self.session.allocator();

//         let inputs = vec![
//             Value::from_array(allocator, &image_array)?,
//             Value::from_array(allocator, &num_beams_array)?,
//             Value::from_array(allocator, &max_length_array)?,
//         ];

//         let outputs: Vec<Value> = self.session.run(inputs)?;

//         let output_ids: OrtOwnedTensor<i64, _> = outputs[0].try_extract()?;

//         // Shape: [batch_size, length]
//         let output_ids_view = output_ids.view();

//         let words: Vec<Vec<_>> = output_ids_view
//             .axis_iter(ndarray::Axis(0))
//             .map(|v| {
//                 v.iter()
//                     .filter(|&&idx| idx > 14) // Check vocab.txt
//                     .map(|&i| &self.vocab[i as usize])
//                     // .filter(|&w| w != "[CLS]" && w != "[SEP]")
//                     .map(|s| s.to_string())
//                     .collect()
//             })
//             .collect();

//         let sentences: Vec<String> = words.iter().map(|w| w.concat()).collect();

//         assert_eq!(sentences.len(), batch_size);

//         Ok(sentences)
//     }

//     pub fn preprocess_image(
//         img: &DynamicImage,
//         x: u32,
//         y: u32,
//         width: u32,
//         height: u32,
//     ) -> Array4<f32> {
//         let cropped = img.crop_imm(x, y, width, height);
//         Self::preprocess_image_cropped(&cropped)
//     }

//     /// 针对已经crop好的图片
//     pub fn preprocess_image_cropped(cropped: &DynamicImage) -> Array4<f32> {
//         let resized = Self::transform_image(cropped);

//         Array4::from_shape_vec(
//             (1, resized.height() as usize, resized.width() as usize, 3),
//             resized.into_vec(),
//         )
//         .unwrap()
//         .permuted_axes([0, 3, 1, 2])
//         .map(|&x| x as f32 / 255.0)
//         .map(|&x| (x - 0.5) / 0.5)
//     }

//     pub fn transform_image(img: &DynamicImage) -> RgbImage {
//         img.resize_exact(224, 224, FilterType::Triangle)
//             .grayscale()
//             .to_rgb8()
//     }
// }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_softmax() {
        let logits = candle_core::Tensor::from_vec(
            vec![0.1f32, 0.5, 2.0, 3.0, 4.0],
            5,
            &candle_core::Device::Cpu,
        )
        .unwrap();
        let log_softmax = log_softmax(&logits).unwrap();
        let output = candle_core::Tensor::from_vec(
            vec![-4.3406f32, -3.9406, -2.4406, -1.4406, -0.4406],
            5,
            &candle_core::Device::Cpu,
        )
        .unwrap();
        // assert_eq!(
        //     log_softmax.to_vec1::<f32>().unwrap(),
        //     output.to_vec1::<f32>().unwrap()
        // );
    }
}
