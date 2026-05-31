# Rust CLI Rewrite — Design Spec

## Overview

Port the existing `scli` TypeScript/Bun CLI to Rust as a single-crate project. Keeps all commands and flags identical (1:1 port). Goal: eliminate Bun runtime dependency, reduce binary size, improve startup time.

## Dependencies

```toml
[dependencies]
clap = { version = "4", features = ["derive"] }
anyhow = "1"
thiserror = "2"
ureq = { version = "3", features = ["json"] }
semver = "1"
serde = { version = "1", features = ["derive"] }
dialoguer = "0.11"
```

No async runtime. All operations are synchronous shell-outs or file I/O. The JS update check's parallel-race pattern is unnecessary — Rust starts instantly so a blocking HTTP call is fine.

## Project structure

```
personal-cli/
├── Cargo.toml
├── src/
│   ├── main.rs               # entry point, version, update notice
│   ├── cli.rs                 # clap CLI definition
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── nuke.rs
│   │   ├── setup.rs
│   │   ├── update.rs
│   │   └── git/
│   │       ├── mod.rs
│   │       ├── amend.rs
│   │       ├── deploy.rs
│   │       ├── prune.rs
│   │       ├── rebase.rs
│   │       ├── start.rs
│   │       ├── sync.rs
│   │       └── worktree.rs
│   │   └── project/
│   │       ├── mod.rs
│   │       ├── new.rs
│   │       └── add.rs
│   └── utils/
│       ├── mod.rs
│       ├── git.rs             # getDefaultBranch, getCurrentBranch, ensureNotOnDefault
│       ├── errors.rs          # ShellError wrapper
│       └── update.rs          # GitHub release API, version check, binary download
```

## Architecture

Every command is a standalone public function returning `Result<()>`:

```
cli.rs: clap parses args → dispatches to command fn → command fn returns Result<()>
```

**Shell-out pattern** (git, project, setup commands):
- `Shell` trait wrapping `std::process::Command`, injectable for testing
- Same pattern as current TypeScript `shell` parameter

**Native pattern** (nuke):
- Use `std::process::Command` for `lsof`/`pgrep` on macOS (no native pid API needed — piping existing tools is simpler and cross-platform)

**Interactive prompts** (dialoguer):
- Commands accept an injectable prompt trait to allow test mocking
- `--force` flags bypass prompts (same as current behavior)

**Update check**:
- Synchronous `ureq` GET to GitHub releases API
- Parse JSON with serde, compare with semver
- Print dimmed notice to stderr after command output (same UX as current)
- Skip for `update`, `--version`, `--help`

## CI / Release

GitHub Actions matrix with three targets:

| Target triple | Binary name |
|---|---|
| `x86_64-apple-darwin` | `scli-macos-x64` |
| `aarch64-apple-darwin` | `scli-macos-arm64` |
| `x86_64-unknown-linux-musl` | `scli-linux-x64` |

Linux uses `musl` target for fully static binaries. macOS binaries are statically linked by default.

## Testing

- `cargo test` with injectable `Shell` trait for all shell-out commands
- Mock `dialoguer` prompts via trait for interactive commands
- Pure function unit tests for parsing logic (branch list, pgrep output, semver comparisons)
- No integration tests that run actual git/nuke/setup operations

## Commands (unchanged from current)

See `README.md` for full command reference. All flags, arguments, and behavior preserved verbatim.
