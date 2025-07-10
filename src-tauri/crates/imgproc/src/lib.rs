use image::imageops::{FilterType, crop_imm, resize};
use image::{GenericImage, GenericImageView, ImageResult, Rgb, RgbImage};

pub struct Xyxy {
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,
}

impl Xyxy {
    pub fn shrink(&self, image_width: f32, image_height: f32) -> Xyxy {
        let x1 = self.x1.max(0.0).min(image_width);
        let y1 = self.y1.max(0.0).min(image_height);
        let x2 = self.x2.max(0.0).min(image_width);
        let y2 = self.y2.max(0.0).min(image_height);

        Xyxy { x1, y1, x2, y2 }
    }
}

pub struct Cxcywh {
    pub cx: f32,
    pub cy: f32,
    pub w: f32,
    pub h: f32,
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

impl<'a> From<&'a Xyxy> for Cxcywh {
    fn from(xyxy: &'a Xyxy) -> Self {
        let cx = (xyxy.x1 + xyxy.x2) / 2.0;
        let cy = (xyxy.y1 + xyxy.y2) / 2.0;
        let w = xyxy.x2 - xyxy.x1;
        let h = xyxy.y2 - xyxy.y1;

        Cxcywh { cx, cy, w, h }
    }
}

impl<'a> From<&'a Cxcywh> for Xyxy {
    fn from(bbox: &'a Cxcywh) -> Self {
        let x1 = bbox.cx - bbox.w / 2.0;
        let y1 = bbox.cy - bbox.h / 2.0;
        let x2 = bbox.cx + bbox.w / 2.0;
        let y2 = bbox.cy + bbox.h / 2.0;

        Xyxy { x1, y1, x2, y2 }
    }
}

impl<'a> From<&'a Xyxy> for Xywh {
    fn from(xyxy: &'a Xyxy) -> Self {
        let x = xyxy.x1;
        let y = xyxy.y1;
        let w = xyxy.x2 - xyxy.x1;
        let h = xyxy.y2 - xyxy.y1;

        Xywh { x, y, w, h }
    }
}

pub fn crop_and_resize(
    img: &RgbImage,
    bbox: &Cxcywh,
    expand_ratio: f32,
    target_size: u32,
) -> ImageResult<RgbImage> {
    let expanded_bbox = bbox.expand(expand_ratio);
    let shinked_bbox = Xyxy::from(&expanded_bbox).shrink(img.width() as f32, img.height() as f32);
    let xywh = Xywh::from(&shinked_bbox);
    let cropped_img = crop_imm(
        img,
        xywh.x as u32,
        xywh.y as u32,
        xywh.w as u32,
        xywh.h as u32,
    );
    let max_size = cropped_img.width().max(cropped_img.height()) as f32;
    let ratio = target_size as f32 / max_size;
    let resized_img = resize(
        &cropped_img.to_image(),
        (cropped_img.width() as f32 * ratio) as u32,
        (cropped_img.height() as f32 * ratio) as u32,
        FilterType::CatmullRom,
    );
    let mut padded_img =
        RgbImage::from_pixel(target_size as u32, target_size as u32, Rgb([114, 114, 114]));
    let x = (target_size - resized_img.width()) / 2;
    let y = (target_size - resized_img.height()) / 2;
    padded_img.copy_from(&resized_img, x, y)?;
    Ok(padded_img)
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
