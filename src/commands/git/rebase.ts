import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { ensureNotOnDefaultBranch } from "../../utils/git";

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
		} catch (e: any) {
			s.stop("Failed");
			if (
				e.message?.includes("CONFLICT") ||
				e.stderr?.toString().includes("CONFLICT")
			) {
				prompts.log.error("Rebase conflict detected. Resolve manually:");
				prompts.log.info("  git rebase --continue   (after resolving)");
				prompts.log.info("  git rebase --abort       (to cancel)");
			} else {
				prompts.log.error(e.message ?? e.stderr?.toString());
			}
			process.exit(1);
		}
	});
