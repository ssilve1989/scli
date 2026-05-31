use crate::utils::git::{Shell, get_default_branch};
use anyhow::Result;

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("git failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn execute_start(shell: &dyn Shell, name: &str) -> Result<()> {
    let default = get_default_branch(shell)?;

    println!("Switching to {default} and pulling...");
    run_cmd(&["checkout", &default])?;
    run_cmd(&["pull"])?;
    println!("{default} is up to date");

    println!("Creating branch {name}...");
    run_cmd(&["checkout", "-b", name])?;
    println!("On new branch {name}");

    println!("Ready to go!");
    Ok(())
}
