use super::*;

use axum::extract::Query;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use zip::ZipArchive;

const GITHUB_API_BASE: &str = "https://api.github.com";
const CHECKSUMS_ASSET_NAME: &str = "checksums.txt";
const DOWNLOAD_HOSTS: [&str; 3] = [
    "api.github.com",
    "github.com",
    "objects.githubusercontent.com",
];
const MAX_DOWNLOAD_BYTES: u64 = 500 * 1024 * 1024;

#[derive(Debug, Default, Deserialize)]
pub(super) struct UpdateQuery {
    force: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubReleaseAsset {
    name: String,
    browser_download_url: String,
    size: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    published_at: Option<String>,
    html_url: Option<String>,
    assets: Vec<GitHubReleaseAsset>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct UpdateCheckResult {
    repo: String,
    mode: String,
    is_portable: bool,
    has_update: bool,
    can_prepare: bool,
    can_rollback: bool,
    current_version: String,
    latest_version: String,
    release_tag: String,
    release_name: Option<String>,
    published_at: Option<String>,
    reason: Option<String>,
    checked_at_unix_secs: i64,
    release_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct UpdateActionResult {
    message: String,
    need_restart: bool,
}

#[derive(Debug, Clone)]
struct SelectedReleaseAssets {
    web_asset: GitHubReleaseAsset,
    service_asset: GitHubReleaseAsset,
    checksums_asset: Option<GitHubReleaseAsset>,
}

pub(super) async fn check_updates(
    State(state): State<Arc<AppState>>,
    Query(query): Query<UpdateQuery>,
) -> Response {
    let _ = query.force;
    match tokio::task::spawn_blocking(move || build_update_check_result(state.as_ref())).await {
        Ok(Ok(result)) => Json(result).into_response(),
        Ok(Err(err)) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": err })),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

pub(super) async fn perform_update(State(state): State<Arc<AppState>>) -> Response {
    let operation_lock = state.system_operation_lock.clone();
    let _guard = operation_lock.lock().await;
    let state_for_update = state.clone();
    match tokio::task::spawn_blocking(move || perform_update_impl(state_for_update.as_ref())).await
    {
        Ok(Ok(result)) => Json(result).into_response(),
        Ok(Err(err)) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": err })),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

pub(super) async fn rollback_update(State(state): State<Arc<AppState>>) -> Response {
    let operation_lock = state.system_operation_lock.clone();
    let _guard = operation_lock.lock().await;
    let state_for_rollback = state.clone();
    match tokio::task::spawn_blocking(move || rollback_update_impl(state_for_rollback.as_ref()))
        .await
    {
        Ok(Ok(result)) => Json(result).into_response(),
        Ok(Err(err)) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": err })),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

pub(super) async fn restart_runtime(State(state): State<Arc<AppState>>) -> Response {
    let state = state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(500)).await;
        if *state.spawned_service.lock().await {
            let addr = state.service_addr.clone();
            let _ = tokio::task::spawn_blocking(move || {
                codexmanager_service::request_shutdown(&addr);
            })
            .await;
        }
        let _ = state.shutdown_tx.send(true);
    });

    Json(UpdateActionResult {
        message: "restart initiated".to_string(),
        need_restart: false,
    })
    .into_response()
}

fn build_update_check_result(state: &AppState) -> Result<UpdateCheckResult, String> {
    let current = codexmanager_service::release_metadata();
    let checked_at = now_ts();
    let can_prepare = supports_self_update(state);
    let can_rollback = has_backup_files()?;
    let release = fetch_latest_release(current.repository.as_str())?;
    let latest_tag = release
        .as_ref()
        .map(|item| item.tag_name.clone())
        .unwrap_or_else(|| current.release_tag.clone());
    let latest_version = normalize_version(latest_tag.as_str());
    let current_version = normalize_version(current.version.as_str());
    let has_update = compare_versions(current_version.as_str(), latest_version.as_str()) < 0;

    Ok(UpdateCheckResult {
        repo: current.repository,
        mode: "web-self-update".to_string(),
        is_portable: false,
        has_update,
        can_prepare,
        can_rollback,
        current_version,
        latest_version,
        release_tag: latest_tag.clone(),
        release_name: release.as_ref().and_then(|item| item.name.clone()),
        published_at: release.as_ref().and_then(|item| item.published_at.clone()),
        reason: if !can_prepare {
            Some("当前运行形态不支持在线升级".to_string())
        } else if !has_update {
            Some("当前已是最新版本".to_string())
        } else {
            None
        },
        checked_at_unix_secs: checked_at,
        release_url: release
            .as_ref()
            .and_then(|item| item.html_url.clone())
            .unwrap_or_else(|| {
                format!(
                    "https://github.com/{}/releases/tag/{}",
                    codexmanager_service::release_repository(),
                    latest_tag
                )
            }),
    })
}

fn perform_update_impl(state: &AppState) -> Result<UpdateActionResult, String> {
    if !supports_self_update(state) {
        return Err("当前运行形态不支持在线升级".to_string());
    }

    let current = codexmanager_service::release_metadata();
    let release = fetch_latest_release(codexmanager_service::release_repository())?
        .ok_or_else(|| "未找到可用的 Release".to_string())?;
    let current_version = normalize_version(current.version.as_str());
    let latest_version = normalize_version(&release.tag_name);
    if compare_versions(current_version.as_str(), latest_version.as_str()) >= 0 {
        return Err("当前已是最新版本".to_string());
    }

    let selected_assets = select_release_assets(&release)?;
    let exe_path = std::env::current_exe().map_err(|err| err.to_string())?;
    let exe_path = fs::canonicalize(exe_path).map_err(|err| err.to_string())?;
    let exe_dir = exe_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("/usr/local/bin"));
    let web_bin = exe_path.clone();
    let service_bin = exe_dir.join(service_binary_name());
    if !service_bin.is_file() {
        return Err(format!("missing sibling service binary: {}", service_bin.display()));
    }

    let temp_dir = exe_dir.join(format!(
        ".codexmanager-update-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|err| err.to_string())?
            .as_millis()
    ));
    fs::create_dir_all(&temp_dir).map_err(|err| err.to_string())?;

    let web_archive = temp_dir.join(&selected_assets.web_asset.name);
    let service_archive = temp_dir.join(&selected_assets.service_asset.name);
    download_release_asset(&selected_assets.web_asset, &web_archive)?;
    download_release_asset(&selected_assets.service_asset, &service_archive)?;
    if let Some(checksums_asset) = selected_assets.checksums_asset.as_ref() {
        let checksum_path = temp_dir.join(CHECKSUMS_ASSET_NAME);
        download_release_asset(checksums_asset, &checksum_path)?;
        verify_checksum(&web_archive, &checksum_path)?;
        verify_checksum(&service_archive, &checksum_path)?;
    }

    let extracted_web = temp_dir.join(web_binary_name());
    let extracted_service = temp_dir.join(service_binary_name());
    extract_binary_from_zip(&web_archive, web_binary_name(), &extracted_web)?;
    extract_binary_from_zip(&service_archive, service_binary_name(), &extracted_service)?;
    set_executable(&extracted_web)?;
    set_executable(&extracted_service)?;

    replace_binary_pair(
        &web_bin,
        &web_bin.with_extension("backup"),
        &extracted_web,
        &service_bin,
        &service_bin.with_extension("backup"),
        &extracted_service,
    )?;

    let _ = fs::remove_dir_all(&temp_dir);

    Ok(UpdateActionResult {
        message: format!("已应用更新 {}", release.tag_name),
        need_restart: true,
    })
}

fn rollback_update_impl(state: &AppState) -> Result<UpdateActionResult, String> {
    if !supports_self_update(state) {
        return Err("当前运行形态不支持在线回滚".to_string());
    }

    let web_bin = fs::canonicalize(std::env::current_exe().map_err(|err| err.to_string())?)
        .map_err(|err| err.to_string())?;
    let web_backup = web_bin.with_extension("backup");
    let service_bin = web_bin
        .parent()
        .map(|dir| dir.join(service_binary_name()))
        .unwrap_or_else(|| PathBuf::from(service_binary_name()));
    let service_backup = service_bin.with_extension("backup");

    if !web_backup.is_file() || !service_backup.is_file() {
        return Err("未找到可回滚的备份文件".to_string());
    }

    swap_back_backup(&web_bin, &web_backup)?;
    swap_back_backup(&service_bin, &service_backup)?;

    Ok(UpdateActionResult {
        message: "已恢复到上一版本".to_string(),
        need_restart: true,
    })
}

fn supports_self_update(state: &AppState) -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let Some(dir) = exe.parent() else {
        return false;
    };
    let has_service_binary = dir.join(service_binary_name()).is_file();
    let spawned_service = *state.spawned_service.blocking_lock();
    let dir_writable = update_dir_writable(dir);
    can_self_update_runtime(
        cfg!(target_os = "linux"),
        read_env_trim("CODEXMANAGER_WEB_NO_SPAWN_SERVICE").is_some(),
        read_env_trim("CODEXMANAGER_SINGLE_CONTAINER").is_some(),
        spawned_service,
        has_service_binary,
        dir_writable,
    )
}

fn update_dir_writable(dir: &Path) -> bool {
    if !dir.is_dir() {
        return false;
    }
    let probe_path = dir.join(format!(
        ".codexmanager-write-probe-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or(0)
    ));
    match fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&probe_path)
    {
        Ok(_) => {
            let _ = fs::remove_file(&probe_path);
            true
        }
        Err(_) => false,
    }
}

fn can_self_update_runtime(
    is_linux: bool,
    no_spawn_service: bool,
    single_container_mode: bool,
    spawned_service: bool,
    has_service_binary: bool,
    dir_writable: bool,
) -> bool {
    if !is_linux || !has_service_binary || !dir_writable {
        return false;
    }
    if single_container_mode {
        return true;
    }
    if no_spawn_service {
        return false;
    }
    spawned_service
}

fn has_backup_files() -> Result<bool, String> {
    let web_bin = fs::canonicalize(std::env::current_exe().map_err(|err| err.to_string())?)
        .map_err(|err| err.to_string())?;
    let service_bin = web_bin
        .parent()
        .map(|dir| dir.join(service_binary_name()))
        .unwrap_or_else(|| PathBuf::from(service_binary_name()));
    Ok(web_bin.with_extension("backup").is_file() && service_bin.with_extension("backup").is_file())
}

fn fetch_latest_release(repository: &str) -> Result<Option<GitHubRelease>, String> {
    let url = format!("{}/repos/{}/releases/latest", GITHUB_API_BASE, repository);
    let response = reqwest::blocking::Client::builder()
        .user_agent("CodexManagerServer-Updater")
        .build()
        .map_err(|err| err.to_string())?
        .get(url)
        .send()
        .map_err(|err| err.to_string())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!("GitHub API returned {}", response.status()));
    }
    response
        .json::<GitHubRelease>()
        .map(Some)
        .map_err(|err| err.to_string())
}

fn select_release_assets(release: &GitHubRelease) -> Result<SelectedReleaseAssets, String> {
    let web_name = format!("CodexManager-web-{}-{}.zip", std::env::consts::OS, std::env::consts::ARCH);
    let service_name = format!(
        "CodexManager-service-{}-{}.zip",
        std::env::consts::OS,
        std::env::consts::ARCH
    );
    let web_asset = release
        .assets
        .iter()
        .find(|asset| asset.name == web_name)
        .cloned()
        .ok_or_else(|| format!("missing release asset: {web_name}"))?;
    let service_asset = release
        .assets
        .iter()
        .find(|asset| asset.name == service_name)
        .cloned()
        .ok_or_else(|| format!("missing release asset: {service_name}"))?;
    let checksums_asset = release
        .assets
        .iter()
        .find(|asset| asset.name == CHECKSUMS_ASSET_NAME)
        .cloned();

    Ok(SelectedReleaseAssets {
        web_asset,
        service_asset,
        checksums_asset,
    })
}

fn download_release_asset(asset: &GitHubReleaseAsset, dest: &Path) -> Result<(), String> {
    validate_download_url(asset.browser_download_url.as_str())?;
    if asset.size.unwrap_or(0) > MAX_DOWNLOAD_BYTES {
        return Err(format!("asset too large: {}", asset.name));
    }
    let response = reqwest::blocking::Client::builder()
        .user_agent("CodexManagerServer-Updater")
        .build()
        .map_err(|err| err.to_string())?
        .get(asset.browser_download_url.as_str())
        .send()
        .map_err(|err| err.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "download {} failed with {}",
            asset.name,
            response.status()
        ));
    }
    let mut out = fs::File::create(dest).map_err(|err| err.to_string())?;
    let mut reader = response.take(MAX_DOWNLOAD_BYTES);
    io_copy(&mut reader, &mut out)?;
    Ok(())
}

fn validate_download_url(raw: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(raw).map_err(|err| err.to_string())?;
    if parsed.scheme() != "https" {
        return Err("only https download URLs are allowed".to_string());
    }
    let Some(host) = parsed.host_str() else {
        return Err("download URL host missing".to_string());
    };
    if !DOWNLOAD_HOSTS.iter().any(|allowed| host == *allowed || host.ends_with(&format!(".{allowed}"))) {
        return Err(format!("download host not allowed: {host}"));
    }
    Ok(())
}

fn verify_checksum(file_path: &Path, checksums_path: &Path) -> Result<(), String> {
    let actual = compute_sha256(file_path)?;
    let file_name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid file name".to_string())?;
    let checksums = fs::read_to_string(checksums_path).map_err(|err| err.to_string())?;
    for line in checksums.lines() {
        let mut parts = line.split_whitespace();
        let Some(hash) = parts.next() else {
            continue;
        };
        let Some(name) = parts.next() else {
            continue;
        };
        if name == file_name {
            if hash.eq_ignore_ascii_case(actual.as_str()) {
                return Ok(());
            }
            return Err(format!("checksum mismatch for {file_name}"));
        }
    }
    Err(format!("checksum not found for {file_name}"))
}

fn compute_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|err| err.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let read = file.read(&mut buf).map_err(|err| err.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buf[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn extract_binary_from_zip(archive_path: &Path, wanted_name: &str, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|err| err.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|err| err.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|err| err.to_string())?;
        let Some(name) = entry
            .enclosed_name()
            .and_then(|path| path.file_name().and_then(|name| name.to_str()).map(str::to_owned))
        else {
            continue;
        };
        if name != wanted_name {
            continue;
        }
        let mut out = fs::File::create(dest).map_err(|err| err.to_string())?;
        io_copy(&mut entry, &mut out)?;
        return Ok(());
    }
    Err(format!(
        "binary {} not found in {}",
        wanted_name,
        archive_path.display()
    ))
}

fn replace_binary_pair(
    web_current: &Path,
    web_backup: &Path,
    web_new: &Path,
    service_current: &Path,
    service_backup: &Path,
    service_new: &Path,
) -> Result<(), String> {
    let _ = fs::remove_file(web_backup);
    let _ = fs::remove_file(service_backup);

    fs::rename(web_current, web_backup).map_err(|err| format!("backup web binary failed: {err}"))?;
    if let Err(err) = fs::rename(service_current, service_backup) {
        let _ = fs::rename(web_backup, web_current);
        return Err(format!("backup service binary failed: {err}"));
    }

    if let Err(err) = fs::rename(web_new, web_current) {
        let _ = fs::rename(web_backup, web_current);
        let _ = fs::rename(service_backup, service_current);
        return Err(format!("replace web binary failed: {err}"));
    }
    if let Err(err) = fs::rename(service_new, service_current) {
        let _ = fs::remove_file(web_current);
        let _ = fs::rename(web_backup, web_current);
        let _ = fs::rename(service_backup, service_current);
        return Err(format!("replace service binary failed: {err}"));
    }
    Ok(())
}

fn swap_back_backup(current: &Path, backup: &Path) -> Result<(), String> {
    let failed = current.with_extension("rollback-failed");
    let _ = fs::remove_file(&failed);
    fs::rename(current, &failed).map_err(|err| err.to_string())?;
    if let Err(err) = fs::rename(backup, current) {
        let _ = fs::rename(&failed, current);
        return Err(err.to_string());
    }
    let _ = fs::remove_file(&failed);
    Ok(())
}

fn normalize_version(value: &str) -> String {
    value.trim().trim_start_matches('v').to_string()
}

fn compare_versions(left: &str, right: &str) -> i32 {
    let left_parts = parse_version(left);
    let right_parts = parse_version(right);
    for index in 0..3 {
        let delta = left_parts[index] - right_parts[index];
        if delta != 0 {
            return delta;
        }
    }
    0
}

fn parse_version(value: &str) -> [i32; 3] {
    let normalized = normalize_version(value);
    let mut out = [0, 0, 0];
    for (index, part) in normalized.split('.').take(3).enumerate() {
        out[index] = part.parse::<i32>().unwrap_or(0);
    }
    out
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(path)
        .map_err(|err| err.to_string())?
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).map_err(|err| err.to_string())
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn web_binary_name() -> &'static str {
    if cfg!(windows) {
        "codexmanager-web.exe"
    } else {
        "codexmanager-web"
    }
}

fn service_binary_name() -> &'static str {
    if cfg!(windows) {
        "codexmanager-service.exe"
    } else {
        "codexmanager-service"
    }
}

fn io_copy(reader: &mut dyn Read, writer: &mut dyn Write) -> Result<(), String> {
    std::io::copy(reader, writer)
        .map(|_| ())
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        can_self_update_runtime, compare_versions, normalize_version, parse_version,
        validate_download_url,
    };

    #[test]
    fn compare_versions_orders_semver_like_values() {
        assert!(compare_versions("0.0.3", "0.0.4") < 0);
        assert_eq!(compare_versions("v0.2.5", "0.2.5"), 0);
        assert!(compare_versions("0.3.0", "0.2.9") > 0);
    }

    #[test]
    fn parse_version_trims_v_prefix() {
        assert_eq!(normalize_version("v0.2.5"), "0.2.5");
        assert_eq!(parse_version("v1.2.3"), [1, 2, 3]);
    }

    #[test]
    fn validate_download_url_only_allows_github_domains() {
        assert!(validate_download_url("https://github.com/demo/release.zip").is_ok());
        assert!(
            validate_download_url("https://objects.githubusercontent.com/demo/release.zip")
                .is_ok()
        );
        assert!(validate_download_url("http://github.com/demo").is_err());
        assert!(validate_download_url("https://example.com/demo").is_err());
    }

    #[test]
    fn can_self_update_runtime_accepts_supervised_single_container_mode() {
        assert!(can_self_update_runtime(true, true, true, false, true, true));
        assert!(!can_self_update_runtime(true, false, false, false, true, true));
        assert!(!can_self_update_runtime(false, false, true, false, true, true));
        assert!(!can_self_update_runtime(true, false, true, false, false, true));
        assert!(!can_self_update_runtime(true, true, true, false, true, false));
    }
}
