import path from "node:path";
import { intro, log, outro, spinner } from "@clack/prompts";
import { Command } from "commander";
import { getShellError } from "../../utils/errors";

type Shell = typeof Bun.$;

export async function createWorktree(
	shell: Shell,
	name: string,
	opts: { base: string },
): Promise<{ worktreePath: string }> {
	const repoRoot = await shell`git rev-parse --show-toplevel`.quiet().text();
	const worktreePath = path.join(path.dirname(repoRoot.trim()), name);
	await shell`git fetch origin ${opts.base}`.quiet();
	await shell`git worktree add -b ${name} ${worktreePath} origin/${opts.base}`.quiet();
	return { worktreePath };
}

export const worktree = new Command("worktree")
	.description("Create a new worktree from a base branch")
	.argument("<name>", "Name for the new branch and worktree directory")
	.option("-b, --base <branch>", "Base branch to create from", "master")
	.action(async (name: string, opts: { base: string }) => {
		intro("git worktree");

		const s = spinner();
		try {
			const repoRoot = (
				await Bun.$`git rev-parse --show-toplevel`.quiet().text()
			).trim();
			const worktreePath = path.join(path.dirname(repoRoot), name);

			s.start(`Fetching origin/${opts.base}...`);
			await Bun.$`git fetch origin ${opts.base}`.quiet();
			s.stop("Fetched");

			s.start(`Creating worktree at ${worktreePath}...`);
			await Bun.$`git worktree add -b ${name} ${worktreePath} origin/${opts.base}`.quiet();
			s.stop("Created");

			outro(`Worktree ready at ${worktreePath}`);
		} catch (e: unknown) {
			s.stop("Failed");
			log.error(getShellError(e));
			process.exit(1);
		}
	});
