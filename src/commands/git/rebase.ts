import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { ensureNotOnDefaultBranch } from "../../utils/git";

type Shell = typeof Bun.$;

export async function performRebase(
	shell: Shell,
	opts: { push: boolean },
): Promise<void> {
	const { currentBranch, defaultBranch } =
		await ensureNotOnDefaultBranch(shell);
	await shell`git fetch origin ${defaultBranch}`.quiet();
	await shell`git rebase origin/${defaultBranch}`.quiet();
	if (opts.push) {
		await shell`git push --force-with-lease origin ${currentBranch}`.quiet();
	}
}

export const rebase = new Command("rebase")
	.description("Rebase current branch on default branch and force push")
	.option("--no-push", "Skip the force push step")
	.action(async (opts: { push: boolean }) => {
		prompts.intro("git rebase");

		const s = prompts.spinner();
		try {
			const { currentBranch, defaultBranch } = await ensureNotOnDefaultBranch();

			s.start(`Fetching origin/${defaultBranch}...`);
			await Bun.$`git fetch origin ${defaultBranch}`.quiet();
			s.stop("Fetched");

			s.start(`Rebasing on origin/${defaultBranch}...`);
			await Bun.$`git rebase origin/${defaultBranch}`.quiet();
			s.stop("Rebased");

			if (opts.push) {
				s.start(`Force pushing ${currentBranch}...`);
				await Bun.$`git push --force-with-lease origin ${currentBranch}`.quiet();
				s.stop("Pushed");
			}

			prompts.outro("Done!");
		} catch (e: unknown) {
			s.stop("Failed");
			const err = e as { message?: string; stderr?: { toString(): string } };
			const stderrText = err.stderr?.toString().trim();
			if (
				stderrText?.includes("CONFLICT") ||
				err.message?.includes("CONFLICT")
			) {
				prompts.log.error("Rebase conflict detected. Resolve manually:");
				prompts.log.info("  git rebase --continue   (after resolving)");
				prompts.log.info("  git rebase --abort       (to cancel)");
				if (stderrText) prompts.log.info(stderrText);
			} else {
				prompts.log.error(stderrText || err.message || "Unknown error");
			}
			process.exit(1);
		}
	});
