use crate::image_store::ImageStore;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

#[tauri::command]
pub fn read_export_source(
    images: tauri::State<'_, Arc<ImageStore>>,
    image_id: String,
) -> Result<tauri::ipc::Response, String> {
    images
        .original_bytes(&image_id)
        .map(tauri::ipc::Response::new)
        .map_err(|error| error.to_string())
}

const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

#[tauri::command]
pub fn write_exported_image(path: String, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.len() < PNG_SIGNATURE.len() || &bytes[..PNG_SIGNATURE.len()] != PNG_SIGNATURE {
        return Err("导出数据不是有效的 PNG".to_string());
    }
    let path = PathBuf::from(path);
    if path
        .extension()
        .and_then(|value| value.to_str())
        .is_none_or(|value| !value.eq_ignore_ascii_case("png"))
    {
        return Err("导出文件必须使用 .png 扩展名".to_string());
    }
    fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_exported_text(path: String, text: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if path
        .extension()
        .and_then(|value| value.to_str())
        .is_none_or(|value| !value.eq_ignore_ascii_case("txt"))
    {
        return Err("文本导出文件必须使用 .txt 扩展名".to_string());
    }
    fs::write(path, text.as_bytes()).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_png_export_data() {
        assert!(write_exported_image("test.png".into(), vec![1, 2, 3]).is_err());
    }

    #[test]
    fn rejects_a_non_txt_text_export_path() {
        assert!(write_exported_text("test.png".into(), "text".into()).is_err());
    }
}
