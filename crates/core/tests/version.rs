/// 函数 `core_version_is_set`
///
/// 作者: gaohongshun
///
/// 时间: 2026-04-02
///
/// # 参数
/// 无
///
/// # 返回
/// 无
#[test]
fn core_version_is_set() {
    assert!(!codexmanager_core::core_version().is_empty());
}

#[test]
fn release_repository_defaults_to_current_fork() {
    assert_eq!(
        codexmanager_core::release_repository(),
        "chengliang4810/Codex-Manager-Server"
    );
}

#[test]
fn release_tag_defaults_to_v_prefixed_version() {
    let version = codexmanager_core::core_version();
    assert_eq!(codexmanager_core::release_tag(), format!("v{version}"));
}
