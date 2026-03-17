import { describe, expect, test } from "bun:test";
import { createWorktree } from "../../src/commands/git/worktree";

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

// createWorktree shell call order:
//   1. git rev-parse --show-toplevel
//   2. git fetch origin <base>
//   3. git worktree add -b <name> <path> origin/<base>

describe("createWorktree", () => {
	test("resolves with correct worktreePath", async () => {
		const shell = makeShell([
			{ text: "/home/user/my-repo\n" }, // git rev-parse
			{ text: "" }, // git fetch
			{ text: "" }, // git worktree add
		]);
		const result = await createWorktree(shell as typeof Bun.$, "my-feature", {
			base: "master",
		});
		expect(result.worktreePath).toBe("/home/user/my-feature");
	});

	test("uses custom base branch", async () => {
		const shell = makeShell([
			{ text: "/home/user/my-repo\n" },
			{ text: "" },
			{ text: "" },
		]);
		const result = await createWorktree(shell as typeof Bun.$, "my-feature", {
			base: "main",
		});
		expect(result.worktreePath).toBe("/home/user/my-feature");
	});

	test("rejects when fetch fails", async () => {
		const shell = makeShell([
			{ text: "/home/user/my-repo\n" },
			{ throws: true, stderr: "fatal: unable to reach origin" },
		]);
		await rejectsWithMessage(
			createWorktree(shell as typeof Bun.$, "my-feature", { base: "master" }),
			"fatal: unable to reach origin",
		);
	});

	test("rejects when worktree add fails", async () => {
		const shell = makeShell([
			{ text: "/home/user/my-repo\n" },
			{ text: "" },
			{ throws: true, stderr: "fatal: 'my-feature' already exists" },
		]);
		await rejectsWithMessage(
			createWorktree(shell as typeof Bun.$, "my-feature", { base: "master" }),
			"fatal: 'my-feature' already exists",
		);
	});
});
