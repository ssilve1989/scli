import { describe, expect, test } from "bun:test";
import { performRebase } from "../../src/commands/git/rebase";

type ShellResult = {
	quiet: () => ShellResult;
	nothrow: () => ShellResult;
	text: () => Promise<string>;
};

function makeShell(
	responses: { text?: string; throws?: boolean; stderr?: string }[],
) {
	let i = 0;
	return (_strings: TemplateStringsArray, ..._values: unknown[]) => {
		const resp = responses[i++];
		if (resp?.throws) {
			const err = Object.assign(new Error(resp.stderr ?? "shell error"), {
				stderr: resp.stderr ? Buffer.from(resp.stderr) : undefined,
			});
			throw err;
		}
		const result: ShellResult = {
			quiet: () => result,
			nothrow: () => result,
			text: async () => resp?.text ?? "",
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

// ensureNotOnDefaultBranch calls getCurrentBranch and getDefaultBranch in parallel:
//   getCurrentBranch: git rev-parse --abbrev-ref HEAD
//   getDefaultBranch: git symbolic-ref refs/remotes/origin/HEAD
// Then performRebase calls: git fetch, git rebase, (git push)
// Total calls for success without push: 4
// Total calls for success with push: 5

describe("performRebase", () => {
	test("resolves successfully without push", async () => {
		const shell = makeShell([
			{ text: "feature-x\n" }, // getCurrentBranch
			{ text: "refs/remotes/origin/main\n" }, // getDefaultBranch
			{ text: "" }, // git fetch
			{ text: "" }, // git rebase
		]);
		await performRebase(shell as typeof Bun.$, { push: false });
	});

	test("resolves successfully with push", async () => {
		const shell = makeShell([
			{ text: "feature-x\n" },
			{ text: "refs/remotes/origin/main\n" },
			{ text: "" },
			{ text: "" },
			{ text: "" }, // git push
		]);
		await performRebase(shell as typeof Bun.$, { push: true });
	});

	test("rejects when fetch fails", async () => {
		const shell = makeShell([
			{ text: "feature-x\n" },
			{ text: "refs/remotes/origin/main\n" },
			{ throws: true, stderr: "fatal: unable to reach origin" },
		]);
		await rejectsWithMessage(
			performRebase(shell as typeof Bun.$, { push: false }),
			"fatal: unable to reach origin",
		);
	});

	test("rejects when rebase has a conflict", async () => {
		const shell = makeShell([
			{ text: "feature-x\n" },
			{ text: "refs/remotes/origin/main\n" },
			{ text: "" },
			{
				throws: true,
				stderr: "CONFLICT (content): Merge conflict in src/foo.ts",
			},
		]);
		let caught: unknown;
		try {
			await performRebase(shell as typeof Bun.$, { push: false });
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(Error);
		const err = caught as { message?: string; stderr?: Buffer };
		const stderrText = err.stderr?.toString() ?? err.message ?? "";
		expect(stderrText).toContain("CONFLICT");
	});

	test("rejects with stderr text on non-conflict failure", async () => {
		const shell = makeShell([
			{ text: "feature-x\n" },
			{ text: "refs/remotes/origin/main\n" },
			{ text: "" },
			{ throws: true, stderr: "error: your index file is unmerged" },
		]);
		await rejectsWithMessage(
			performRebase(shell as typeof Bun.$, { push: false }),
			"error: your index file is unmerged",
		);
	});

	test("rejects when push fails", async () => {
		const shell = makeShell([
			{ text: "feature-x\n" },
			{ text: "refs/remotes/origin/main\n" },
			{ text: "" },
			{ text: "" },
			{ throws: true, stderr: "error: failed to push some refs" },
		]);
		await rejectsWithMessage(
			performRebase(shell as typeof Bun.$, { push: true }),
			"error: failed to push some refs",
		);
	});

	test("rejects when on the default branch", async () => {
		const shell = makeShell([
			{ text: "main\n" },
			{ text: "refs/remotes/origin/main\n" },
		]);
		await rejectsWithMessage(
			performRebase(shell as typeof Bun.$, { push: false }),
			"Already on default branch (main)",
		);
	});
});
