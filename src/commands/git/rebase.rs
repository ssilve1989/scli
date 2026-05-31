use crate::utils::git::{Shell, ensure_not_on_default_branch};
use anyhow::Result;

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("git failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn perform_rebase(shell: &dyn Shell, no_push: bool) -> Result<(String, String)> {
    let (current, default) = ensure_not_on_default_branch(shell)?;
    shell.run("git", &["fetch", "origin", &default])?;
    shell.run("git", &["rebase", &format!("origin/{default}")])?;
    if !no_push {
        shell.run("git", &["push", "--force-with-lease", "origin", &current])?;
    }
    Ok((current, default))
}

pub fn execute_rebase(shell: &dyn Shell, no_push: bool) -> Result<()> {
    let (current, default) = ensure_not_on_default_branch(shell)?;

    println!("Fetching origin/{default}...");
    run_cmd(&["fetch", "origin", &default])?;
    println!("Fetched");

    println!("Rebasing on origin/{default}...");
    let rebase_result = std::process::Command::new("git")
        .args(["rebase", &format!("origin/{default}")])
        .output()?;
    if !rebase_result.status.success() {
        let stderr = String::from_utf8_lossy(&rebase_result.stderr);
        if stderr.contains("CONFLICT") {
            eprintln!("Rebase conflict detected. Resolve manually:");
            eprintln!("  git rebase --continue   (after resolving)");
            eprintln!("  git rebase --abort       (to cancel)");
            if !stderr.is_empty() {
                eprintln!("{stderr}");
            }
        } else {
            eprintln!("Rebase failed: {stderr}");
        }
        std::process::exit(1);
    }
    println!("Rebased");

    if !no_push {
        println!("Force pushing {current}...");
        run_cmd(&["push", "--force-with-lease", "origin", &current])?;
        println!("Pushed");
    }

    println!("Done!");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::git::Shell;
    use std::sync::Mutex;

    struct MockShell {
        responses: Mutex<Vec<anyhow::Result<String>>>,
    }

    impl MockShell {
        fn new(responses: Vec<anyhow::Result<String>>) -> Self {
            Self {
                responses: Mutex::new(responses),
            }
        }
    }

    impl Shell for MockShell {
        fn run(&self, _cmd: &str, _args: &[&str]) -> anyhow::Result<String> {
            self.responses.lock().unwrap().remove(0)
        }
    }

    #[test]
    fn test_perform_rebase_success_no_push() {
        let shell = MockShell::new(vec![
            Ok("feature-x".to_string()),
            Ok("refs/remotes/origin/main".to_string()),
            Ok("".to_string()), // fetch
            Ok("".to_string()), // rebase
        ]);
        let (current, default) = perform_rebase(&shell, true).unwrap();
        assert_eq!(current, "feature-x");
        assert_eq!(default, "main");
    }

    #[test]
    fn test_perform_rebase_on_default_branch_errors() {
        let shell = MockShell::new(vec![
            Ok("main".to_string()),
            Ok("refs/remotes/origin/main".to_string()),
        ]);
        assert!(perform_rebase(&shell, false).is_err());
    }
}
