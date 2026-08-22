use std::fs;
use std::path::PathBuf;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_png_export_data() {
        assert!(write_exported_image("test.png".into(), vec![1, 2, 3]).is_err());
    }
}
