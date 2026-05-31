use anyhow::Result;
use dialoguer::{Confirm, theme::ColorfulTheme};
use crate::utils::update::{get_latest_release, is_update_available, get_platform_slug, get_download_url};


pub fn execute_update(check: bool) -> Result<()> {
    println!("Checking for latest release...");

    let latest = match get_latest_release() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Failed to reach GitHub.");
            eprintln!("{e}");
            std::process::exit(1);
        }
    };

    let current = env!("CARGO_PKG_VERSION");
    let has_update = is_update_available(current, &latest.version);

    if !has_update {
        println!("Already up to date (v{current}).");
        println!("Nothing to do.");
        return Ok(());
    }

    println!("New version available: v{} (current: v{current})", latest.version);

    if !latest.notes.is_empty() {
        println!("\n--- Release Notes ---\n{}\n---------------------", latest.notes);
    }

    if check {
        println!("Run `scli update` to install v{}.", latest.version);
        return Ok(());
    }

    let confirmed = Confirm::with_theme(&ColorfulTheme::default())
        .with_prompt(format!("Install v{}?", latest.version))
        .interact()?;

    if !confirmed {
        println!("Update cancelled.");
        return Ok(());
    }

    let slug = match get_platform_slug() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    };

    let url = get_download_url(&latest.tag, &slug);
    println!("Downloading {url}...");

    let response = match ureq::get(&url).call() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Download failed: {e}");
            std::process::exit(1);
        }
    };

    let body = response.into_body().read_to_vec()?;
    println!("Download complete.");

    let tmp_path = std::env::temp_dir().join(format!("scli-update-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()));
    std::fs::write(&tmp_path, &body)?;

    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o755))?;

    let exec_path = std::env::current_exe()?;

    if std::fs::rename(&tmp_path, &exec_path).is_err() {
        std::fs::copy(&tmp_path, &exec_path)?;
        std::fs::set_permissions(&exec_path, std::fs::Permissions::from_mode(0o755))?;
        let _ = std::fs::remove_file(&tmp_path);
    }

    println!("Updated to v{}. Restart scli to use the new version.", latest.version);
    Ok(())
}
