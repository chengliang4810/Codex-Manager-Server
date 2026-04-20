pub mod auth;
pub mod release;
pub mod rpc;
pub mod storage;
pub mod usage;

/// 函数 `core_version`
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
pub fn core_version() -> &'static str {
    release::release_version()
}

pub fn release_tag() -> String {
    release::release_tag()
}

pub fn release_repository() -> &'static str {
    release::release_repository()
}

pub fn release_built_at() -> &'static str {
    release::release_built_at()
}

pub fn release_metadata() -> release::ReleaseMetadata {
    release::release_metadata()
}
