use crate::utils::errors::{ShellError, extract_stderr};
use anyhow::{Result, anyhow};

pub trait Shell {
    fn run(&self, cmd: &str, args: &[&str]) -> Result<String>;
}

pub struct RealShell;

impl Shell for RealShell {
    fn run(&self, cmd: &str, args: &[&str]) -> Result<String> {
        let output = std::process::Command::new(cmd).args(args).output()?;
        if !output.status.success() {
            let stderr = extract_stderr(&output);
            return Err(anyhow!(ShellError::CommandFailed { stderr }));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
}

pub fn get_default_branch(shell: &dyn Shell) -> Result<String> {
    match shell.run("git", &["symbolic-ref", "refs/remotes/origin/HEAD"]) {
        Ok(ref_) => Ok(ref_.split('/').next_back().unwrap_or("").to_string()),
        Err(_) => {
            let branches = shell.run("git", &["branch", "--list"])?;
            let list: Vec<String> = branches
                .lines()
                .map(|l| l.replace('*', "").trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            if list.contains(&"main".to_string()) {
                return Ok("main".to_string());
            }
            if list.contains(&"master".to_string()) {
                return Ok("master".to_string());
            }
            Err(anyhow!("Could not determine default branch"))
        }
    }
}

pub fn get_current_branch(shell: &dyn Shell) -> Result<String> {
    let branch = shell.run("git", &["rev-parse", "--abbrev-ref", "HEAD"])?;
    let name = branch.trim().to_string();
    if name == "HEAD" {
        Err(anyhow!(
            "Detached HEAD state — cannot determine current branch"
        ))
    } else {
        Ok(name)
    }
}

pub fn ensure_not_on_default_branch(shell: &dyn Shell) -> Result<(String, String)> {
    let current = get_current_branch(shell)?;
    let default = get_default_branch(shell)?;
    if current == default {
        return Err(anyhow!(
            "Already on default branch ({default}). Switch to a feature branch first."
        ));
    }
    Ok((current, default))
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn test_get_default_branch_from_symbolic_ref() {
        let shell = MockShell::new(vec![Ok("refs/remotes/origin/main".to_string())]);
        assert_eq!(get_default_branch(&shell).unwrap(), "main");
    }

    #[test]
    fn test_get_default_branch_fallback_main() {
        let shell = MockShell::new(vec![
            Err(anyhow!("symbolic-ref failed")),
            Ok("  main\n* feature-x\n".to_string()),
        ]);
        assert_eq!(get_default_branch(&shell).unwrap(), "main");
    }

    #[test]
    fn test_get_default_branch_fallback_master() {
        let shell = MockShell::new(vec![
            Err(anyhow!("symbolic-ref failed")),
            Ok("  master\n* feature-x\n".to_string()),
        ]);
        assert_eq!(get_default_branch(&shell).unwrap(), "master");
    }

    #[test]
    fn test_get_default_branch_no_fallback() {
        let shell = MockShell::new(vec![
            Err(anyhow!("symbolic-ref failed")),
            Ok("  develop\n* feature-x\n".to_string()),
        ]);
        assert!(get_default_branch(&shell).is_err());
    }

    #[test]
    fn test_get_current_branch() {
        let shell = MockShell::new(vec![Ok("feature-x".to_string())]);
        assert_eq!(get_current_branch(&shell).unwrap(), "feature-x");
    }

    #[test]
    fn test_get_current_branch_detached() {
        let shell = MockShell::new(vec![Ok("HEAD".to_string())]);
        assert!(get_current_branch(&shell).is_err());
    }

    #[test]
    fn test_ensure_not_on_default_branch_on_feature() {
        let shell = MockShell::new(vec![
            Ok("feature-x".to_string()),
            Ok("refs/remotes/origin/main".to_string()),
        ]);
        let (current, default) = ensure_not_on_default_branch(&shell).unwrap();
        assert_eq!(current, "feature-x");
        assert_eq!(default, "main");
    }

    #[test]
    fn test_ensure_not_on_default_branch_on_main() {
        let shell = MockShell::new(vec![
            Ok("main".to_string()),
            Ok("refs/remotes/origin/main".to_string()),
        ]);
        assert!(ensure_not_on_default_branch(&shell).is_err());
    }
}
