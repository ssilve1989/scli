# scli

Personal CLI Toolkit 

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

## Commands

### `scli nuke <target>`

Kill processes by port number or name.

```
Arguments:
  target          Port number or process name

Options:
  -f, --force     Kill all matches without prompting
```

### `scli setup`

Bootstrap a new machine with tools and dotfiles. Interactively installs Oh My Zsh, mise, and configures `.zshrc`, `.vimrc`, and global git settings.

```
Options:
  -f, --force     Replace dotfiles entirely instead of additive patch
```

### `scli git`

Git utilities.

#### `scli git amend`

Stage tracked changes and amend the last commit.

```
Options:
  -p, --push      Force push after amending
```

#### `scli git deploy <branch>`

Sync a deploy branch to the current branch and push.

```
Arguments:
  branch          Target deploy branch

Options:
  -f, --force     Skip confirmation prompt
```

#### `scli git prune [pattern]`

Interactively delete local git branches.

```
Arguments:
  pattern         Filter branches by substring (optional)

Options:
  -f, --force     Skip confirmation prompt
```

#### `scli git rebase`

Rebase current branch on the default branch and force push.

```
Options:
  --no-push       Skip the force push step
```

#### `scli git start <name>`

Create a new branch from a fresh default branch.

```
Arguments:
  name            Name for the new branch
```

#### `scli git sync`

Sync the default branch and return to the current branch.

### `scli project`

Project utilities.

#### `scli project new <name>`

Scaffold a new TypeScript project.

```
Arguments:
  name            Name for the new project
```

#### `scli project add <feature>`

Add a feature to an existing project.

```
Arguments:
  feature         Feature to add (lefthook, standard-release)
```

### `scli update`

Update scli to the latest version.

```
Options:
  --check         Check for updates without installing
```

## Development

```bash
cargo build
cargo test
```

### Git hooks

Pre-commit and commit-msg hooks live in `.githooks/`. To enable them:

```bash
mise run setup
# or manually:
git config core.hooksPath .githooks
```

This configures `core.hooksPath` locally for the repo. The pre-commit hook runs `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test`. The commit-msg hook validates conventional commit format (`type(scope): description`).

### Available mise tasks

```bash
mise run test       # cargo test
mise run format     # cargo fmt
mise run lint       # cargo clippy -- -D warnings
mise run build      # cargo build --release
mise run setup      # git config core.hooksPath .githooks
```

### Releasing

Releases are automated via [release-plz](https://release-plz.dev). On push to `master`, a Release PR is opened/updated with version bumps and a changelog derived from conventional commits. Merging the Release PR creates a git tag, publishes a GitHub release, and triggers cross-compiled binary builds for macOS (x64/arm64) and Linux (x64).

**Required repo setting:** Enable **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"** for the release-plz workflow to function.
