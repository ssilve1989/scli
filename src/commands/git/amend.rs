use crate::utils::git::{Shell, get_current_branch};
use anyhow::Result;

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("git failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn execute_amend(shell: &dyn Shell, push: bool) -> Result<()> {
    let status = run_cmd(&["status", "--porcelain"])?;
    let tracked: Vec<&str> = status
        .lines()
        .filter(|l| !l.trim().is_empty() && !l.starts_with("??"))
        .collect();

    if tracked.is_empty() {
        eprintln!("No tracked changes to amend.");
        return Ok(());
    }

    println!("Staging and amending...");
    run_cmd(&["add", "-u"])?;
    run_cmd(&["commit", "--amend", "--no-edit"])?;
    println!("Amended");

    if push {
        let current = get_current_branch(shell)?;
        println!("Force pushing {current}...");
        run_cmd(&["push", "--force-with-lease", "origin", &current])?;
        println!("Pushed");
    }

    println!("Done!");
    Ok(())
}
