use serde::Serialize;

pub const DEFAULT_RELEASE_REPOSITORY: &str = "chengliang4810/Codex-Manager-Server";

const RELEASE_VERSION_ENV: &str = "CODEXMANAGER_RELEASE_VERSION";
const RELEASE_TAG_ENV: &str = "CODEXMANAGER_RELEASE_TAG";
const RELEASE_REPOSITORY_ENV: &str = "CODEXMANAGER_RELEASE_REPOSITORY";
const RELEASE_BUILT_AT_ENV: &str = "CODEXMANAGER_RELEASE_BUILT_AT";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseMetadata {
    pub version: String,
    pub release_tag: String,
    pub repository: String,
    pub built_at: String,
}

fn read_release_env(name: &str) -> Option<&'static str> {
    let value = match name {
        RELEASE_VERSION_ENV => option_env!("CODEXMANAGER_RELEASE_VERSION"),
        RELEASE_TAG_ENV => option_env!("CODEXMANAGER_RELEASE_TAG"),
        RELEASE_REPOSITORY_ENV => option_env!("CODEXMANAGER_RELEASE_REPOSITORY"),
        RELEASE_BUILT_AT_ENV => option_env!("CODEXMANAGER_RELEASE_BUILT_AT"),
        _ => None,
    };

    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

pub fn release_version() -> &'static str {
    read_release_env(RELEASE_VERSION_ENV).unwrap_or(env!("CARGO_PKG_VERSION"))
}

pub fn release_tag() -> String {
    read_release_env(RELEASE_TAG_ENV)
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("v{}", release_version()))
}

pub fn release_repository() -> &'static str {
    read_release_env(RELEASE_REPOSITORY_ENV).unwrap_or(DEFAULT_RELEASE_REPOSITORY)
}

pub fn release_built_at() -> &'static str {
    read_release_env(RELEASE_BUILT_AT_ENV).unwrap_or("unknown")
}

pub fn release_metadata() -> ReleaseMetadata {
    ReleaseMetadata {
        version: release_version().to_string(),
        release_tag: release_tag(),
        repository: release_repository().to_string(),
        built_at: release_built_at().to_string(),
    }
}
