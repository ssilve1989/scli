use anyhow::Result;
use dialoguer::{Confirm, theme::ColorfulTheme};
use crate::utils::git::{get_current_branch, Shell};

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("git failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn execute_deploy(shell: &dyn Shell, branch: &str, force: bool) -> Result<()> {
    let source = get_current_branch(shell)?;

    if branch == source {
        anyhow::bail!("Target branch cannot be the current branch.");
    }

    if !force {
        let confirmed = Confirm::with_theme(&ColorfulTheme::default())
            .with_prompt(format!("Reset {branch} to {source} and force push?"))
            .interact()?;
        if !confirmed {
            println!("Cancelled.");
            return Ok(());
        }
    }

    let exists = std::process::Command::new("git")
        .args(["rev-parse", "--verify", branch])
        .output()?
        .status
        .success();

    println!("Switching to {branch}...");
    if exists {
        run_cmd(&["checkout", branch])?;
    } else {
        run_cmd(&["checkout", "-b", branch])?;
    }
    println!("On {branch}");

    println!("Resetting to {source}...");
    run_cmd(&["reset", "--hard", &source])?;
    println!("Reset");

    println!("Force pushing {branch}...");
    run_cmd(&["push", "--force-with-lease", "origin", branch])?;
    println!("Pushed");

    println!("Deployed!");

    run_cmd(&["checkout", &source])?;
    Ok(())
}
