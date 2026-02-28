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

Download, rename to `scli`, make executable, and move to your `$PATH`:

```bash
chmod +x scli-macos-arm64
mv scli-macos-arm64 ~/.local/bin/scli
```

### Build from source

```bash
bun install
bun run build
mv dist/scli ~/.local/bin/scli
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

## Development

```bash
bun install
bun run index.ts
```
