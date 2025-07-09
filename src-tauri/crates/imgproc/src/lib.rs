use image::RgbImage;
use image::imageops::{crop_imm};




pub struct Cxcywh {
    cx: f32,
    cy: f32,
    w: f32,
    h: f32,
}

impl Cxcywh {
    pub fn expand(&self, ratio: f32) -> Cxcywh {
        let new_w = self.w * ratio;
        let new_h = self.h * ratio;
        let new_cx = self.cx;
        let new_cy = self.cy;

        Cxcywh {
            cx: new_cx,
            cy: new_cy,
            w: new_w,
            h: new_h,
        }
    }
}

pub struct Xywh {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

impl Xywh {
    pub fn expand(&self, ratio: f32) -> Xywh {
        let new_x = self.x - self.w * ratio / 2.0;
        let new_y = self.y - self.h * ratio / 2.0;
        let new_w = self.w * ratio;
        let new_h = self.h * ratio;

        Xywh {
            x: new_x,
            y: new_y,
            w: new_w,
            h: new_h,
        }
    }
}

impl<'a> From<&'a Cxcywh> for Xywh {
    fn from(bbox: &'a Cxcywh) -> Self {
        let x = bbox.cx - bbox.w / 2.0;
        let y = bbox.cy - bbox.h / 2.0;
        let w = bbox.w;
        let h = bbox.h;

        Xywh { x, y, w, h }
    }
}

pub fn crop_and_resize(img: &RgbImage, bbox: &Cxcywh, expand_ratio: f32)  {
    let expanded_bbox = bbox.expand(expand_ratio);
    let x = (expanded_bbox.cx - expanded_bbox.w / 2.0) as u32;
    let y = (expanded_bbox.cy - expanded_bbox.h / 2.0) as u32;
    let w = expanded_bbox.w as u32;
    let h = expanded_bbox.h as u32;
    let cropped_img = crop_imm(img, x, y, w, h);



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
