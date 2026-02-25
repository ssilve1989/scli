import * as prompts from "@clack/prompts";
import { Command } from "commander";

type Spinner = ReturnType<typeof prompts.spinner>;

function getErrorMessage(e: unknown): string {
	if (e instanceof Error) return e.message;
	return String(e);
}

const ZSHRC_BEGIN = "# BEGIN scli managed";
const ZSHRC_END = "# END scli managed";

const ZSHRC_SECTION = `${ZSHRC_BEGIN}
eval "$(mise activate zsh)"

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
${ZSHRC_END}`;

const VIMRC_BEGIN = '" BEGIN scli managed';
const VIMRC_END = '" END scli managed';

const VIMRC_SECTION = `${VIMRC_BEGIN}
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
${VIMRC_END}`;

function applyManagedSection(
	existing: string,
	section: string,
	beginMarker: string,
	endMarker: string,
): string {
	const beginIdx = existing.indexOf(beginMarker);
	const endIdx = existing.indexOf(endMarker);

	const hasBoth = beginIdx !== -1 && endIdx !== -1 && beginIdx < endIdx;

	if (hasBoth) {
		// Replace only the content between (and including) the markers
		const before = existing.slice(0, beginIdx);
		const after = existing.slice(endIdx + endMarker.length);
		return `${before}${section}${after}`;
	}

	// Partial/corrupt or missing — append fresh
	const trimmed = existing.trimEnd();
	const separator = trimmed.length > 0 ? "\n\n" : "";
	return `${trimmed}${separator}${section}\n`;
}

async function backupFile(filePath: string, s: Spinner): Promise<void> {
	const timestamp = Date.now();
	const backupPath = `${filePath}.backup.${timestamp}`;
	s.message(`Backing up to ${backupPath}...`);
	const content = await Bun.file(filePath).text();
	await Bun.write(backupPath, content);
}

export const setup = new Command("setup")
	.description("Bootstrap a new machine with tools and dotfiles")
	.option("-f, --force", "Replace dotfiles entirely instead of additive patch")
	.action(async (opts: { force?: boolean }) => {
		prompts.intro("setup");

		const HOME = process.env["HOME"] ?? "/tmp";

		// ── Step 1: Oh My Zsh ────────────────────────────────────────────────────
		const installOmz = await prompts.confirm({
			message: "Install Oh My Zsh?",
		});

		if (prompts.isCancel(installOmz)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		if (installOmz) {
			const s = prompts.spinner();
			s.start("Installing Oh My Zsh...");
			try {
				const omzDir = Bun.file(`${HOME}/.oh-my-zsh`);
				if (await omzDir.exists()) {
					s.stop("Oh My Zsh already installed — skipped.");
				} else {
					await Bun.$`RUNZSH=no sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`.quiet();
					s.stop("Oh My Zsh installed.");
				}
			} catch (e) {
				s.stop(`Failed to install Oh My Zsh: ${getErrorMessage(e)}`);
			}
		}

		// ── Step 2: mise ─────────────────────────────────────────────────────────
		const installMise = await prompts.confirm({
			message: "Install mise?",
		});

		if (prompts.isCancel(installMise)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		if (installMise) {
			const s = prompts.spinner();
			s.start("Installing mise...");
			try {
				const miseCheck = await Bun.$`which mise`.nothrow().quiet();
				if (miseCheck.exitCode === 0) {
					s.stop("mise already installed — skipped.");
				} else {
					const brewCheck = await Bun.$`which brew`.nothrow().quiet();
					if (brewCheck.exitCode === 0) {
						s.message("Installing mise via Homebrew...");
						await Bun.$`brew install mise`.quiet();
					} else {
						s.message("Installing mise via curl...");
						await Bun.$`sh -c "$(curl https://mise.run)"`.quiet();
					}
					s.stop("mise installed.");
				}
			} catch (e) {
				s.stop(`Failed to install mise: ${getErrorMessage(e)}`);
			}
		}

		// ── Step 3: .zshrc ───────────────────────────────────────────────────────
		const configureZshrc = await prompts.confirm({
			message: "Configure .zshrc?",
		});

		if (prompts.isCancel(configureZshrc)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		if (configureZshrc) {
			const s = prompts.spinner();
			s.start("Writing .zshrc managed section...");
			try {
				const zshrcPath = `${HOME}/.zshrc`;
				const zshrcFile = Bun.file(zshrcPath);
				const exists = await zshrcFile.exists();
				const existing = exists ? await zshrcFile.text() : "";

				if (!opts.force && existing.includes(ZSHRC_BEGIN)) {
					s.stop(".zshrc already contains managed section — updated in place.");
					const updated = applyManagedSection(
						existing,
						ZSHRC_SECTION,
						ZSHRC_BEGIN,
						ZSHRC_END,
					);
					await Bun.write(zshrcPath, updated);
				} else if (opts.force) {
					if (exists) {
						await backupFile(zshrcPath, s);
					}
					s.message("Writing .zshrc...");
					const omzInstalled = await Bun.file(`${HOME}/.oh-my-zsh`).exists();
					const omzLine = omzInstalled
						? `export ZSH="$HOME/.oh-my-zsh"\nsource $ZSH/oh-my-zsh.sh\n\n`
						: "";
					await Bun.write(zshrcPath, `${omzLine}${ZSHRC_SECTION}\n`);
					s.stop(".zshrc written.");
				} else {
					s.message("Appending managed section to .zshrc...");
					const updated = applyManagedSection(
						existing,
						ZSHRC_SECTION,
						ZSHRC_BEGIN,
						ZSHRC_END,
					);
					await Bun.write(zshrcPath, updated);
					s.stop(".zshrc managed section appended.");
				}
			} catch (e) {
				s.stop(`Failed to configure .zshrc: ${getErrorMessage(e)}`);
			}
		}

		// ── Step 4: .vimrc ───────────────────────────────────────────────────────
		const configureVimrc = await prompts.confirm({
			message: "Configure .vimrc?",
		});

		if (prompts.isCancel(configureVimrc)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		if (configureVimrc) {
			const s = prompts.spinner();
			s.start("Writing .vimrc managed section...");
			try {
				const vimrcPath = `${HOME}/.vimrc`;
				const vimrcFile = Bun.file(vimrcPath);
				const exists = await vimrcFile.exists();
				const existing = exists ? await vimrcFile.text() : "";

				if (!opts.force && existing.includes(VIMRC_BEGIN)) {
					s.stop(".vimrc already contains managed section — updated in place.");
					const updated = applyManagedSection(
						existing,
						VIMRC_SECTION,
						VIMRC_BEGIN,
						VIMRC_END,
					);
					await Bun.write(vimrcPath, updated);
				} else if (opts.force) {
					if (exists) {
						await backupFile(vimrcPath, s);
					}
					s.message("Writing .vimrc...");
					await Bun.write(vimrcPath, `${VIMRC_SECTION}\n`);
					s.stop(".vimrc written.");
				} else {
					s.message("Appending managed section to .vimrc...");
					const updated = applyManagedSection(
						existing,
						VIMRC_SECTION,
						VIMRC_BEGIN,
						VIMRC_END,
					);
					await Bun.write(vimrcPath, updated);
					s.stop(".vimrc managed section appended.");
				}
			} catch (e) {
				s.stop(`Failed to configure .vimrc: ${getErrorMessage(e)}`);
			}
		}

		// ── Step 5: Global git config ─────────────────────────────────────────────
		const configureGit = await prompts.confirm({
			message: "Configure global git settings?",
		});

		if (prompts.isCancel(configureGit)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		if (configureGit) {
			try {
				const gitNameCheck =
					await Bun.$`git config --global user.name`.nothrow().quiet();
				if (gitNameCheck.exitCode === 0) {
					prompts.log.info(
						`Git user.name already set to: ${gitNameCheck.stdout.toString().trim()}`,
					);
				}

				const name = await prompts.text({
					message: "Git user.name",
					placeholder: "Your Name",
				});

				if (prompts.isCancel(name)) {
					prompts.cancel("Cancelled.");
					process.exit(0);
				}

				const email = await prompts.text({
					message: "Git user.email",
					placeholder: "you@example.com",
				});

				if (prompts.isCancel(email)) {
					prompts.cancel("Cancelled.");
					process.exit(0);
				}

				const s = prompts.spinner();
				s.start("Configuring git...");
				try {
					await Bun.$`git config --global user.name ${name}`.quiet();
					await Bun.$`git config --global user.email ${email}`.quiet();
					await Bun.$`git config --global init.defaultBranch main`.quiet();
					await Bun.$`git config --global core.editor vim`.quiet();
					await Bun.$`git config --global pull.rebase false`.quiet();
					s.stop("Git configured.");
				} catch (e) {
					s.stop(`Failed to configure git: ${getErrorMessage(e)}`);
				}
			} catch (e) {
				prompts.log.error(`Git config step failed: ${getErrorMessage(e)}`);
			}
		}

		prompts.outro(
			"Setup complete! Restart your shell or run: source ~/.zshrc",
		);
	});
