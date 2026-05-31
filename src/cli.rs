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
