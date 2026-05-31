use anyhow::Result;
use dialoguer::{MultiSelect, theme::ColorfulTheme};

pub fn parse_branch_list(raw: &str) -> (String, Vec<String>) {
    let mut current = String::new();
    let mut branches = Vec::new();

    for line in raw.lines() {
        let name = line.replace('*', "").trim().to_string();
        if name.is_empty() { continue; }
        if line.trim_start().starts_with('*') {
            current = name;
        } else {
            branches.push(name);
        }
    }

    (current, branches)
}

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn execute_prune(pattern: Option<&str>, force: bool) -> Result<()> {
    let raw = run_cmd(&["branch"])?;
    let (current, branches) = parse_branch_list(&raw);

    let filtered: Vec<String> = if let Some(pat) = pattern {
        branches.into_iter().filter(|b| b.contains(pat)).collect()
    } else {
        branches
    };

    if filtered.is_empty() {
        match pattern {
            Some(pat) => println!("No branches matching \"{pat}\" (excluding current: {current})"),
            None => println!("No branches to prune (only current: {current})"),
        }
        return Ok(());
    }

    let to_delete: Vec<String> = if force {
        filtered.clone()
    } else {
        let selections = MultiSelect::with_theme(&ColorfulTheme::default())
            .with_prompt(format!("Select branches to delete (current: {current})"))
            .items(&filtered.iter().map(|s| s.as_str()).collect::<Vec<_>>())
            .interact()?;
        selections.into_iter().map(|i| filtered[i].clone()).collect()
    };

    if to_delete.is_empty() {
        println!("No branches selected.");
        return Ok(());
    }

    for branch in &to_delete {
        let status = std::process::Command::new("git")
            .args(["branch", "-D", branch])
            .status()?;
        if status.success() {
            println!("  Deleted {branch}");
        } else {
            eprintln!("  Failed to delete {branch}");
        }
    }

    let count = to_delete.len();
    let plural = if count == 1 { "" } else { "es" };
    println!("\nPruned {count} branch{plural}.");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_branch_list_identifies_current() {
        let raw = "  main\n* feature-x\n";
        let (current, branches) = parse_branch_list(raw);
        assert_eq!(current, "feature-x");
        assert_eq!(branches, vec!["main"]);
    }

    #[test]
    fn test_parse_branch_list_multiple() {
        let raw = "  main\n  develop\n* feature-x\n";
        let (current, branches) = parse_branch_list(raw);
        assert_eq!(current, "feature-x");
        assert_eq!(branches, vec!["main", "develop"]);
    }

    #[test]
    fn test_parse_branch_list_with_slashes() {
        let raw = "  main\n  feature/foo\n* feature/bar\n";
        let (current, branches) = parse_branch_list(raw);
        assert_eq!(current, "feature/bar");
        assert_eq!(branches, vec!["main", "feature/foo"]);
    }

    #[test]
    fn test_parse_branch_list_whitespace_handling() {
        let raw = "  main\n  \n* feature-x\n";
        let (_current, branches) = parse_branch_list(raw);
        assert_eq!(branches, vec!["main"]);
    }

    #[test]
    fn test_parse_branch_list_empty() {
        let (current, branches) = parse_branch_list("");
        assert!(current.is_empty());
        assert!(branches.is_empty());
    }
}
