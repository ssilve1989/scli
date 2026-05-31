use serde::Deserialize;

const GITHUB_REPO: &str = "ssilve1989/personal-cli";
const GITHUB_API: &str = "https://api.github.com/repos/ssilve1989/personal-cli/releases/latest";

#[derive(Deserialize)]
pub struct ReleaseData {
    pub tag_name: String,
    pub body: Option<String>,
}

pub struct ReleaseInfo {
    pub version: String,
    pub tag: String,
    pub notes: String,
}

pub fn get_latest_release() -> anyhow::Result<ReleaseInfo> {
    let resp = ureq::get(GITHUB_API)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "scli")
        .call()?;
    let data: ReleaseData = resp.into_body().read_json()?;
    let tag = data.tag_name;
    let version = tag.strip_prefix('v').unwrap_or(&tag).to_string();
    let notes = data.body.unwrap_or_default();
    Ok(ReleaseInfo { version, tag, notes })
}

pub fn is_update_available(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    let c = parse(current);
    let l = parse(latest);
    let c_maj = c.first().copied().unwrap_or(0);
    let c_min = c.get(1).copied().unwrap_or(0);
    let c_pat = c.get(2).copied().unwrap_or(0);
    let l_maj = l.first().copied().unwrap_or(0);
    let l_min = l.get(1).copied().unwrap_or(0);
    let l_pat = l.get(2).copied().unwrap_or(0);

    if l_maj != c_maj { return l_maj > c_maj; }
    if l_min != c_min { return l_min > c_min; }
    l_pat > c_pat
}

pub fn get_platform_slug() -> anyhow::Result<String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    match (os, arch) {
        ("linux", "x86_64") => Ok("linux-x64".to_string()),
        ("macos", "aarch64") => Ok("macos-arm64".to_string()),
        ("macos", "x86_64") => Ok("macos-x64".to_string()),
        _ => Err(anyhow::anyhow!("Unsupported platform: {os}/{arch}")),
    }
}

pub fn get_download_url(tag: &str, slug: &str) -> String {
    format!("https://github.com/{GITHUB_REPO}/releases/download/{tag}/scli-{slug}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_update_available_equal() {
        assert!(!is_update_available("1.2.3", "1.2.3"));
    }

    #[test]
    fn test_is_update_available_higher_patch() {
        assert!(is_update_available("1.2.3", "1.2.4"));
    }

    #[test]
    fn test_is_update_available_lower_patch() {
        assert!(!is_update_available("1.2.4", "1.2.3"));
    }

    #[test]
    fn test_is_update_available_higher_minor() {
        assert!(is_update_available("1.2.3", "1.3.0"));
    }

    #[test]
    fn test_is_update_available_higher_major() {
        assert!(is_update_available("1.9.9", "2.0.0"));
    }

    #[test]
    fn test_is_update_available_zero_patch() {
        assert!(is_update_available("0.0.1", "0.0.2"));
    }

    #[test]
    fn test_get_platform_slug_linux() {
        if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
            assert_eq!(get_platform_slug().unwrap(), "linux-x64");
        }
    }

    #[test]
    fn test_get_platform_slug_macos_arm64() {
        if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
            assert_eq!(get_platform_slug().unwrap(), "macos-arm64");
        }
    }

    #[test]
    fn test_get_download_url() {
        let url = get_download_url("v1.2.3", "linux-x64");
        assert_eq!(
            url,
            "https://github.com/ssilve1989/personal-cli/releases/download/v1.2.3/scli-linux-x64"
        );
    }

    #[test]
    fn test_get_download_url_macos() {
        let url = get_download_url("v2.0.0", "macos-arm64");
        assert_eq!(
            url,
            "https://github.com/ssilve1989/personal-cli/releases/download/v2.0.0/scli-macos-arm64"
        );
    }
}
