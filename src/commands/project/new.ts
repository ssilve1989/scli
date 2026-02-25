import { mkdirSync } from "node:fs";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import { Command } from "commander";

export type ProjectConfig = {
	name: string;
	pm: "bun" | "pnpm";
	runtime: "bun" | "node";
	workspaces: boolean;
};

export function generateMiseToml(config: ProjectConfig): string {
	const tools: string[] = [];

	if (config.runtime === "bun") {
		tools.push('bun = "latest"');
	} else {
		tools.push('node = "lts"');
	}

	if (config.pm === "pnpm") {
		tools.push('pnpm = "latest"');
	}

	tools.push('docker = "latest"');

	return `[tools]\n${tools.join("\n")}\n`;
}

export function generatePackageJson(config: ProjectConfig): string {
	const runCmd = config.pm === "bun" ? "bun" : "pnpm";
	const testCmd = config.pm === "bun" ? "bun test" : "pnpm test";

	const scripts: Record<string, string> = {
		"lint:ci": "biome ci --diagnostic-level=error",
		test: testCmd,
		prepare: `${runCmd} lefthook install`,
	};

	const devDependencies: Record<string, string> = {
		"@biomejs/biome": "latest",
		"@commitlint/cli": "latest",
		"@commitlint/config-conventional": "latest",
		"@semantic-release/changelog": "latest",
		"@semantic-release/git": "latest",
		"conventional-changelog-conventionalcommits": "latest",
		lefthook: "latest",
		typescript: "latest",
	};

	if (config.runtime === "bun") {
		devDependencies["@types/bun"] = "latest";
	} else {
		devDependencies["@types/node"] = "latest";
	}

	const pkg: Record<string, unknown> = {
		name: config.name,
		version: "0.0.0",
		private: true,
		type: "module",
		scripts,
		devDependencies,
	};

	if (config.workspaces && config.pm === "bun") {
		pkg.workspaces = ["packages/*"];
	}

	return `${JSON.stringify(pkg, null, "\t")}\n`;
}

export function generateTsConfig(): string {
	return `{
\t"compilerOptions": {
\t\t"lib": ["ESNext"],
\t\t"target": "ESNext",
\t\t"module": "Preserve",
\t\t"moduleDetection": "force",
\t\t"allowJs": true,
\t\t"moduleResolution": "bundler",
\t\t"allowImportingTsExtensions": true,
\t\t"verbatimModuleSyntax": true,
\t\t"noEmit": true,
\t\t"strict": true,
\t\t"skipLibCheck": true,
\t\t"noFallthroughCasesInSwitch": true,
\t\t"noUncheckedIndexedAccess": true,
\t\t"noImplicitOverride": true
\t}
}
`;
}

export function generateBiomeJson(): string {
	return `{
\t"$schema": "https://biomejs.dev/schemas/2.4.4/schema.json",
\t"vcs": {
\t\t"enabled": true,
\t\t"clientKind": "git",
\t\t"useIgnoreFile": true
\t},
\t"files": {
\t\t"includes": ["**", "!!**/dist", "!!**/node_modules"]
\t},
\t"formatter": {
\t\t"enabled": true,
\t\t"indentStyle": "tab"
\t},
\t"linter": {
\t\t"enabled": true,
\t\t"rules": {
\t\t\t"recommended": true
\t\t}
\t},
\t"javascript": {
\t\t"formatter": {
\t\t\t"quoteStyle": "double"
\t\t}
\t},
\t"assist": {
\t\t"enabled": true,
\t\t"actions": {
\t\t\t"source": {
\t\t\t\t"organizeImports": "on"
\t\t\t}
\t\t}
\t}
}
`;
}

export function generateLefthookYml(config: ProjectConfig): string {
	const dlxCmd = config.pm === "bun" ? "bunx --bun" : "pnpm dlx";
	return `pre-commit:
  commands:
    biome:
      glob: "*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc}"
      run: ${dlxCmd} biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true

commit-msg:
  commands:
    commitlint:
      run: ${dlxCmd} commitlint --edit {1}
`;
}

export function generateGitignore(): string {
	return `node_modules/
dist/
.env
.env.local
`;
}

export function generateCommitlintRc(): string {
	return `${JSON.stringify({ extends: ["@commitlint/config-conventional"] }, null, "\t")}\n`;
}

export function generateReleaseRc(): string {
	const releaserc = {
		branches: ["master", "main"],
		plugins: [
			"@semantic-release/commit-analyzer",
			"@semantic-release/release-notes-generator",
			"@semantic-release/changelog",
			[
				"@semantic-release/git",
				{
					assets: ["CHANGELOG.md", "package.json"],
					message:
						"chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
				},
			],
			"@semantic-release/github",
		],
	};
	return `${JSON.stringify(releaserc, null, "\t")}\n`;
}

export function generateCiYml(config: ProjectConfig): string {
	const setupStep =
		config.runtime === "bun"
			? "      - uses: oven-sh/setup-bun@v2"
			: `      - uses: actions/setup-node@v4
        with:
          node-version: lts/*`;

	const installCmd = config.pm === "bun" ? "bun install" : "pnpm install";
	const lintCmd = config.pm === "bun" ? "bun run lint:ci" : "pnpm run lint:ci";
	const testCmd = config.pm === "bun" ? "bun test" : "pnpm test";
	const commitlintCmd =
		config.pm === "bun" ? "bunx --bun commitlint" : "pnpm dlx commitlint";

	return `name: CI

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

${setupStep}

      - run: ${installCmd}

      - name: Validate commit messages
        run: |
          if [ "\${{ github.event_name }}" = "pull_request" ]; then
            ${commitlintCmd} --from \${{ github.event.pull_request.base.sha }} --to \${{ github.event.pull_request.head.sha }} --verbose
          else
            ${commitlintCmd} --from HEAD~1 --to HEAD --verbose
          fi

      - run: ${lintCmd}

      - run: ${testCmd}
`;
}

export function generateReleaseYml(config: ProjectConfig): string {
	const setupStep =
		config.runtime === "bun"
			? "      - uses: oven-sh/setup-bun@v2"
			: `      - uses: actions/setup-node@v4
        with:
          node-version: lts/*`;

	const installCmd = config.pm === "bun" ? "bun install" : "pnpm install";
	const lintCmd = config.pm === "bun" ? "bun run lint:ci" : "pnpm run lint:ci";
	const testCmd = config.pm === "bun" ? "bun test" : "pnpm test";

	return `name: Release

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

${setupStep}

      - run: ${installCmd}

      - run: ${lintCmd}

      - run: ${testCmd}

      - uses: cycjimmy/semantic-release-action@v4
        with:
          extra_plugins: |
            @semantic-release/changelog
            @semantic-release/git
            conventional-changelog-conventionalcommits
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;
}

export function generatePnpmWorkspace(): string {
	return `packages:\n  - "packages/*"\n`;
}

export function generateEntryPoint(config: ProjectConfig): string {
	const comment =
		config.runtime === "bun"
			? "// Entry point — run with: bun src/index.ts"
			: "// Entry point — run with: node --experimental-strip-types src/index.ts";
	return `${comment}\nconsole.log("Hello, world!");\n`;
}

export const newProject = new Command("new")
	.description("Scaffold a new TypeScript project")
	.argument("<name>", "Name for the new project (used as directory name)")
	.action(async (name: string) => {
		prompts.intro("project new");

		const pm = await prompts.select({
			message: "Package manager",
			options: [
				{ value: "bun", label: "Bun" },
				{ value: "pnpm", label: "pnpm" },
			],
		});

		if (prompts.isCancel(pm)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		const runtime = await prompts.select({
			message: "Runtime",
			options: [
				{ value: "bun", label: "Bun" },
				{ value: "node", label: "NodeJS" },
			],
		});

		if (prompts.isCancel(runtime)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		const workspaces = await prompts.confirm({
			message: "Enable workspaces?",
			initialValue: false,
		});

		if (prompts.isCancel(workspaces)) {
			prompts.cancel("Cancelled.");
			process.exit(0);
		}

		const config: ProjectConfig = {
			name,
			pm: pm as "bun" | "pnpm",
			runtime: runtime as "bun" | "node",
			workspaces,
		};

		const s = prompts.spinner();
		s.start(`Scaffolding ${name}...`);

		try {
			const root = join(process.cwd(), name);

			// Create directory structure
			mkdirSync(join(root, "src"), { recursive: true });
			mkdirSync(join(root, ".github", "workflows"), { recursive: true });
			if (config.workspaces) {
				mkdirSync(join(root, "packages"), { recursive: true });
			}

			// Write all files
			await Promise.all([
				Bun.write(join(root, "mise.toml"), generateMiseToml(config)),
				Bun.write(join(root, "package.json"), generatePackageJson(config)),
				Bun.write(join(root, "tsconfig.json"), generateTsConfig()),
				Bun.write(join(root, "biome.json"), generateBiomeJson()),
				Bun.write(join(root, ".gitignore"), generateGitignore()),
				Bun.write(join(root, "lefthook.yml"), generateLefthookYml(config)),
				Bun.write(join(root, ".commitlintrc.json"), generateCommitlintRc()),
				Bun.write(join(root, ".releaserc.json"), generateReleaseRc()),
				Bun.write(
					join(root, ".github", "workflows", "ci.yml"),
					generateCiYml(config),
				),
				Bun.write(
					join(root, ".github", "workflows", "release.yml"),
					generateReleaseYml(config),
				),
				Bun.write(join(root, "src", "index.ts"), generateEntryPoint(config)),
				...(config.workspaces && config.pm === "pnpm"
					? [
							Bun.write(
								join(root, "pnpm-workspace.yaml"),
								generatePnpmWorkspace(),
							),
						]
					: []),
			]);

			s.message("Initialising git repository...");

			await Bun.$`git init`.cwd(root).quiet();

			s.message("Installing dependencies...");

			if (config.pm === "bun") {
				await Bun.$`bun install`.cwd(root).quiet();
			} else {
				await Bun.$`pnpm install`.cwd(root).quiet();
			}

			s.message("Creating initial commit...");

			await Bun.$`git add -A`.cwd(root).quiet();
			await Bun.$`git commit -m "chore: initial commit"`.cwd(root).quiet();

			s.stop("Done!");
		} catch (e: unknown) {
			const err = e as { message?: string; stderr?: { toString(): string } };
			s.stop("Failed");
			prompts.log.error(
				err.stderr?.toString().trim() || err.message || "Unknown error",
			);
			process.exit(1);
		}

		prompts.outro(`Project created! cd ${name} to get started.`);
	});
