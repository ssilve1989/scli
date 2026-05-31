use anyhow::Result;
use dialoguer::{Confirm, Select, theme::ColorfulTheme};
use std::path::Path;

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
