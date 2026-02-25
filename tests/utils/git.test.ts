import { describe, expect, test } from "bun:test";
import {
	ensureNotOnDefaultBranch,
	getCurrentBranch,
	getDefaultBranch,
} from "../../src/utils/git";

type ShellResult = {
	quiet: () => ShellResult;
	nothrow: () => ShellResult;
	text: () => Promise<string>;
};

function makeShell(responses: { text: string; throws?: boolean }[]) {
	let i = 0;
	return (_strings: TemplateStringsArray, ..._values: unknown[]) => {
		const resp = responses[i++];
		if (!resp || resp.throws) throw new Error("shell error");
		const result: ShellResult = {
			quiet: () => result,
			nothrow: () => result,
			text: async () => resp.text,
		};
		return result as unknown as ReturnType<typeof Bun.$>;
	};
}

async function rejectsWithMessage(
	promise: Promise<unknown>,
	expectedMessage: string,
): Promise<void> {
	let caught: Error | undefined;
	try {
		await promise;
	} catch (e) {
		if (e instanceof Error) caught = e;
	}
	expect(caught).toBeInstanceOf(Error);
	expect(caught?.message).toContain(expectedMessage);
}

describe("getDefaultBranch", () => {
	test("returns branch from symbolic-ref output", async () => {
		const shell = makeShell([{ text: "refs/remotes/origin/main\n" }]);
		const branch = await getDefaultBranch(shell as typeof Bun.$);
		expect(branch).toBe("main");
	});

	test("falls back to branch list and finds main when symbolic-ref throws", async () => {
		const shell = makeShell([
			{ throws: true, text: "" },
			{ text: "  main\n* feature-x\n" },
		]);
		const branch = await getDefaultBranch(shell as typeof Bun.$);
		expect(branch).toBe("main");
	});

	test("falls back to branch list and finds master when symbolic-ref throws", async () => {
		const shell = makeShell([
			{ throws: true, text: "" },
			{ text: "  master\n* feature-x\n" },
		]);
		const branch = await getDefaultBranch(shell as typeof Bun.$);
		expect(branch).toBe("master");
	});

	test("throws when fallback has neither main nor master", async () => {
		const shell = makeShell([
			{ throws: true, text: "" },
			{ text: "  develop\n* feature-x\n" },
		]);
		await rejectsWithMessage(
			getDefaultBranch(shell as typeof Bun.$),
			"Could not determine default branch",
		);
	});
});

describe("getCurrentBranch", () => {
	test("returns trimmed branch name", async () => {
		const shell = makeShell([{ text: "feature-x\n" }]);
		const branch = await getCurrentBranch(shell as typeof Bun.$);
		expect(branch).toBe("feature-x");
	});

	test("throws when output is HEAD (detached state)", async () => {
		const shell = makeShell([{ text: "HEAD\n" }]);
		await rejectsWithMessage(
			getCurrentBranch(shell as typeof Bun.$),
			"Detached HEAD state",
		);
	});
});

describe("ensureNotOnDefaultBranch", () => {
	test("returns currentBranch and defaultBranch when on a feature branch", async () => {
		const shell = makeShell([
			{ text: "feature-x\n" },
			{ text: "refs/remotes/origin/main\n" },
		]);
		const result = await ensureNotOnDefaultBranch(shell as typeof Bun.$);
		expect(result.currentBranch).toBe("feature-x");
		expect(result.defaultBranch).toBe("main");
	});

	test("throws when current branch equals default branch (main)", async () => {
		const shell = makeShell([
			{ text: "main\n" },
			{ text: "refs/remotes/origin/main\n" },
		]);
		await rejectsWithMessage(
			ensureNotOnDefaultBranch(shell as typeof Bun.$),
			"Already on default branch (main)",
		);
	});

	test("throws when current branch equals default branch (master)", async () => {
		const shell = makeShell([
			{ text: "master\n" },
			{ text: "refs/remotes/origin/master\n" },
		]);
		await rejectsWithMessage(
			ensureNotOnDefaultBranch(shell as typeof Bun.$),
			"Already on default branch (master)",
		);
	});

	test("error message includes the branch name", async () => {
		const shell = makeShell([
			{ text: "main\n" },
			{ text: "refs/remotes/origin/main\n" },
		]);
		await rejectsWithMessage(
			ensureNotOnDefaultBranch(shell as typeof Bun.$),
			"(main)",
		);
	});
});
