# scli — Agent instructions

## Git workflow

- Never commit or push directly to `master`. Always work on a feature branch and open a PR.
- Use conventional commit format (`type(scope): description`).

## Rust tooling

- Use `cargo build`, `cargo test`, `cargo fmt`, `cargo clippy -- -D warnings`.
- Git hooks in `.githooks/` enforce pre-commit checks. Enable with `mise run setup`.
- Use `mise run test|format|lint|build` for mise-managed tasks.

## CI / Release

- CI runs on PRs: `cargo build`, `cargo test`, `cargo clippy -- -D warnings`.
