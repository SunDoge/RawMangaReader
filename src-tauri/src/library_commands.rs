use std::path::{Path, PathBuf};

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"];

fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            IMAGE_EXTENSIONS
                .iter()
                .any(|item| extension.eq_ignore_ascii_case(item))
        })
}

fn image_files_in_folder(folder: &Path) -> Result<Vec<String>, String> {
    if !folder.is_dir() {
        return Err(format!("文件夹不存在或无法访问: {}", folder.display()));
    }
    let mut paths = std::fs::read_dir(folder)
        .map_err(|error| format!("无法读取文件夹 {}: {error}", folder.display()))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_ok_and(|file_type| file_type.is_file()))
        .map(|entry| entry.path())
        .filter(|path| is_supported_image(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    paths.sort_by_key(|path| path.to_lowercase());
    Ok(paths)
}

#[tauri::command]
pub async fn list_image_files(folder: PathBuf) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || image_files_in_folder(&folder))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn lists_only_supported_direct_child_images() {
        let folder = std::env::temp_dir().join(format!("rmr-library-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(folder.join("nested")).unwrap();
        fs::write(folder.join("002.PNG"), []).unwrap();
        fs::write(folder.join("001.jpg"), []).unwrap();
        fs::write(folder.join("notes.txt"), []).unwrap();
        fs::write(folder.join("nested/003.jpg"), []).unwrap();

        let files = image_files_in_folder(&folder).unwrap();
        assert_eq!(files.len(), 2);
        assert!(files[0].ends_with("001.jpg"));
        assert!(files[1].ends_with("002.PNG"));
        fs::remove_dir_all(folder).unwrap();
    }
}
