use imgproc::{Cxcywh, crop_and_resize};

fn main() {
    let p = std::env::args().nth(1).unwrap();
    let img = image::open(p).unwrap();
    let rgb_img = img.to_rgb8();
    let bbox = Cxcywh {
        cx: 0.0,
        cy: 0.0,
        w: img.width() as f32,
        h: img.height() as f32,
    };
    let expanded_bbox = bbox.expand(1.0);
    let cropped_img = crop_and_resize(&rgb_img, &expanded_bbox, 1.0, 224).unwrap();
    cropped_img.save("cropped.png").unwrap();
}
