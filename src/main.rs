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
                GitCommands::Rebase { no_push } => commands::git::rebase::execute_rebase(&shell, *no_push),
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
