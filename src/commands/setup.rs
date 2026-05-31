use anyhow::{Context, Result};
use dialoguer::{Confirm, Input, theme::ColorfulTheme};
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
        let result = apply_managed_section(&existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
    assert!(result.starts_with("before\n"));
        assert!(result.ends_with("\nafter"));
    }

    #[test]
    fn test_apply_managed_section_handles_only_begin() {
        let existing = "some text\n# BEGIN scli managed\nstuff";
        let result = apply_managed_section(&existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        assert!(result.contains(ZSHRC_BEGIN));
        assert!(result.contains(ZSHRC_END));
    }

    #[test]
    fn test_apply_managed_section_handles_reversed_markers() {
        let existing = format!("# END scli managed\nmiddle\n# BEGIN scli managed");
        let result = apply_managed_section(&existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        assert!(result.contains(ZSHRC_BEGIN));
        assert!(result.contains(ZSHRC_END));
    }

    #[test]
    fn test_apply_managed_section_exactly_one_pair_after_replacement() {
        let existing = format!("x\n{ZSHRC_SECTION}\ny");
        let result = apply_managed_section(&existing, ZSHRC_SECTION, ZSHRC_BEGIN, ZSHRC_END);
        let begin_count = result.matches(ZSHRC_BEGIN).count();
        let end_count = result.matches(ZSHRC_END).count();
        assert_eq!(begin_count, 1, "Expected exactly one BEGIN marker");
        assert_eq!(end_count, 1, "Expected exactly one END marker");
    }
}
