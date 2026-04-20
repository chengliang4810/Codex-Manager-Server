use crate::app_settings::{
    get_persisted_app_setting, normalize_optional_text, save_persisted_app_setting,
    APP_SETTING_WEB_ACCESS_PASSWORD_HASH_KEY,
};
use rand::RngCore;
use serde_json::Value;
use sha2::{Digest, Sha256};

const WEB_ACCESS_PASSWORD_ENV_KEY: &str = "CODEXMANAGER_WEB_ACCESS_PASSWORD";

fn persisted_web_access_password_hash() -> Option<String> {
    get_persisted_app_setting(APP_SETTING_WEB_ACCESS_PASSWORD_HASH_KEY)
}

pub fn seed_web_access_password_from_env() -> Result<bool, String> {
    if persisted_web_access_password_hash().is_some() {
        return Ok(false);
    }
    let Some(password) =
        normalize_optional_text(std::env::var(WEB_ACCESS_PASSWORD_ENV_KEY).ok().as_deref())
    else {
        return Ok(false);
    };
    let hashed = hash_web_access_password(&password);
    save_persisted_app_setting(APP_SETTING_WEB_ACCESS_PASSWORD_HASH_KEY, Some(&hashed))?;
    Ok(true)
}

/// 函数 `current_web_access_password_hash`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// 无
///
/// # 返回
/// 返回函数执行结果
pub fn current_web_access_password_hash() -> Option<String> {
    if let Some(value) = persisted_web_access_password_hash() {
        return Some(value);
    }
    let _ = seed_web_access_password_from_env();
    persisted_web_access_password_hash()
}

/// 函数 `web_access_password_configured`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// 无
///
/// # 返回
/// 返回函数执行结果
pub fn web_access_password_configured() -> bool {
    current_web_access_password_hash().is_some()
}

/// 函数 `set_web_access_password`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// - password: 参数 password
///
/// # 返回
/// 返回函数执行结果
pub fn set_web_access_password(password: Option<&str>) -> Result<bool, String> {
    match normalize_optional_text(password) {
        Some(value) => {
            let hashed = hash_web_access_password(&value);
            save_persisted_app_setting(APP_SETTING_WEB_ACCESS_PASSWORD_HASH_KEY, Some(&hashed))?;
            Ok(true)
        }
        None => {
            save_persisted_app_setting(APP_SETTING_WEB_ACCESS_PASSWORD_HASH_KEY, Some(""))?;
            Ok(false)
        }
    }
}

/// 函数 `web_auth_status_value`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// 无
///
/// # 返回
/// 返回函数执行结果
pub fn web_auth_status_value() -> Result<Value, String> {
    Ok(serde_json::json!({
        "passwordConfigured": web_access_password_configured(),
    }))
}

/// 函数 `verify_web_access_password`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// - password: 参数 password
///
/// # 返回
/// 返回函数执行结果
pub fn verify_web_access_password(password: &str) -> bool {
    let Some(stored_hash) = current_web_access_password_hash() else {
        return true;
    };
    verify_password_hash(password, &stored_hash)
}

/// 函数 `build_web_access_session_token`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// - password_hash: 参数 password_hash
/// - rpc_token: 参数 rpc_token
///
/// # 返回
/// 返回函数执行结果
pub fn build_web_access_session_token(password_hash: &str, rpc_token: &str) -> String {
    hex_sha256(format!("codexmanager-web-auth-session:{password_hash}:{rpc_token}").as_bytes())
}

/// 函数 `hash_web_access_password`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// - password: 参数 password
///
/// # 返回
/// 返回函数执行结果
fn hash_web_access_password(password: &str) -> String {
    let mut salt = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    let salt_hex = hex_encode(&salt);
    let digest = hex_sha256(format!("{salt_hex}:{password}").as_bytes());
    format!("sha256${salt_hex}${digest}")
}

/// 函数 `verify_password_hash`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// - password: 参数 password
/// - stored_hash: 参数 stored_hash
///
/// # 返回
/// 返回函数执行结果
fn verify_password_hash(password: &str, stored_hash: &str) -> bool {
    let mut parts = stored_hash.split('$');
    let Some(kind) = parts.next() else {
        return false;
    };
    let Some(salt_hex) = parts.next() else {
        return false;
    };
    let Some(expected_hash) = parts.next() else {
        return false;
    };
    if kind != "sha256" || parts.next().is_some() {
        return false;
    }
    super::rpc::constant_time_eq(
        hex_sha256(format!("{salt_hex}:{password}").as_bytes()).as_bytes(),
        expected_hash.as_bytes(),
    )
}

/// 函数 `hex_sha256`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// - bytes: 参数 bytes
///
/// # 返回
/// 返回函数执行结果
fn hex_sha256(bytes: impl AsRef<[u8]>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes.as_ref());
    let digest = hasher.finalize();
    hex_encode(digest.as_slice())
}

/// 函数 `hex_encode`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// - bytes: 参数 bytes
///
/// # 返回
/// 返回函数执行结果
fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_web_access_password_from_env_initializes_missing_password() {
        let _guard = crate::test_env_guard();
        std::env::remove_var("CODEXMANAGER_WEB_ACCESS_PASSWORD");
        let _ = set_web_access_password(None);

        std::env::set_var("CODEXMANAGER_WEB_ACCESS_PASSWORD", "bootstrap-secret");
        assert_eq!(persisted_web_access_password_hash(), None);

        let seeded = seed_web_access_password_from_env().expect("seed password from env");
        assert!(seeded);
        assert!(web_access_password_configured());
        assert!(verify_web_access_password("bootstrap-secret"));

        std::env::remove_var("CODEXMANAGER_WEB_ACCESS_PASSWORD");
        let _ = set_web_access_password(None);
    }

    #[test]
    fn seed_web_access_password_from_env_does_not_override_existing_password() {
        let _guard = crate::test_env_guard();
        std::env::remove_var("CODEXMANAGER_WEB_ACCESS_PASSWORD");
        let _ = set_web_access_password(Some("persisted-secret"));

        std::env::set_var("CODEXMANAGER_WEB_ACCESS_PASSWORD", "bootstrap-secret");
        let seeded = seed_web_access_password_from_env().expect("skip seed when password exists");
        assert!(!seeded);
        assert!(verify_web_access_password("persisted-secret"));
        assert!(!verify_web_access_password("bootstrap-secret"));

        std::env::remove_var("CODEXMANAGER_WEB_ACCESS_PASSWORD");
        let _ = set_web_access_password(None);
    }
}
