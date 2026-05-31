use crate::utils::git::{Shell, get_current_branch, get_default_branch};
use anyhow::Result;

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("git failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn execute_sync(shell: &dyn Shell) -> Result<()> {
    let default = get_default_branch(shell)?;
    let current = get_current_branch(shell)?;

    if current == default {
        println!("Pulling latest changes...");
        run_cmd(&["pull"])?;
        println!("{default} is up to date");
    } else {
        println!("Switching to {default} and pulling...");
        run_cmd(&["checkout", &default])?;
        run_cmd(&["pull"])?;
        println!("{default} is up to date");

        println!("Switching back to {current}...");
        run_cmd(&["checkout", &current])?;
        println!("Back on {current}");
    }

    println!("Synced!");
    Ok(())
}
