use anyhow::Result;
use dialoguer::Select;
use dialoguer::theme::ColorfulTheme;
use std::path::Path;

use super::new::{
    generate_commitlint_rc, generate_install_hooks_script, generate_lefthook_yml,
    generate_release_rc, generate_release_yml, generate_renovate_json, generate_renovate_yml,
};

fn run_cmd_in(cwd: &str, cmd: &str, args: &[&str]) -> Result<String> {
    let output = std::process::Command::new(cmd)
        .args(args)
        .current_dir(cwd)
        .output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("{cmd} failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn detect_pm(cwd: &str) -> Result<String> {
    let cwd = Path::new(cwd);
    if cwd.join("bun.lockb").exists() || cwd.join("bun.lock").exists() {
        return Ok("bun".to_string());
    }
    if cwd.join("pnpm-lock.yaml").exists() {
        return Ok("pnpm".to_string());
    }

    let pkg_path = cwd.join("package.json");
    if pkg_path.exists() {
        let content = std::fs::read_to_string(&pkg_path)?;
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content)
            && let Some(pm) = pkg.get("packageManager").and_then(|v| v.as_str())
        {
            if pm.starts_with("pnpm") {
                return Ok("pnpm".to_string());
            }
            if pm.starts_with("bun") {
                return Ok("bun".to_string());
            }
        }
    }

    let pm_idx = Select::with_theme(&ColorfulTheme::default())
        .with_prompt("Could not detect package manager. Which are you using?")
        .items(&["bun", "pnpm"])
        .default(0)
        .interact()?;
    Ok(if pm_idx == 0 {
        "bun".to_string()
    } else {
        "pnpm".to_string()
    })
}

fn add_lefthook(cwd: &str, pm: &str) -> Result<()> {
    let root = Path::new(cwd);

    let lefthook_path = root.join("lefthook.yml");
    if lefthook_path.exists() {
        eprintln!("lefthook.yml already exists — skipped");
    } else {
        std::fs::write(&lefthook_path, generate_lefthook_yml(pm))?;
    }

    let scripts_dir = root.join("scripts");
    let hooks_path = scripts_dir.join("install-hooks.js");
    if hooks_path.exists() {
        eprintln!("scripts/install-hooks.js already exists — skipped");
    } else {
        std::fs::create_dir_all(&scripts_dir)?;
        std::fs::write(&hooks_path, generate_install_hooks_script())?;
    }

    let pkg_path = root.join("package.json");
    if pkg_path.exists() {
        let content = std::fs::read_to_string(&pkg_path)?;
        if let Ok(mut pkg) = serde_json::from_str::<serde_json::Value>(&content)
            && pkg
                .get("scripts")
                .and_then(|s| s.as_object())
                .is_none_or(|s| !s.contains_key("prepare"))
        {
            if let Some(obj) = pkg.get_mut("scripts").and_then(|s| s.as_object_mut()) {
                obj.insert(
                    "prepare".to_string(),
                    serde_json::json!("node scripts/install-hooks.js"),
                );
            }
            std::fs::write(
                &pkg_path,
                serde_json::to_string_pretty(&pkg).unwrap() + "\n",
            )?;
        }
    }

    let commitlint_path = root.join(".commitlintrc.json");
    if commitlint_path.exists() {
        eprintln!(".commitlintrc.json already exists — skipped");
    } else {
        std::fs::write(&commitlint_path, generate_commitlint_rc())?;
    }

    if pm == "bun" {
        run_cmd_in(
            cwd,
            "bun",
            &[
                "add",
                "-d",
                "lefthook",
                "@commitlint/cli",
                "@commitlint/config-conventional",
            ],
        )?;
        run_cmd_in(cwd, "bunx", &["lefthook", "install"])?;
    } else {
        run_cmd_in(
            cwd,
            "pnpm",
            &[
                "add",
                "-D",
                "lefthook",
                "@commitlint/cli",
                "@commitlint/config-conventional",
            ],
        )?;
        run_cmd_in(cwd, "pnpm", &["dlx", "lefthook", "install"])?;
    }

    Ok(())
}

fn add_standard_release(cwd: &str, pm: &str) -> Result<()> {
    let root = Path::new(cwd);

    let releaserc_path = root.join(".releaserc.json");
    if releaserc_path.exists() {
        eprintln!(".releaserc.json already exists — skipped");
    } else {
        std::fs::write(&releaserc_path, generate_release_rc())?;
    }

    let commitlint_path = root.join(".commitlintrc.json");
    if commitlint_path.exists() {
        eprintln!(".commitlintrc.json already exists — skipped");
    } else {
        std::fs::write(&commitlint_path, generate_commitlint_rc())?;
    }

    let workflows_dir = root.join(".github/workflows");
    let release_yml_path = workflows_dir.join("release.yml");
    if release_yml_path.exists() {
        eprintln!(".github/workflows/release.yml already exists — skipped");
    } else {
        std::fs::create_dir_all(&workflows_dir)?;
        std::fs::write(&release_yml_path, generate_release_yml(pm))?;
    }

    if pm == "bun" {
        run_cmd_in(
            cwd,
            "bun",
            &[
                "add",
                "-d",
                "@commitlint/cli",
                "@commitlint/config-conventional",
                "@semantic-release/changelog",
                "@semantic-release/git",
                "conventional-changelog-conventionalcommits",
            ],
        )?;
    } else {
        run_cmd_in(
            cwd,
            "pnpm",
            &[
                "add",
                "-D",
                "@commitlint/cli",
                "@commitlint/config-conventional",
                "@semantic-release/changelog",
                "@semantic-release/git",
                "conventional-changelog-conventionalcommits",
            ],
        )?;
    }

    Ok(())
}

fn add_renovate(cwd: &str, _pm: &str) -> Result<()> {
    let root = Path::new(cwd);

    let renovate_path = root.join("renovate.json");
    if renovate_path.exists() {
        eprintln!("renovate.json already exists — skipped");
    } else {
        std::fs::write(&renovate_path, generate_renovate_json())?;
    }

    let workflows_dir = root.join(".github/workflows");
    let workflow_path = workflows_dir.join("renovate.yml");
    if workflow_path.exists() {
        eprintln!(".github/workflows/renovate.yml already exists — skipped");
    } else {
        std::fs::create_dir_all(&workflows_dir)?;
        std::fs::write(&workflow_path, generate_renovate_yml())?;
    }

    Ok(())
}

pub fn execute_project_add(feature: &str) -> Result<()> {
    let cwd = std::env::current_dir()?;
    let cwd_str = cwd.to_str().unwrap();

    match feature {
        "lefthook" => add_lefthook(cwd_str, &detect_pm(cwd_str)?)?,
        "standard-release" => add_standard_release(cwd_str, &detect_pm(cwd_str)?)?,
        "renovate" => add_renovate(cwd_str, &detect_pm(cwd_str)?)?,
        _ => anyhow::bail!(
            "Unknown feature \"{feature}\". Valid options: lefthook, standard-release, renovate"
        ),
    }

    println!("{feature} added successfully.");
    Ok(())
}
