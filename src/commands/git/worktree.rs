use crate::utils::git::Shell;
use anyhow::Result;

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("git failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn create_worktree(shell: &dyn Shell, name: &str, base: &str) -> Result<String> {
    let root = shell.run("git", &["rev-parse", "--show-toplevel"])?;
    let trimmed = root.trim().to_string();
    let parent = std::path::Path::new(&trimmed)
        .parent()
        .unwrap_or(std::path::Path::new("."));
    let worktree_path = parent.join(name);

    run_cmd(&["fetch", "origin", base])?;
    run_cmd(&[
        "worktree",
        "add",
        "-b",
        name,
        worktree_path.to_str().unwrap(),
        &format!("origin/{base}"),
    ])?;

    Ok(worktree_path.to_str().unwrap().to_string())
}

pub fn execute_worktree(shell: &dyn Shell, name: &str, base: &str) -> Result<()> {
    let root = shell.run("git", &["rev-parse", "--show-toplevel"])?;
    let trimmed = root.trim().to_string();
    let parent = std::path::Path::new(&trimmed)
        .parent()
        .unwrap_or(std::path::Path::new("."));
    let worktree_path = parent.join(name);

    println!("Fetching origin/{base}...");
    run_cmd(&["fetch", "origin", base])?;
    println!("Fetched");

    println!("Creating worktree at {}...", worktree_path.display());
    run_cmd(&[
        "worktree",
        "add",
        "-b",
        name,
        worktree_path.to_str().unwrap(),
        &format!("origin/{base}"),
    ])?;
    println!("Created");

    println!("Worktree ready at {}", worktree_path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
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
    fn test_create_worktree_resolves_path() {
        let shell = MockShell::new(vec![Ok("/home/user/repo".to_string())]);
        let result = shell.run("git", &["rev-parse", "--show-toplevel"]);
        assert_eq!(result.unwrap(), "/home/user/repo");
    }
}
