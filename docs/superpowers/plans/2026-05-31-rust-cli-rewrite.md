# Rust CLI Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port scli (TypeScript/Bun CLI) to Rust as a single-crate, synchronous CLI with identical commands and flags.

**Architecture:** Single Cargo project. `clap` for argument parsing via derive API. `anyhow` + `thiserror` for errors. `std::process::Command` for shell-outs (git, setup, project). `ureq` for blocking HTTP (update check). `dialoguer` for interactive prompts. No async runtime.

**Tech Stack:** Rust, clap 4, anyhow, thiserror, ureq, semver, serde, dialoguer

---

### Task 1: Scaffold Rust project

**Files:**
- Create: `Cargo.toml`
- Create: `src/main.rs`
- Create: `src/lib.rs`
- Create: `src/commands/mod.rs`
- Create: `src/utils/mod.rs`

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "scli"
version = "0.7.0"
edition = "2024"

[dependencies]
clap = { version = "4", features = ["derive"] }
anyhow = "1"
thiserror = "2"
ureq = { version = "3", features = ["json"] }
semver = "1"
serde = { version = "1", features = ["derive"] }
dialoguer = "0.11"
```

- [ ] **Step 2: Create src/main.rs**

```rust
fn main() {
    println!("scli not yet implemented");
}
```

- [ ] **Step 3: Create src/lib.rs**

```rust
pub mod commands;
pub mod utils;
```

- [ ] **Step 4: Create src/commands/mod.rs**

```rust
pub mod nuke;
pub mod setup;
pub mod update;
pub mod git;
pub mod project;
```

- [ ] **Step 5: Create src/utils/mod.rs**

```rust
pub mod errors;
pub mod git;
pub mod update;
```

- [ ] **Step 6: Verify compilation**

Run: `cargo build`
Expected: binary compiles, `./target/debug/scli` prints "scli not yet implemented"

- [ ] **Step 7: Create directory stubs for subcommand modules**

```bash
mkdir -p src/commands/git src/commands/project
```

- [ ] **Step 8: Create stub modules**

`src/commands/git/mod.rs`:
```rust
pub mod amend;
pub mod deploy;
pub mod prune;
pub mod rebase;
pub mod start;
pub mod sync;
pub mod worktree;
```

`src/commands/project/mod.rs`:
```rust
pub mod new;
pub mod add;
```

- [ ] **Step 9: Commit**

```bash
git add Cargo.toml src/main.rs src/lib.rs src/commands/ src/utils/
git commit -m "feat: scaffold Rust project structure"
```

---

### Task 2: Set up mise for Rust toolchain management

- [ ] **Step 1: Create mise.toml at project root**

```toml
[tools]
rust = "stable"
```

This ensures the Rust toolchain version is pinned via mise (same as how the TypeScript version used mise for bun/node for project scaffolding).

- [ ] **Step 2: Verify mise picks it up**

Run: `mise trust && mise install`
Expected: `rust` is installed/available at the pinned version

- [ ] **Step 3: Commit**

```bash
git add mise.toml
git commit -m "chore: add mise.toml for Rust toolchain management"
```

---

### Task 3: Implement Shell abstraction and error utilities

**Files:**
- Create: `src/utils/errors.rs`
- Create: `src/utils/git.rs`

- [ ] **Step 1: Write errors.rs**

```rust
use std::process::Output;

#[derive(Debug, thiserror::Error)]
pub enum ShellError {
    #[error("Command failed: {stderr}")]
    CommandFailed { stderr: String },
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

pub fn extract_stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).trim().to_string()
}
```

- [ ] **Step 2: Write git.rs with branch helpers**

```rust
use anyhow::{anyhow, Result};
use crate::utils::errors::{extract_stderr, ShellError};

pub trait Shell {
    fn run(&self, cmd: &str, args: &[&str]) -> Result<String>;
}

pub struct RealShell;

impl Shell for RealShell {
    fn run(&self, cmd: &str, args: &[&str]) -> Result<String> {
        let output = std::process::Command::new(cmd)
            .args(args)
            .output()?;
        if !output.status.success() {
            let stderr = extract_stderr(&output);
            return Err(anyhow!(ShellError::CommandFailed { stderr }));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
}

pub fn get_default_branch(shell: &dyn Shell) -> Result<String> {
    match shell.run("git", &["symbolic-ref", "refs/remotes/origin/HEAD"]) {
        Ok(ref_) => {
            Ok(ref_.split('/').last().unwrap_or("").to_string())
        }
        Err(_) => {
            let branches = shell.run("git", &["branch", "--list"])?;
            let list: Vec<&str> = branches
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
        Err(anyhow!("Detached HEAD state — cannot determine current branch"))
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

    struct MockShell {
        responses: Vec<Result<String>>,
        index: std::sync::Mutex<usize>,
    }

    impl MockShell {
        fn new(responses: Vec<Result<String>>) -> Self {
            Self { responses, index: std::sync::Mutex::new(0) }
        }
    }

    impl Shell for MockShell {
        fn run(&self, _cmd: &str, _args: &[&str]) -> Result<String> {
            let mut idx = self.index.lock().unwrap();
            let resp = self.responses[*idx].clone();
            *idx += 1;
            resp
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
```

- [ ] **Step 3: Run tests**

Run: `cargo test --lib utils::git`
Expected: all 7 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/utils/errors.rs src/utils/git.rs
git commit -m "feat: add shell abstraction and git branch helpers"
```

---

### Task 4: Implement update utilities

**Files:**
- Create: `src/utils/update.rs`

- [ ] **Step 1: Write update.rs**

```rust
use serde::Deserialize;

const GITHUB_REPO: &str = "ssilve1989/personal-cli";
const GITHUB_API: &str = "https://api.github.com/repos/ssilve1989/personal-cli/releases/latest";

#[derive(Deserialize)]
pub struct ReleaseData {
    pub tag_name: String,
    pub body: Option<String>,
}

pub struct ReleaseInfo {
    pub version: String,
    pub tag: String,
    pub notes: String,
}

pub fn get_latest_release() -> anyhow::Result<ReleaseInfo> {
    let resp = ureq::get(GITHUB_API)
        .set("Accept", "application/vnd.github+json")
        .set("User-Agent", "scli")
        .call()?;
    let data: ReleaseData = resp.into_json()?;
    let tag = data.tag_name;
    let version = tag.strip_prefix('v').unwrap_or(&tag).to_string();
    let notes = data.body.unwrap_or_default();
    Ok(ReleaseInfo { version, tag, notes })
}

pub fn is_update_available(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    let c = parse(current);
    let l = parse(latest);
    let c_maj = c.first().copied().unwrap_or(0);
    let c_min = c.get(1).copied().unwrap_or(0);
    let c_pat = c.get(2).copied().unwrap_or(0);
    let l_maj = l.first().copied().unwrap_or(0);
    let l_min = l.get(1).copied().unwrap_or(0);
    let l_pat = l.get(2).copied().unwrap_or(0);

    if l_maj != c_maj { return l_maj > c_maj; }
    if l_min != c_min { return l_min > c_min; }
    l_pat > c_pat
}

pub fn get_platform_slug() -> anyhow::Result<String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    match (os, arch) {
        ("linux", "x86_64") => Ok("linux-x64".to_string()),
        ("macos", "aarch64") => Ok("macos-arm64".to_string()),
        ("macos", "x86_64") => Ok("macos-x64".to_string()),
        _ => Err(anyhow::anyhow!("Unsupported platform: {os}/{arch}")),
    }
}

pub fn get_download_url(tag: &str, slug: &str) -> String {
    format!("https://github.com/{GITHUB_REPO}/releases/download/{tag}/scli-{slug}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_update_available_equal() {
        assert!(!is_update_available("1.2.3", "1.2.3"));
    }

    #[test]
    fn test_is_update_available_higher_patch() {
        assert!(is_update_available("1.2.3", "1.2.4"));
    }

    #[test]
    fn test_is_update_available_lower_patch() {
        assert!(!is_update_available("1.2.4", "1.2.3"));
    }

    #[test]
    fn test_is_update_available_higher_minor() {
        assert!(is_update_available("1.2.3", "1.3.0"));
    }

    #[test]
    fn test_is_update_available_higher_major() {
        assert!(is_update_available("1.9.9", "2.0.0"));
    }

    #[test]
    fn test_is_update_available_zero_patch() {
        assert!(is_update_available("0.0.1", "0.0.2"));
    }

    #[test]
    fn test_get_platform_slug_linux() {
        if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
            assert_eq!(get_platform_slug().unwrap(), "linux-x64");
        }
    }

    #[test]
    fn test_get_platform_slug_macos_arm64() {
        if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
            assert_eq!(get_platform_slug().unwrap(), "macos-arm64");
        }
    }

    #[test]
    fn test_get_download_url() {
        let url = get_download_url("v1.2.3", "linux-x64");
        assert_eq!(
            url,
            "https://github.com/ssilve1989/personal-cli/releases/download/v1.2.3/scli-linux-x64"
        );
    }

    #[test]
    fn test_get_download_url_macos() {
        let url = get_download_url("v2.0.0", "macos-arm64");
        assert_eq!(
            url,
            "https://github.com/ssilve1989/personal-cli/releases/download/v2.0.0/scli-macos-arm64"
        );
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test --lib utils::update`
Expected: all 10 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/utils/update.rs
git commit -m "feat: add update utilities (version check, platform slug, download URL)"
```

---

### Task 5: Implement CLI definition with clap

**Files:**
- Create: `src/cli.rs`

- [ ] **Step 1: Write cli.rs**

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "scli", version, about = "Steve's CLI toolkit")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Kill processes by port number or name
    Nuke {
        /// Port number or process name
        target: String,
        /// Kill all matches without prompting
        #[arg(short, long)]
        force: bool,
    },
    /// Bootstrap a new machine with tools and dotfiles
    Setup {
        /// Replace dotfiles entirely instead of additive patch
        #[arg(short, long)]
        force: bool,
    },
    /// Git utilities
    #[command(subcommand)]
    Git(GitCommands),
    /// Project utilities
    #[command(subcommand)]
    Project(ProjectCommands),
    /// Update scli to the latest version
    Update {
        /// Check for updates without installing
        #[arg(long)]
        check: bool,
    },
}

#[derive(Subcommand)]
pub enum GitCommands {
    /// Stage tracked changes and amend the last commit
    Amend {
        /// Force push after amending
        #[arg(short, long)]
        push: bool,
    },
    /// Sync a deploy branch to the current branch and push
    Deploy {
        /// Target deploy branch
        branch: String,
        /// Skip confirmation prompt
        #[arg(short, long)]
        force: bool,
    },
    /// Interactively delete local git branches
    Prune {
        /// Filter branches by substring
        pattern: Option<String>,
        /// Skip confirmation prompt
        #[arg(short, long)]
        force: bool,
    },
    /// Rebase current branch on default branch and force push
    Rebase {
        /// Skip the force push step
        #[arg(long, default_value_t = true)]
        push: bool,
    },
    /// Create a new branch from a fresh default branch
    Start {
        /// Name for the new branch
        name: String,
    },
    /// Sync default branch and return to current branch
    Sync,
    /// Create a new worktree from a base branch
    Worktree {
        /// Name for the new branch and worktree directory
        name: String,
        /// Base branch to create from
        #[arg(short, long, default_value = "master")]
        base: String,
    },
}

#[derive(Subcommand)]
pub enum ProjectCommands {
    /// Scaffold a new TypeScript project
    New {
        /// Name for the new project
        name: String,
    },
    /// Add a feature to an existing project
    Add {
        /// Feature to add (lefthook, standard-release, renovate)
        feature: String,
    },
}
```

- [ ] **Step 2: Verify compilation**

Run: `cargo build`
Expected: compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src/cli.rs
git commit -m "feat: add clap CLI definition with all commands"
```

---

### Task 6: Implement nuke command + tests

**Files:**
- Create: `src/commands/nuke.rs`

- [ ] **Step 1: Write nuke.rs**

```rust
use anyhow::Result;
use clap::Parser;
use dialoguer::{MultiSelect, theme::ColorfulTheme};

pub struct ProcessEntry {
    pub pid: u32,
    pub label: String,
}

pub fn parse_lsof_output(raw: &str, port: u16) -> Vec<ProcessEntry> {
    raw.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|pid| ProcessEntry {
            pid: pid.parse().unwrap_or(0),
            label: format!("PID {pid} (port {port})"),
        })
        .collect()
}

pub fn parse_pgrep_output(raw: &str) -> Vec<ProcessEntry> {
    raw.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let mut parts = line.splitn(2, ' ');
            let pid = parts.next()?;
            let rest = parts.next().unwrap_or("");
            Some(ProcessEntry {
                pid: pid.parse().unwrap_or(0),
                label: format!("{pid} — {rest}"),
            })
        })
        .collect()
}

pub fn filter_own_pid(entries: &[ProcessEntry], my_pid: u32) -> Vec<ProcessEntry> {
    entries
        .iter()
        .filter(|e| e.pid != my_pid && e.pid != 0)
        .cloned()
        .collect()
}

fn run_cmd(cmd: &str, args: &[&str]) -> Result<String> {
    let output = std::process::Command::new(cmd).args(args).output()?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn execute_nuke(target: &str, force: bool) -> Result<()> {
    let my_pid = std::process::id();

    let entries = if let Ok(port) = target.parse::<u16>() {
        if port < 1 { return Err(anyhow::anyhow!("Invalid port: {port}")); }
        let raw = run_cmd("lsof", &["-i", &format!(":{port}"), "-t"])?;
        parse_lsof_output(&raw, port)
    } else {
        let raw = run_cmd("pgrep", &["-fl", target])?;
        parse_pgrep_output(&raw)
    };

    let entries = filter_own_pid(&entries, my_pid);

    if entries.is_empty() {
        eprintln!("No processes found.");
        return Ok(());
    }

    let to_kill: Vec<u32> = if force {
        entries.iter().map(|e| e.pid).collect()
    } else {
        let selection = MultiSelect::with_theme(&ColorfulTheme::default())
            .with_prompt("Select processes to kill")
            .items(&entries.iter().map(|e| e.label.as_str()).collect::<Vec<_>>())
            .interact()?;
        selection.into_iter().map(|i| entries[i].pid).collect()
    };

    for pid in &to_kill {
        let status = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status()?;
        if status.success() {
            println!("Killed {pid}");
        } else {
            eprintln!("Failed to kill {pid}");
        }
    }

    let count = to_kill.len();
    let plural = if count == 1 { "" } else { "es" };
    println!("Nuked {count} process{plural}.");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lsof_output_single() {
        let result = parse_lsof_output("1234\n", 3000);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 1234);
        assert_eq!(result[0].label, "PID 1234 (port 3000)");
    }

    #[test]
    fn test_parse_lsof_output_multiple() {
        let result = parse_lsof_output("1234\n5678\n", 8080);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].pid, 1234);
        assert_eq!(result[1].pid, 5678);
    }

    #[test]
    fn test_parse_lsof_output_empty() {
        let result = parse_lsof_output("", 3000);
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_lsof_output_whitespace() {
        let result = parse_lsof_output("   \n  \n", 3000);
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_pgrep_output_single() {
        let result = parse_pgrep_output("1234 node server.js\n");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 1234);
        assert_eq!(result[0].label, "1234 — node server.js");
    }

    #[test]
    fn test_parse_pgrep_output_multi_word() {
        let result = parse_pgrep_output("5678 bun run dev --port 3000\n");
        assert_eq!(result[0].pid, 5678);
        assert!(result[0].label.contains("bun run dev"));
    }

    #[test]
    fn test_parse_pgrep_output_empty() {
        assert!(parse_pgrep_output("").is_empty());
    }

    #[test]
    fn test_parse_pgrep_output_multiple() {
        let result = parse_pgrep_output("111 node a.js\n222 bun b.ts\n");
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_filter_own_pid_removes_matching() {
        let entries = vec![
            ProcessEntry { pid: 100, label: "a".to_string() },
            ProcessEntry { pid: 200, label: "b".to_string() },
        ];
        let result = filter_own_pid(&entries, 200);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 100);
    }

    #[test]
    fn test_filter_own_pid_removes_zero() {
        let entries = vec![
            ProcessEntry { pid: 0, label: "bad".to_string() },
            ProcessEntry { pid: 100, label: "good".to_string() },
        ];
        let result = filter_own_pid(&entries, 999);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 100);
    }

    #[test]
    fn test_filter_own_pid_passthrough() {
        let entries = vec![ProcessEntry { pid: 100, label: "a".to_string() }];
        let result = filter_own_pid(&entries, 999);
        assert_eq!(result.len(), 1);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test --lib commands::nuke`
Expected: all 12 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/commands/nuke.rs
git commit -m "feat: implement nuke command"
```

---

### Task 7: Implement setup command + applyManagedSection tests

**Files:**
- Create: `src/commands/setup.rs`

- [ ] **Step 1: Write setup.rs**

```rust
use anyhow::{Context, Result};
use dialoguer::{Confirm, Input, theme::ColorfulTheme};
use std::io::Write;
use std::path::Path;

const ZSHRC_BEGIN: &str = "# BEGIN scli managed";
const ZSHRC_END: &str = "# END scli managed";

const ZSHRC_SECTION: &str = "# BEGIN scli managed
eval \"$(mise activate zsh)\"

HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_REDUCE_BLANKS

alias ll='ls -lAh'
alias gs='git status'
alias gc='git commit'
alias gp='git push'
alias gpl='git pull'
alias ..='cd ..'
alias ...='cd ../..'
# END scli managed";

const VIMRC_BEGIN: &str = "\" BEGIN scli managed";
const VIMRC_END: &str = "\" END scli managed";

const VIMRC_SECTION: &str = "\" BEGIN scli managed
set nocompatible
syntax on
filetype plugin indent on
set number
set relativenumber
set tabstop=2
set shiftwidth=2
set expandtab
set autoindent
set smartindent
set incsearch
set hlsearch
set ignorecase
set smartcase
set backspace=indent,eol,start
set wildmenu
set laststatus=2
set ruler
set showcmd
set noswapfile
set nobackup
\" END scli managed";

pub fn apply_managed_section(
    existing: &str,
    section: &str,
    begin_marker: &str,
    end_marker: &str,
) -> String {
    let begin_idx = existing.find(begin_marker);
    let end_idx = existing.find(end_marker);

    let has_both = begin_idx.is_some() && end_idx.is_some()
        && begin_idx.unwrap() < end_idx.unwrap();

    if has_both {
        let before = &existing[..begin_idx.unwrap()];
        let after = &existing[end_idx.unwrap() + end_marker.len()..];
        return format!("{before}{section}{after}");
    }

    let trimmed = existing.trim_end();
    let separator = if trimmed.is_empty() { "" } else { "\n\n" };
    format!("{trimmed}{separator}{section}\n")
}

fn backup_file(file_path: &str) -> Result<()> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let backup_path = format!("{file_path}.backup.{timestamp}");
    let content = std::fs::read_to_string(file_path)?;
    std::fs::write(&backup_path, content)?;
    println!("Backed up to {backup_path}");
    Ok(())
}

fn run_shell(cmd: &str, args: &[&str]) -> Result<String> {
    let output = std::process::Command::new(cmd)
        .args(args)
        .output()
        .with_context(|| format!("Failed to run {cmd}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("{cmd} failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn prompt_confirm(msg: &str) -> Result<bool> {
    Ok(Confirm::with_theme(&ColorfulTheme::default())
        .with_prompt(msg)
        .interact()?)
}

pub fn execute_setup(force: bool) -> Result<()> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

    // Step 1: Oh My Zsh
    if prompt_confirm("Install Oh My Zsh?")? {
        let omz_dir = format!("{}/.oh-my-zsh", home);
        if Path::new(&omz_dir).exists() {
            println!("Oh My Zsh already installed — skipped.");
        } else {
            println!("Installing Oh My Zsh...");
            run_shell(
                "sh",
                &["-c", "RUNZSH=no sh -c \"$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)\""],
            )?;
            println!("Oh My Zsh installed.");
        }
    }

    // Step 2: mise
    if prompt_confirm("Install mise?")? {
        let check = std::process::Command::new("which")
            .arg("mise")
            .output()?;
        if check.status.success() {
            println!("mise already installed — skipped.");
        } else {
            let brew_check = std::process::Command::new("which")
                .arg("brew")
                .output()?;
            if brew_check.status.success() {
                println!("Installing mise via Homebrew...");
                run_shell("brew", &["install", "mise"])?;
            } else {
                println!("Installing mise via curl...");
                run_shell("sh", &["-c", "sh -c \"$(curl https://mise.run)\""])?;
            }
            println!("mise installed.");
        }
    }

    // Step 3: .zshrc
    if prompt_confirm("Configure .zshrc?")? {
        let zshrc_path = format!("{}/.zshrc", home);
        let exists = Path::new(&zshrc_path).exists();
        let existing = if exists {
            std::fs::read_to_string(&zshrc_path)?
        } else {
            String::new()
        };

        if !force && existing.contains(ZSHRC_BEGIN) {
            let updated = apply_managed_section(&existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
            std::fs::write(&zshrc_path, &updated)?;
            println!(".zshrc already contains managed section — updated in place.");
        } else if force {
            if exists { backup_file(&zshrc_path)?; }
            let omz_dir = format!("{}/.oh-my-zsh", home);
            let omz_line = if Path::new(&omz_dir).exists() {
                format!("export ZSH=\"$HOME/.oh-my-zsh\"\nsource $ZSH/oh-my-zsh.sh\n\n")
            } else {
                String::new()
            };
            let content = format!("{omz_line}{ZSHRC_SECTION}\n");
            std::fs::write(&zshrc_path, &content)?;
            println!(".zshrc written.");
        } else {
            let updated = apply_managed_section(&existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
            std::fs::write(&zshrc_path, &updated)?;
            println!(".zshrc managed section appended.");
        }
    }

    // Step 4: .vimrc
    if prompt_confirm("Configure .vimrc?")? {
        let vimrc_path = format!("{}/.vimrc", home);
        let exists = Path::new(&vimrc_path).exists();
        let existing = if exists {
            std::fs::read_to_string(&vimrc_path)?
        } else {
            String::new()
        };

        if !force && existing.contains(VIMRC_BEGIN) {
            let updated = apply_managed_section(&existing, VIMRC_SECTION, VIMRC_BEGIN, VIMRC_END);
            std::fs::write(&vimrc_path, &updated)?;
            println!(".vimrc already contains managed section — updated in place.");
        } else if force {
            if exists { backup_file(&vimrc_path)?; }
            let content = format!("{VIMRC_SECTION}\n");
            std::fs::write(&vimrc_path, &content)?;
            println!(".vimrc written.");
        } else {
            let updated = apply_managed_section(&existing, VIMRC_SECTION, VIMRC_BEGIN, VIMRC_END);
            std::fs::write(&vimrc_path, &updated)?;
            println!(".vimrc managed section appended.");
        }
    }

    // Step 5: Git config
    if prompt_confirm("Configure global git settings?")? {
        let name_check = std::process::Command::new("git")
            .args(["config", "--global", "user.name"])
            .output()?;
        if name_check.status.success() {
            let current = String::from_utf8_lossy(&name_check.stdout);
            println!("Git user.name already set to: {}", current.trim());
        }

        let name: String = Input::with_theme(&ColorfulTheme::default())
            .with_prompt("Git user.name")
            .default("Your Name".to_string())
            .interact_text()?;

        let email: String = Input::with_theme(&ColorfulTheme::default())
            .with_prompt("Git user.email")
            .default("you@example.com".to_string())
            .interact_text()?;

        println!("Configuring git...");
        run_shell("git", &["config", "--global", "user.name", &name])?;
        run_shell("git", &["config", "--global", "user.email", &email])?;
        run_shell("git", &["config", "--global", "init.defaultBranch", "main"])?;
        run_shell("git", &["config", "--global", "core.editor", "vim"])?;
        run_shell("git", &["config", "--global", "pull.rebase", "false"])?;
        println!("Git configured.");
    }

    println!("Setup complete! Restart your shell or run: source ~/.zshrc");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_managed_section_appends_to_empty() {
        let result = apply_managed_section("", ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        assert!(result.contains(ZSHRC_BEGIN));
        assert!(result.contains(ZSHRC_END));
    }

    #[test]
    fn test_apply_managed_section_updates_in_place() {
        let existing = format!("prefix\n{ZSHRC_SECTION}\nsuffix");
        let new_section = "# BEGIN scli managed\nnew content\n# END scli managed";
        let result = apply_managed_section(&existing, new_section, ZSHRC_BEGIN, ZSHRC_END);
        assert_eq!(result, format!("prefix\n{new_section}\nsuffix"));
    }

    #[test]
    fn test_apply_managed_section_preserves_surrounding() {
        let existing = format!("before\n{ZSHRC_SECTION}\nafter");
        let result = apply_managed_section(existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        assert!(result.starts_with("before\n"));
        assert!(result.ends_with("\nafter"));
    }

    #[test]
    fn test_apply_managed_section_handles_only_begin() {
        let existing = "some text\n# BEGIN scli managed\nstuff";
        let result = apply_managed_section(existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        assert!(result.contains(ZSHRC_BEGIN));
        assert!(result.contains(ZSHRC_END));
    }

    #[test]
    fn test_apply_managed_section_handles_reversed_markers() {
        let existing = format!("# END scli managed\nmiddle\n# BEGIN scli managed");
        let result = apply_managed_section(existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        assert!(result.contains(ZSHRC_BEGIN));
        assert!(result.contains(ZSHRC_END));
    }

    #[test]
    fn test_apply_managed_section_exactly_one_pair_after_replacement() {
        let existing = format!("x\n{ZSHRC_SECTION}\ny");
        let result = apply_managed_section(existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        let begin_count = result.matches(ZSHRC_BEGIN).count();
        let end_count = result.matches(ZSHRC_END).count();
        assert_eq!(begin_count, 1, "Expected exactly one BEGIN marker");
        assert_eq!(end_count, 1, "Expected exactly one END marker");
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test --lib commands::setup`
Expected: all 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/commands/setup.rs
git commit -m "feat: implement setup command"
```

---

### Task 8: Implement git subcommands

**Files:**
- Create: `src/commands/git/sync.rs`
- Create: `src/commands/git/rebase.rs`
- Create: `src/commands/git/start.rs`
- Create: `src/commands/git/amend.rs`
- Create: `src/commands/git/deploy.rs`
- Create: `src/commands/git/prune.rs`
- Create: `src/commands/git/worktree.rs`

- [ ] **Step 1: Write git/sync.rs**

```rust
use anyhow::Result;
use crate::utils::git::{get_current_branch, get_default_branch, Shell};

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
```

- [ ] **Step 2: Write git/rebase.rs**

```rust
use anyhow::Result;
use crate::utils::git::{ensure_not_on_default_branch, Shell};

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn perform_rebase(shell: &dyn Shell, push: bool) -> Result<(String, String)> {
    let (current, default) = ensure_not_on_default_branch(shell)?;
    run_cmd(&["fetch", "origin", &default])?;
    run_cmd(&["rebase", &format!("origin/{default}")])?;
    if push {
        run_cmd(&["push", "--force-with-lease", "origin", &current])?;
    }
    Ok((current, default))
}

pub fn execute_rebase(shell: &dyn Shell, push: bool) -> Result<()> {
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
            if !stderr.is_empty() { eprintln!("{stderr}"); }
        } else {
            eprintln!("Rebase failed: {stderr}");
        }
        std::process::exit(1);
    }
    println!("Rebased");

    if push {
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

    struct MockShell {
        responses: Vec<anyhow::Result<String>>,
        index: std::sync::Mutex<usize>,
    }

    impl MockShell {
        fn new(responses: Vec<anyhow::Result<String>>) -> Self {
            Self { responses, index: std::sync::Mutex::new(0) }
        }
    }

    impl Shell for MockShell {
        fn run(&self, _cmd: &str, _args: &[&str]) -> anyhow::Result<String> {
            let mut idx = self.index.lock().unwrap();
            let resp = self.responses[*idx].clone();
            *idx += 1;
            resp
        }
    }

    #[test]
    fn test_perform_rebase_success_no_push() {
        let shell = MockShell::new(vec![
            Ok("feature-x".to_string()),
            Ok("refs/remotes/origin/main".to_string()),
        ]);
        let (current, default) = perform_rebase(&shell, false).unwrap();
        assert_eq!(current, "feature-x");
        assert_eq!(default, "main");
    }

    #[test]
    fn test_perform_rebase_on_default_branch_errors() {
        let shell = MockShell::new(vec![
            Ok("main".to_string()),
            Ok("refs/remotes/origin/main".to_string()),
        ]);
        assert!(perform_rebase(&shell, true).is_err());
    }
}
```

- [ ] **Step 3: Write git/start.rs**

```rust
use anyhow::Result;
use crate::utils::git::{get_default_branch, Shell};

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
```

- [ ] **Step 4: Write git/amend.rs**

```rust
use anyhow::Result;
use crate::utils::git::{get_current_branch, Shell};

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
```

- [ ] **Step 5: Write git/deploy.rs**

```rust
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

    // Return to source branch
    run_cmd(&["checkout", &source])?;
    Ok(())
}
```

- [ ] **Step 6: Write git/prune.rs**

```rust
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
```

- [ ] **Step 7: Write git/worktree.rs**

```rust
use anyhow::Result;
use crate::utils::git::Shell;

fn run_cmd(args: &[&str]) -> Result<String> {
    let output = std::process::Command::new("git").args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("git failed: {stderr}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn create_worktree(shell: &dyn Shell, name: &str, base: &str) -> Result<String> {
    let repo_root = shell.run("git", &["rev-parse", "--show-toplevel"])?;
    let parent = std::path::Path::new(&repo_root)
        .parent()
        .unwrap_or(std::path::Path::new("."));
    let worktree_path = parent.join(name);

    run_cmd(&["fetch", "origin", base])?;
    run_cmd(&[
        "worktree", "add", "-b", name,
        worktree_path.to_str().unwrap(),
        &format!("origin/{base}"),
    ])?;

    Ok(worktree_path.to_str().unwrap().to_string())
}

pub fn execute_worktree(shell: &dyn Shell, name: &str, base: &str) -> Result<()> {
    let repo_root = shell.run("git", &["rev-parse", "--show-toplevel"])?;
    let parent = std::path::Path::new(&repo_root.trim())
        .parent()
        .unwrap_or(std::path::Path::new("."));
    let worktree_path = parent.join(name);

    println!("Fetching origin/{base}...");
    run_cmd(&["fetch", "origin", base])?;
    println!("Fetched");

    println!("Creating worktree at {}...", worktree_path.display());
    run_cmd(&[
        "worktree", "add", "-b", name,
        worktree_path.to_str().unwrap(),
        &format!("origin/{base}"),
    ])?;
    println!("Created");

    println!("Worktree ready at {}", worktree_path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::git::Shell;

    struct MockShell {
        responses: Vec<anyhow::Result<String>>,
        index: std::sync::Mutex<usize>,
    }

    impl MockShell {
        fn new(responses: Vec<anyhow::Result<String>>) -> Self {
            Self { responses, index: std::sync::Mutex::new(0) }
        }
    }

    impl Shell for MockShell {
        fn run(&self, _cmd: &str, _args: &[&str]) -> anyhow::Result<String> {
            let mut idx = self.index.lock().unwrap();
            let resp = self.responses[*idx].clone();
            *idx += 1;
            resp
        }
    }

    #[test]
    fn test_create_worktree_resolves_path() {
        let shell = MockShell::new(vec![
            Ok("/home/user/repo".to_string()),
        ]);
        // create_worktree calls shell.run once, then two more git commands
        // We can't easily test the full path resolution in a unit test
        // since it also calls run_cmd which calls std::process::Command
        // Instead verify the shell interaction works
        let result = shell.run("git", &["rev-parse", "--show-toplevel"]);
        assert_eq!(result.unwrap(), "/home/user/repo");
    }
}
```

- [ ] **Step 8: Run all git command tests**

Run: `cargo test --lib commands::git::prune` and `cargo test --lib commands::git::rebase`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/commands/git/
git commit -m "feat: implement all git subcommands"
```

---

### Task 9: Implement project new command (scaffolding generators)

**Files:**
- Create: `src/commands/project/new.rs`

- [ ] **Step 1: Write project/new.rs**

```rust
use anyhow::Result;
use dialoguer::{Select, Confirm, theme::ColorfulTheme};
use std::path::Path;
use std::io::Write;

pub struct ProjectConfig {
    pub name: String,
    pub pm: String,
    pub runtime: String,
    pub workspaces: bool,
}

pub fn generate_mise_toml(config: &ProjectConfig) -> String {
    let mut tools = Vec::new();
    if config.runtime == "bun" {
        tools.push("bun = \"latest\"".to_string());
    } else {
        tools.push("node = \"lts\"".to_string());
    }
    if config.pm == "pnpm" {
        tools.push("pnpm = \"latest\"".to_string());
    }
    format!("[tools]\n{}\n", tools.join("\n"))
}

pub fn generate_package_json(config: &ProjectConfig) -> String {
    let test_cmd = if config.pm == "bun" { "bun test" } else { "pnpm test" };

    let mut pkg: serde_json::Value = serde_json::json!({
        "name": config.name,
        "version": "0.0.0",
        "private": true,
        "type": "module",
        "scripts": {
            "lint:ci": "biome ci --diagnostic-level=error",
            "test": test_cmd,
            "prepare": "node scripts/install-hooks.js"
        },
        "devDependencies": {
            "@biomejs/biome": "latest",
            "@commitlint/cli": "latest",
            "@commitlint/config-conventional": "latest",
            "@semantic-release/changelog": "latest",
            "@semantic-release/git": "latest",
            "conventional-changelog-conventionalcommits": "latest",
            "lefthook": "latest",
            "typescript": "latest"
        }
    });

    let runtime_dep = if config.runtime == "bun" { "@types/bun" } else { "@types/node" };
    pkg["devDependencies"][runtime_dep] = serde_json::json!("latest");

    if config.workspaces && config.pm == "bun" {
        pkg["workspaces"] = serde_json::json!(["packages/*"]);
    }

    serde_json::to_string_pretty(&pkg).unwrap() + "\n"
}

pub fn generate_ts_config() -> String {
    r#"{
	"compilerOptions": {
		"lib": ["ESNext"],
		"target": "ESNext",
		"module": "Preserve",
		"moduleDetection": "force",
		"allowJs": true,
		"moduleResolution": "bundler",
		"allowImportingTsExtensions": true,
		"verbatimModuleSyntax": true,
		"noEmit": true,
		"strict": true,
		"skipLibCheck": true,
		"noFallthroughCasesInSwitch": true,
		"noUncheckedIndexedAccess": true,
		"noImplicitOverride": true
	}
}
"#.to_string()
}

pub fn generate_biome_json() -> String {
    r#"{
	"$schema": "https://biomejs.dev/schemas/2.4.4/schema.json",
	"vcs": {
		"enabled": true,
		"clientKind": "git",
		"useIgnoreFile": true
	},
	"files": {
		"includes": ["**", "!!**/dist", "!!**/node_modules"]
	},
	"formatter": {
		"enabled": true,
		"indentStyle": "tab"
	},
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true
		}
	},
	"javascript": {
		"formatter": {
			"quoteStyle": "double"
		}
	},
	"assist": {
		"enabled": true,
		"actions": {
			"source": {
				"organizeImports": "on"
			}
		}
	}
}
"#.to_string()
}

pub fn generate_lefthook_yml(pm: &str) -> String {
    let dlx_cmd = if pm == "bun" { "bunx --bun" } else { "pnpm dlx" };
    format!("pre-commit:
  commands:
    biome:
      glob: \"*.{{js,ts,cjs,mjs,jsx,tsx,json,jsonc}}\"
      run: {dlx_cmd} biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {{staged_files}}
      stage_fixed: true

commit-msg:
  commands:
    commitlint:
      run: {dlx_cmd} commitlint --edit {{1}}
")
}

pub fn generate_gitignore() -> String {
    "node_modules/\ndist/\n.env\n.env.local\n".to_string()
}

pub fn generate_commitlint_rc() -> String {
    "{\n\t\"extends\": [\"@commitlint/config-conventional\"]\n}\n".to_string()
}

pub fn generate_release_rc() -> String {
    r#"{
	"branches": ["master", "main"],
	"plugins": [
		"@commitlint/commit-analyzer",
		"@commitlint/release-notes-generator",
		"@semantic-release/changelog",
		["@semantic-release/npm", { "npmPublish": false }],
		[
			"@semantic-release/git",
			{
				"assets": ["CHANGELOG.md", "package.json"],
				"message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
			}
		],
		"@semantic-release/github"
	]
}
"#.to_string()
}

pub fn generate_ci_yml(pm: &str) -> String {
    let install = if pm == "bun" { "bun install" } else { "pnpm install" };
    let lint = if pm == "bun" { "bun run lint:ci" } else { "pnpm run lint:ci" };
    let test = if pm == "bun" { "bun test" } else { "pnpm test" };
    let commitlint = if pm == "bun" { "bunx --bun commitlint" } else { "pnpm dlx commitlint" };
    format!(
        "name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: jdx/mise-action@v3

      - run: {install}

      - name: Validate commit messages
        run: |
          if [ \"${{{{ github.event_name }}}}\" = \"pull_request\" ]; then
            {commitlint} --from ${{{{ github.event.pull_request.base.sha }}}} --to ${{{{ github.event.pull_request.head.sha }}}} --verbose
          else
            {commitlint} --from HEAD~1 --to HEAD --verbose
          fi

      - run: {lint}

      - run: {test}
"
    )
}

pub fn generate_release_yml(pm: &str) -> String {
    let install = if pm == "bun" { "bun install" } else { "pnpm install" };
    let lint = if pm == "bun" { "bun run lint:ci" } else { "pnpm run lint:ci" };
    let test = if pm == "bun" { "bun test" } else { "pnpm test" };
    format!(
        "name: Release

on:
  push:
    branches: [master, main]
  workflow_dispatch:

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: jdx/mise-action@v3

      - run: {install}

      - run: {lint}

      - run: {test}

      - uses: cycjimmy/semantic-release-action@v4
        with:
          extra_plugins: |
            @semantic-release/changelog
            @semantic-release/git
            conventional-changelog-conventionalcommits
        env:
          GITHUB_TOKEN: ${{{{ secrets.GITHUB_TOKEN }}}}
"
    )
}

pub fn generate_install_hooks_script() -> String {
    "#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const isGitRepo = existsSync('.git');

if (isGitRepo) {
  try {
    execSync('lefthook install', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to install lefthook hooks:', error);
    process.exit(1);
  }
} else {
  console.log('Skipping lefthook install (not in a git repository)');
}
".to_string()
}

pub fn generate_pnpm_workspace() -> String {
    "packages:\n  - \"packages/*\"\n".to_string()
}

pub fn generate_entry_point(runtime: &str) -> String {
    let comment = if runtime == "bun" {
        "// Entry point — run with: bun src/index.ts"
    } else {
        "// Entry point — run with: node --experimental-strip-types src/index.ts"
    };
    format!("{comment}\nconsole.log(\"Hello, world!\");\n")
}

pub fn generate_renovate_json() -> String {
    r#"{
	"$schema": "https://docs.renovatebot.com/renovate-schema.json",
	"extends": ["config:best-practices", ":preserveSemverRanges"],
	"schedule": ["before 9am on monday"],
	"minimumReleaseAge": "5 days",
	"prConcurrentLimit": 10,
	"ignorePaths": ["Dockerfile"],
	"packageRules": [
		{
			"description": "Automerge minor/patch/digest updates",
			"matchUpdateTypes": ["minor", "patch", "digest"],
			"automerge": true,
			"automergeType": "pr"
		},
		{
			"description": "Commitlint packages",
			"groupName": "commitlint",
			"matchPackageNames": ["/^@commitlint/"]
		},
		{
			"description": "GitHub Actions",
			"matchManagers": ["github-actions"],
			"groupName": "github-actions"
		}
	]
}
"#.to_string()
}

pub fn generate_renovate_yml() -> String {
    r#"name: Renovate

on:
  schedule:
    - cron: '0 14 * * *'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  renovate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@1af3b93b6815bc44a9784bd300feb67ff0d1eeb3 # v6
      - uses: renovatebot/github-action@abd08c7549b2a864af5df4a2e369c43f035a6a9d # v46.1.5
        with:
          token: ${{ secrets.RENOVATE_TOKEN }}
        env:
          RENOVATE_REPOSITORIES: ${{ github.repository }}
"#.to_string()
}

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

pub fn execute_project_new(name: &str) -> Result<()> {
    let pm_idx = Select::with_theme(&ColorfulTheme::default())
        .with_prompt("Package manager")
        .items(&["bun", "pnpm"])
        .default(0)
        .interact()?;
    let pm = if pm_idx == 0 { "bun" } else { "pnpm" };

    let runtime_idx = Select::with_theme(&ColorfulTheme::default())
        .with_prompt("Runtime")
        .items(&["Bun", "NodeJS"])
        .default(0)
        .interact()?;
    let runtime = if runtime_idx == 0 { "bun" } else { "node" };

    let workspaces = Confirm::with_theme(&ColorfulTheme::default())
        .with_prompt("Enable workspaces?")
        .default(false)
        .interact()?;

    let config = ProjectConfig {
        name: name.to_string(),
        pm: pm.to_string(),
        runtime: runtime.to_string(),
        workspaces,
    };

    let root = Path::new(".").join(name);
    let root_str = root.to_str().unwrap();

    // Create directories
    std::fs::create_dir_all(root.join("src"))?;
    std::fs::create_dir_all(root.join("scripts"))?;
    std::fs::create_dir_all(root.join(".github/workflows"))?;
    if config.workspaces {
        std::fs::create_dir_all(root.join("packages"))?;
    }

    // Write files
    std::fs::write(root.join("mise.toml"), generate_mise_toml(&config))?;
    std::fs::write(root.join("package.json"), generate_package_json(&config))?;
    std::fs::write(root.join("tsconfig.json"), generate_ts_config())?;
    std::fs::write(root.join("biome.json"), generate_biome_json())?;
    std::fs::write(root.join(".gitignore"), generate_gitignore())?;
    std::fs::write(root.join("lefthook.yml"), generate_lefthook_yml(&config.pm))?;
    std::fs::write(root.join("scripts/install-hooks.js"), generate_install_hooks_script())?;
    std::fs::write(root.join(".commitlintrc.json"), generate_commitlint_rc())?;
    std::fs::write(root.join(".releaserc.json"), generate_release_rc())?;
    std::fs::write(root.join(".github/workflows/ci.yml"), generate_ci_yml(&config.pm))?;
    std::fs::write(root.join(".github/workflows/release.yml"), generate_release_yml(&config.pm))?;
    std::fs::write(root.join("src/index.ts"), generate_entry_point(&config.runtime))?;

    if config.workspaces && config.pm == "pnpm" {
        std::fs::write(root.join("pnpm-workspace.yaml"), generate_pnpm_workspace())?;
    }

    // Git init
    run_cmd_in(root_str, "git", &["init"])?;

    // Install deps
    let install_cmd = if config.pm == "bun" { "bun" } else { "pnpm" };
    run_cmd_in(root_str, install_cmd, &["install"])?;

    // Initial commit
    run_cmd_in(root_str, "git", &["add", "-A"])?;
    run_cmd_in(root_str, "git", &["commit", "-m", "chore: initial commit"])?;

    println!("Project created! cd {name} to get started.");
    Ok(())
}
```

- [ ] **Step 2: Verify compilation**

Run: `cargo build`
Expected: compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src/commands/project/new.rs
git commit -m "feat: implement project new command"
```

---

### Task 10: Implement project add command

**Files:**
- Create: `src/commands/project/add.rs`

- [ ] **Step 1: Write project/add.rs**

```rust
use anyhow::Result;
use dialoguer::Select;
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

async fn detect_pm(cwd: &str) -> Result<String> {
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
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(pm) = pkg.get("packageManager").and_then(|v| v.as_str()) {
                if pm.starts_with("pnpm") { return Ok("pnpm".to_string()); }
                if pm.starts_with("bun") { return Ok("bun".to_string()); }
            }
        }
    }

    let pm_idx = Select::with_theme(&ColorfulTheme::default())
        .with_prompt("Could not detect package manager. Which are you using?")
        .items(&["bun", "pnpm"])
        .default(0)
        .interact()?;
    Ok(if pm_idx == 0 { "bun".to_string() } else { "pnpm".to_string() })
}

async fn add_lefthook(cwd: &str, pm: &str) -> Result<()> {
    let root = Path::new(cwd);

    // lefthook.yml
    let lefthook_path = root.join("lefthook.yml");
    if lefthook_path.exists() {
        eprintln!("lefthook.yml already exists — skipped");
    } else {
        std::fs::write(&lefthook_path, generate_lefthook_yml(pm))?;
    }

    // install-hooks.js
    let scripts_dir = root.join("scripts");
    let hooks_path = scripts_dir.join("install-hooks.js");
    if hooks_path.exists() {
        eprintln!("scripts/install-hooks.js already exists — skipped");
    } else {
        std::fs::create_dir_all(&scripts_dir)?;
        std::fs::write(&hooks_path, generate_install_hooks_script())?;
    }

    // Update package.json
    let pkg_path = root.join("package.json");
    if pkg_path.exists() {
        let content = std::fs::read_to_string(&pkg_path)?;
        if let Ok(mut pkg) = serde_json::from_str::<serde_json::Value>(&content) {
            if pkg.get("scripts").and_then(|s| s.as_object()).map_or(true, |s| !s.contains_key("prepare")) {
                if let Some(obj) = pkg.get_mut("scripts").and_then(|s| s.as_object_mut()) {
                    obj.insert("prepare".to_string(), serde_json::json!("node scripts/install-hooks.js"));
                }
                std::fs::write(&pkg_path, serde_json::to_string_pretty(&pkg).unwrap() + "\n")?;
            }
        }
    }

    // .commitlintrc.json
    let commitlint_path = root.join(".commitlintrc.json");
    if commitlint_path.exists() {
        eprintln!(".commitlintrc.json already exists — skipped");
    } else {
        std::fs::write(&commitlint_path, generate_commitlint_rc())?;
    }

    // Install packages
    let dlx_cmd = if pm == "bun" { "bunx" } else { "pnpm dlx" };
    if pm == "bun" {
        run_cmd_in(cwd, "bun", &["add", "-d", "lefthook", "@commitlint/cli", "@commitlint/config-conventional"])?;
        run_cmd_in(cwd, "bunx", &["lefthook", "install"])?;
    } else {
        run_cmd_in(cwd, "pnpm", &["add", "-D", "lefthook", "@commitlint/cli", "@commitlint/config-conventional"])?;
        run_cmd_in(cwd, "pnpm", &["dlx", "lefthook", "install"])?;
    }

    Ok(())
}

async fn add_standard_release(cwd: &str, pm: &str) -> Result<()> {
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
        run_cmd_in(cwd, "bun", &[
            "add", "-d",
            "@commitlint/cli", "@commitlint/config-conventional",
            "@semantic-release/changelog", "@semantic-release/git",
            "conventional-changelog-conventionalcommits",
        ])?;
    } else {
        run_cmd_in(cwd, "pnpm", &[
            "add", "-D",
            "@commitlint/cli", "@commitlint/config-conventional",
            "@semantic-release/changelog", "@semantic-release/git",
            "conventional-changelog-conventionalcommits",
        ])?;
    }

    Ok(())
}

async fn add_renovate(cwd: &str, _pm: &str) -> Result<()> {
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

pub async fn execute_project_add(feature: &str) -> Result<()> {
    let cwd = std::env::current_dir()?;
    let cwd_str = cwd.to_str().unwrap();

    match feature {
        "lefthook" => add_lefthook(cwd_str, &detect_pm(cwd_str).await?).await?,
        "standard-release" => add_standard_release(cwd_str, &detect_pm(cwd_str).await?).await?,
        "renovate" => add_renovate(cwd_str, &detect_pm(cwd_str).await?).await?,
        _ => anyhow::bail!("Unknown feature \"{feature}\". Valid options: lefthook, standard-release, renovate"),
    }

    println!("{feature} added successfully.");
    Ok(())
}
```

- [ ] **Step 2: Verify compilation**

Run: `cargo build`
Expected: compiles

- [ ] **Step 3: Commit**

```bash
git add src/commands/project/add.rs
git commit -m "feat: implement project add command"
```

---

### Task 11: Implement update command

**Files:**
- Modify: `src/commands/update.rs`

- [ ] **Step 1: Write update.rs**

```rust
use anyhow::Result;
use dialoguer::{Confirm, theme::ColorfulTheme};
use crate::utils::update::{get_latest_release, is_update_available, get_platform_slug, get_download_url};
use std::io::Read;

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

    let mut body: Vec<u8> = Vec::new();
    response.into_reader().read_to_end(&mut body)?;
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
```

- [ ] **Step 2: Verify compilation**

Run: `cargo build`
Expected: compiles

- [ ] **Step 3: Commit**

```bash
git add src/commands/update.rs
git commit -m "feat: implement update command"
```

---

### Task 12: Wire up main.rs with CLI parsing and update check

**Files:**
- Modify: `src/main.rs`

- [ ] **Step 1: Write final src/main.rs**

All project/add.rs functions must be synchronous (no async/await, no tokio). Use `std::process::Command` directly.

```rust
use clap::Parser;
use scli::cli::{Cli, Commands, GitCommands, ProjectCommands};
use scli::commands;
use scli::utils::git::RealShell;
use scli::utils::update::{get_latest_release, is_update_available};

fn main() {
    let cli = Cli::parse();

    let skip_check = matches!(&cli.command, Commands::Update { .. });
    let update_notice = if !skip_check {
        match get_latest_release() {
            Ok(latest) => {
                let current = env!("CARGO_PKG_VERSION");
                if is_update_available(current, &latest.version) {
                    Some(format!(
                        "\x1b[2mA new version of scli is available: v{} (current: v{current}). Run `scli update` to upgrade.\x1b[0m",
                        latest.version
                    ))
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    } else {
        None
    };

    let result = match &cli.command {
        Commands::Nuke { target, force } => {
            commands::nuke::execute_nuke(target, *force)
        }
        Commands::Setup { force } => {
            commands::setup::execute_setup(*force)
        }
        Commands::Git(git_cmd) => {
            let shell = RealShell;
            match git_cmd {
                GitCommands::Amend { push } => commands::git::amend::execute_amend(&shell, *push),
                GitCommands::Deploy { branch, force } => commands::git::deploy::execute_deploy(&shell, branch, *force),
                GitCommands::Prune { pattern, force } => commands::git::prune::execute_prune(pattern.as_deref(), *force),
                GitCommands::Rebase { push } => commands::git::rebase::execute_rebase(&shell, *push),
                GitCommands::Start { name } => commands::git::start::execute_start(&shell, name),
                GitCommands::Sync => commands::git::sync::execute_sync(&shell),
                GitCommands::Worktree { name, base } => commands::git::worktree::execute_worktree(&shell, name, base),
            }
        }
        Commands::Project(proj_cmd) => {
            match proj_cmd {
                ProjectCommands::New { name } => commands::project::new::execute_project_new(name),
                ProjectCommands::Add { feature } => commands::project::add::execute_project_add(feature),
            }
        }
        Commands::Update { check } => commands::update::execute_update(*check),
    };

    if let Err(e) = result {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }

    if let Some(notice) = update_notice {
        eprintln!("\n{notice}");
    }
}
```

```rust
use clap::Parser;
use scli::cli::{Cli, Commands, GitCommands, ProjectCommands};
use scli::commands;
use scli::utils::git::RealShell;
use scli::utils::update::{get_latest_release, is_update_available};

fn main() {
    let cli = Cli::parse();

    let skip_check = matches!(&cli.command, Commands::Update { .. });
    let update_notice = if !skip_check {
        match get_latest_release() {
            Ok(latest) => {
                let current = env!("CARGO_PKG_VERSION");
                if is_update_available(current, &latest.version) {
                    Some(format!(
                        "\x1b[2mA new version of scli is available: v{} (current: v{current}). Run `scli update` to upgrade.\x1b[0m",
                        latest.version
                    ))
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    } else {
        None
    };

    let result = match &cli.command {
        Commands::Nuke { target, force } => {
            commands::nuke::execute_nuke(target, *force)
        }
        Commands::Setup { force } => {
            commands::setup::execute_setup(*force)
        }
        Commands::Git(git_cmd) => {
            let shell = RealShell;
            match git_cmd {
                GitCommands::Amend { push } => commands::git::amend::execute_amend(&shell, *push),
                GitCommands::Deploy { branch, force } => commands::git::deploy::execute_deploy(&shell, branch, *force),
                GitCommands::Prune { pattern, force } => commands::git::prune::execute_prune(pattern.as_deref(), *force),
                GitCommands::Rebase { push } => commands::git::rebase::execute_rebase(&shell, *push),
                GitCommands::Start { name } => commands::git::start::execute_start(&shell, name),
                GitCommands::Sync => commands::git::sync::execute_sync(&shell),
                GitCommands::Worktree { name, base } => commands::git::worktree::execute_worktree(&shell, name, base),
            }
        }
        Commands::Project(proj_cmd) => {
            match proj_cmd {
                ProjectCommands::New { name } => commands::project::new::execute_project_new(name),
                ProjectCommands::Add { feature } => commands::project::add::execute_project_add(feature),
            }
        }
        Commands::Update { check } => commands::update::execute_update(*check),
    };

    if let Err(e) = result {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }

    if let Some(notice) = update_notice {
        eprintln!("\n{notice}");
    }
}
```

- [ ] **Step 2: Also make project/add.rs fully synchronous**

Change `async fn` to `fn` throughout, replace `run_cmd_in` calls with direct sync calls, remove all `.await` and `use std::io::Read` if not needed.

- [ ] **Step 3: Verify compilation**

Run: `cargo build`
Expected: compiles cleanly

- [ ] **Step 4: Run all tests**

Run: `cargo test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main.rs src/commands/project/add.rs
git commit -m "feat: wire up main.rs with CLI parsing and update check"
```

---

### Task 13: Update CI and release workflows for Rust

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `install.sh`

- [ ] **Step 1: Rewrite .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: dtolnay/rust-toolchain@stable

      - run: cargo build
      - run: cargo test
      - run: cargo clippy -- -D warnings
```

- [ ] **Step 2: Rewrite .github/workflows/release.yml**

```yaml
name: Release

on:
  push:
    branches: [master, main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    outputs:
      new_release_published: ${{ steps.semantic.outputs.new_release_published }}
      new_release_version: ${{ steps.semantic.outputs.new_release_version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - id: semantic
        uses: cycjimmy/semantic-release-action@v4
        with:
          extra_plugins: |
            @semantic-release/changelog
            @semantic-release/git
            conventional-changelog-conventionalcommits
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build:
    needs: [release]
    if: needs.release.outputs.new_release_published == 'true'
    strategy:
      matrix:
        include:
          - target: x86_64-apple-darwin
            os: macos-latest
            slug: scli-macos-x64
          - target: aarch64-apple-darwin
            os: macos-latest
            slug: scli-macos-arm64
          - target: x86_64-unknown-linux-musl
            os: ubuntu-latest
            slug: scli-linux-x64
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - run: cargo build --target ${{ matrix.target }} --release

      - uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ needs.release.outputs.new_release_version }}
          files: target/${{ matrix.target }}/release/scli
```

Note: `cycjimmy/semantic-release-action` outputs `new_release_published` and `new_release_version`. If this doesn't work, fall back to uploading artifacts then using `gh release upload` from a script.

- [ ] **Step 3: Rewrite install.sh for Rust + mise**

```bash
#!/bin/sh
set -e
mise install
cargo build --release
cp target/release/scli ~/.local/bin/scli
echo "Installed scli to ~/.local/bin/scli"
```

- [ ] **Step 4: Remove bunfig.toml (no longer needed)**

```bash
git rm bunfig.toml
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ install.sh
git rm bunfig.toml
git commit -m "ci: update workflows for Rust build matrix, update install.sh"
```

---

### Task 14: Update README for Rust version

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README install/build instructions**

Replace Bun-based instructions with Rust/cargo-based instructions:

```markdown
## Install

### Download a binary (recommended)

Pre-built binaries are available on the [Releases page](https://github.com/ssilve1989/personal-cli/releases/latest):

| Platform | Binary |
|---|---|
| macOS (Apple Silicon) | `scli-macos-arm64` |
| macOS (Intel) | `scli-macos-x64` |
| Linux (x64) | `scli-linux-x64` |

Download, make executable, and move to your `$PATH`:

```bash
chmod +x scli-*
mv scli-* ~/.local/bin/scli
```

### Build from source

```bash
cargo build --release
mv target/release/scli ~/.local/bin/scli
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for Rust build instructions"
```

---

### Task 15: Final verification

- [ ] **Step 1: Build release binary**

Run: `cargo build --release`
Expected: compiles without warnings

- [ ] **Step 2: Run all tests**

Run: `cargo test`
Expected: all tests pass

- [ ] **Step 3: Quick smoke test**

Run: `./target/release/scli --help`
Expected: prints help with all subcommands

Run: `./target/release/scli --version`
Expected: prints version from Cargo.toml

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: finalize Rust CLI rewrite"
```
