# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0](https://github.com/ssilve1989/scli/releases/tag/v0.7.0) - 2026-05-31

### Added

- rewrite CLI in Rust ([#13](https://github.com/ssilve1989/scli/pull/13))
- *(lefthook)* add install-hooks.js script to guard against non-git envs
- *(project)* add renovate github actions workflow to renovate feature
- *(project)* add renovate as a selectable feature in project add
- *(git)* add worktree subcommand
- *(project)* add `project add <feature>` subcommand
- *(project)* use mise for CI tool management in scaffold
- *(update)* display rendered release notes on update
- *(project)* add new command to scaffold TypeScript projects ([#4](https://github.com/ssilve1989/scli/pull/4))
- add self-update command and background update notifications
- *(cli)* add scli setup command for machine bootstrapping
- *(cli)* Add git workflow and process management commands

### Fixed

- use linux-gnu target instead of musl in release build
- *(project)* generate commitlintrc and install packages when adding lefthook
- *(project)* add @semantic-release/npm with npmPublish disabled to releaserc
- *(types)* replace @types/marked-terminal with correct local declaration
- *(git)* surface shell stderr in error messages
- *(rebase)* fixes rebase command

### Other

- *(deps)* bump time in the cargo group across 1 directory
- add AGENTS.md and document release-plz repo setting requirement
- *(deps-dev)* bump @commitlint/config-conventional
- *(deps)* update deps
- *(deps)* bump marked from 17.0.6 to 18.0.0
- *(deps)* bump dependencies to latest versions
- *(release)* 0.6.1 [skip ci]
- *(deps)* bump marked from 15.0.12 to 17.0.5
- *(release)* 0.6.0 [skip ci]
- *(release)* 0.5.0 [skip ci]
- *(release)* 0.4.1 [skip ci]
- add project and update commands to README
- *(release)* 0.4.0 [skip ci]
- fix linting errors
- *(release)* 0.3.0 [skip ci]
- *(release)* 0.2.1 [skip ci]
- update readme
- *(release)* 0.2.0 [skip ci]
- enable performance rules
- add lefthook pre-commit and commit-msg hooks ([#3](https://github.com/ssilve1989/scli/pull/3))
- *(release)* 0.1.1 [skip ci]
- *(release)* 0.1.0 [skip ci]
- update lockfile
- update readme
- *(release)* 0.0.1 [skip ci]
- formatting
- add workflow_dispatch trigger to release workflow
- add semantic-release with bun binary distribution
- add gha setup
- add test coverage
- add dependabot
- add biomejs
- Update README with install script and bump Bun to v1.3.9
- initial commit
## [0.6.1](https://github.com/ssilve1989/scli/compare/v0.6.0...v0.6.1) (2026-04-12)

### Bug Fixes

* **project:** generate commitlintrc and install packages when adding lefthook ([9afd622](https://github.com/ssilve1989/scli/commit/9afd6222c0adc1731ba7b61c40c39d337df72f2f))

## [0.6.0](https://github.com/ssilve1989/scli/compare/v0.5.0...v0.6.0) (2026-03-23)

### Features

* **lefthook:** add install-hooks.js script to guard against non-git envs ([7ee1d07](https://github.com/ssilve1989/scli/commit/7ee1d07b7535f26a280633db890bad254404d0c4))
* **project:** add renovate as a selectable feature in project add ([c3bf563](https://github.com/ssilve1989/scli/commit/c3bf56327daeb87470541e0508d4a92378fae0ba))
* **project:** add renovate github actions workflow to renovate feature ([97127b9](https://github.com/ssilve1989/scli/commit/97127b9cf9357de3c8d6f94e6cc57bf5fb9b0015))

## [0.5.0](https://github.com/ssilve1989/scli/compare/v0.4.1...v0.5.0) (2026-03-17)

### Features

* **git:** add worktree subcommand ([3d19d74](https://github.com/ssilve1989/scli/commit/3d19d7422d349c89f0ab0aa4006a46255f070317))

## [0.4.1](https://github.com/ssilve1989/scli/compare/v0.4.0...v0.4.1) (2026-03-17)

### Bug Fixes

* **project:** add @semantic-release/npm with npmPublish disabled to releaserc ([d61a64a](https://github.com/ssilve1989/scli/commit/d61a64ab46c9807326347a8217ace2dd8ffe29d7))

## [0.4.0](https://github.com/ssilve1989/scli/compare/v0.3.0...v0.4.0) (2026-03-14)

### Features

* **project:** add `project add <feature>` subcommand ([45d4ebb](https://github.com/ssilve1989/scli/commit/45d4ebb365569440772a43e62bba463cb15c311b))
* **project:** use mise for CI tool management in scaffold ([80122d0](https://github.com/ssilve1989/scli/commit/80122d077f66ed9bc5926ab84a3fdd432031bf88))

### Bug Fixes

* **types:** replace @types/marked-terminal with correct local declaration ([b0318d0](https://github.com/ssilve1989/scli/commit/b0318d0876bb953a2300891f189ba82ca6f92544))

## [0.3.0](https://github.com/ssilve1989/personal-cli/compare/v0.2.1...v0.3.0) (2026-03-07)

### Features

* **update:** display rendered release notes on update ([3e8de93](https://github.com/ssilve1989/personal-cli/commit/3e8de935155a0314d86853c9b9a519a16cc4256f))

## [0.2.1](https://github.com/ssilve1989/personal-cli/compare/v0.2.0...v0.2.1) (2026-03-06)

### Bug Fixes

* **git:** surface shell stderr in error messages ([632bb28](https://github.com/ssilve1989/personal-cli/commit/632bb288fe27071865c0f84b9f0776b832944c77))

## [0.2.0](https://github.com/ssilve1989/personal-cli/compare/v0.1.1...v0.2.0) (2026-02-25)

### Features

* **project:** add new command to scaffold TypeScript projects ([#4](https://github.com/ssilve1989/personal-cli/issues/4)) ([b4e2ff4](https://github.com/ssilve1989/personal-cli/commit/b4e2ff40a962d1e9482790e98255b9cdb650db17))

## [0.1.1](https://github.com/ssilve1989/personal-cli/compare/v0.1.0...v0.1.1) (2026-02-25)

### Bug Fixes

* **rebase:** fixes rebase command ([ee703ef](https://github.com/ssilve1989/personal-cli/commit/ee703ef318a32f163aa8d994a137cf2acc2a31e4))

## [0.1.0](https://github.com/ssilve1989/personal-cli/compare/v0.0.1...v0.1.0) (2026-02-25)

### Features

* add self-update command and background update notifications ([10a0ce0](https://github.com/ssilve1989/personal-cli/commit/10a0ce0118acf3e078a6ecf7ebb7a37353435239))

## [0.0.1](https://github.com/ssilve1989/personal-cli/compare/v0.0.0...v0.0.1) (2026-02-25)

### Bug Fixes

* initial release ([79451bb](https://github.com/ssilve1989/personal-cli/commit/79451bbca5a3665ff3b7c5a611d9845829b05d25))
