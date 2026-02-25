import { describe, expect, test } from "bun:test";
import type { ProjectConfig } from "../../src/commands/project/new";
import {
	generateBiomeJson,
	generateCiYml,
	generateCommitlintRc,
	generateEntryPoint,
	generateLefthookYml,
	generateMiseToml,
	generatePackageJson,
	generatePnpmWorkspace,
	generateReleaseRc,
	generateReleaseYml,
	generateTsConfig,
} from "../../src/commands/project/new";

const bunConfig: ProjectConfig = {
	name: "my-app",
	pm: "bun",
	runtime: "bun",
	workspaces: false,
};

const pnpmNodeConfig: ProjectConfig = {
	name: "my-app",
	pm: "pnpm",
	runtime: "node",
	workspaces: false,
};

const pnpmBunConfig: ProjectConfig = {
	name: "my-app",
	pm: "pnpm",
	runtime: "bun",
	workspaces: false,
};

const bunWorkspacesConfig: ProjectConfig = {
	...bunConfig,
	workspaces: true,
};

const pnpmWorkspacesConfig: ProjectConfig = {
	...pnpmNodeConfig,
	workspaces: true,
};

describe("generateMiseToml", () => {
	test("bun runtime includes bun tool", () => {
		const result = generateMiseToml(bunConfig);
		expect(result).toContain('bun = "latest"');
		expect(result).not.toContain("node");
	});

	test("node runtime includes node tool", () => {
		const result = generateMiseToml(pnpmNodeConfig);
		expect(result).toContain('node = "lts"');
		expect(result).not.toContain("bun =");
	});

	test("pnpm pm adds pnpm tool", () => {
		const result = generateMiseToml(pnpmNodeConfig);
		expect(result).toContain('pnpm = "latest"');
	});

	test("bun pm does not add pnpm tool", () => {
		const result = generateMiseToml(bunConfig);
		expect(result).not.toContain("pnpm");
	});

	test("docker is always included", () => {
		expect(generateMiseToml(bunConfig)).toContain('docker = "latest"');
		expect(generateMiseToml(pnpmNodeConfig)).toContain('docker = "latest"');
	});

	test("pnpm+bun runtime includes both bun and pnpm", () => {
		const result = generateMiseToml(pnpmBunConfig);
		expect(result).toContain('bun = "latest"');
		expect(result).toContain('pnpm = "latest"');
	});
});

describe("generatePackageJson", () => {
	test("bun pm uses bun test script", () => {
		const pkg = JSON.parse(generatePackageJson(bunConfig));
		expect(pkg.scripts.test).toBe("bun test");
	});

	test("pnpm pm uses pnpm test script", () => {
		const pkg = JSON.parse(generatePackageJson(pnpmNodeConfig));
		expect(pkg.scripts.test).toBe("pnpm test");
	});

	test("bun pm has @types/bun dev dependency", () => {
		const pkg = JSON.parse(generatePackageJson(bunConfig));
		expect(pkg.devDependencies["@types/bun"]).toBeDefined();
		expect(pkg.devDependencies["@types/node"]).toBeUndefined();
	});

	test("node runtime has @types/node dev dependency", () => {
		const pkg = JSON.parse(generatePackageJson(pnpmNodeConfig));
		expect(pkg.devDependencies["@types/node"]).toBeDefined();
		expect(pkg.devDependencies["@types/bun"]).toBeUndefined();
	});

	test("always includes biome, commitlint, lefthook, typescript", () => {
		for (const config of [bunConfig, pnpmNodeConfig]) {
			const pkg = JSON.parse(generatePackageJson(config));
			expect(pkg.devDependencies["@biomejs/biome"]).toBeDefined();
			expect(pkg.devDependencies["@commitlint/cli"]).toBeDefined();
			expect(pkg.devDependencies.lefthook).toBeDefined();
			expect(pkg.devDependencies.typescript).toBeDefined();
		}
	});

	test("bun workspaces adds workspaces field", () => {
		const pkg = JSON.parse(generatePackageJson(bunWorkspacesConfig));
		expect(pkg.workspaces).toEqual(["packages/*"]);
	});

	test("no workspaces field when disabled", () => {
		const pkg = JSON.parse(generatePackageJson(bunConfig));
		expect(pkg.workspaces).toBeUndefined();
	});

	test("project name is set", () => {
		const pkg = JSON.parse(generatePackageJson(bunConfig));
		expect(pkg.name).toBe("my-app");
	});

	test("prepare script uses correct package manager", () => {
		const bunPkg = JSON.parse(generatePackageJson(bunConfig));
		expect(bunPkg.scripts.prepare).toContain("bun lefthook install");

		const pnpmPkg = JSON.parse(generatePackageJson(pnpmNodeConfig));
		expect(pnpmPkg.scripts.prepare).toContain("pnpm lefthook install");
	});
});

describe("generateCiYml", () => {
	test("bun runtime uses setup-bun action", () => {
		const result = generateCiYml(bunConfig);
		expect(result).toContain("oven-sh/setup-bun@v2");
		expect(result).not.toContain("actions/setup-node");
	});

	test("node runtime uses setup-node action", () => {
		const result = generateCiYml(pnpmNodeConfig);
		expect(result).toContain("actions/setup-node@v4");
		expect(result).not.toContain("oven-sh/setup-bun");
	});

	test("bun pm uses bun install", () => {
		const result = generateCiYml(bunConfig);
		expect(result).toContain("bun install");
	});

	test("pnpm pm uses pnpm install", () => {
		const result = generateCiYml(pnpmNodeConfig);
		expect(result).toContain("pnpm install");
	});

	test("bun pm uses bunx commitlint", () => {
		const result = generateCiYml(bunConfig);
		expect(result).toContain("bunx --bun commitlint");
	});

	test("pnpm pm uses pnpm dlx commitlint", () => {
		const result = generateCiYml(pnpmNodeConfig);
		expect(result).toContain("pnpm dlx commitlint");
	});
});

describe("generateReleaseYml", () => {
	test("bun runtime uses setup-bun action", () => {
		const result = generateReleaseYml(bunConfig);
		expect(result).toContain("oven-sh/setup-bun@v2");
	});

	test("node runtime uses setup-node action", () => {
		const result = generateReleaseYml(pnpmNodeConfig);
		expect(result).toContain("actions/setup-node@v4");
	});

	test("uses semantic-release action", () => {
		const result = generateReleaseYml(bunConfig);
		expect(result).toContain("cycjimmy/semantic-release-action");
	});
});

describe("generateLefthookYml", () => {
	test("bun pm uses bunx --bun", () => {
		const result = generateLefthookYml(bunConfig);
		expect(result).toContain("bunx --bun biome");
		expect(result).toContain("bunx --bun commitlint");
	});

	test("pnpm pm uses pnpm dlx", () => {
		const result = generateLefthookYml(pnpmNodeConfig);
		expect(result).toContain("pnpm dlx biome");
		expect(result).toContain("pnpm dlx commitlint");
	});
});

describe("generateCommitlintRc", () => {
	test("extends conventional commits config", () => {
		const result = JSON.parse(generateCommitlintRc());
		expect(result.extends).toContain("@commitlint/config-conventional");
	});
});

describe("generateReleaseRc", () => {
	test("includes semantic-release plugins", () => {
		const result = JSON.parse(generateReleaseRc());
		expect(result.plugins).toContain("@semantic-release/commit-analyzer");
		expect(result.plugins).toContain("@semantic-release/changelog");
	});

	test("targets master and main branches", () => {
		const result = JSON.parse(generateReleaseRc());
		expect(result.branches).toContain("master");
		expect(result.branches).toContain("main");
	});
});

describe("generateTsConfig", () => {
	test("produces valid JSON", () => {
		expect(() => JSON.parse(generateTsConfig())).not.toThrow();
	});

	test("enables strict mode", () => {
		const result = JSON.parse(generateTsConfig());
		expect(result.compilerOptions.strict).toBe(true);
	});
});

describe("generateBiomeJson", () => {
	test("produces valid JSON", () => {
		expect(() => JSON.parse(generateBiomeJson())).not.toThrow();
	});

	test("uses tab indent style", () => {
		const result = JSON.parse(generateBiomeJson());
		expect(result.formatter.indentStyle).toBe("tab");
	});
});

describe("generatePnpmWorkspace", () => {
	test("includes packages glob", () => {
		const result = generatePnpmWorkspace();
		expect(result).toContain("packages/*");
	});
});

describe("generateEntryPoint", () => {
	test("bun runtime references bun run command", () => {
		const result = generateEntryPoint(bunConfig);
		expect(result).toContain("bun");
	});

	test("node runtime references node run command", () => {
		const result = generateEntryPoint(pnpmNodeConfig);
		expect(result).toContain("node");
	});
});

describe("pnpm workspaces", () => {
	test("pnpm workspace config does not add workspaces to package.json", () => {
		const pkg = JSON.parse(generatePackageJson(pnpmWorkspacesConfig));
		// pnpm uses pnpm-workspace.yaml, not package.json workspaces
		expect(pkg.workspaces).toBeUndefined();
	});
});
