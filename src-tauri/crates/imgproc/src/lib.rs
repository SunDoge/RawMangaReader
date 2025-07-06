use image::RgbImage;
use image::imageops::{crop_imm};




pub struct Bbox {
    cx: f32,
    cy: f32,
    w: f32,
    h: f32,
}

pub fn crop_and_resize(img: &RgbImage, bbox: &Bbox)  {
    let x = (bbox.cx - bbox.w / 2.0) as u32;
    let y = (bbox.cy - bbox.h / 2.0) as u32;
    let w = bbox.w as u32;
    let h = bbox.h as u32;

}



pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
