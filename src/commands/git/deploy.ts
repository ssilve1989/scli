import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { getCurrentBranch } from "../../utils/git";

export const deploy = new Command("deploy")
	.description("Sync a deploy branch to the current branch and push")
	.argument("<branch>", "Target deploy branch")
	.option("-f, --force", "Skip confirmation prompt")
	.action(async (branch: string, opts: { force?: boolean }) => {
		prompts.intro("git deploy");

		const sourceBranch = await getCurrentBranch();

		if (branch === sourceBranch) {
			prompts.log.error("Target branch cannot be the current branch.");
			process.exit(1);
		}

		if (!opts.force) {
			const confirmed = await prompts.confirm({
				message: `Reset ${branch} to ${sourceBranch} and force push?`,
			});

			if (prompts.isCancel(confirmed) || !confirmed) {
				prompts.cancel("Cancelled.");
				process.exit(0);
			}
		}

		const s = prompts.spinner();
		try {
			// Check if target branch exists locally
			const exists =
				(await Bun.$`git rev-parse --verify ${branch}`.nothrow().quiet())
					.exitCode === 0;

			s.start(`Switching to ${branch}...`);
			if (exists) {
				await Bun.$`git checkout ${branch}`.quiet();
			} else {
				await Bun.$`git checkout -b ${branch}`.quiet();
			}
			s.stop(`On ${branch}`);

			s.start(`Resetting to ${sourceBranch}...`);
			await Bun.$`git reset --hard ${sourceBranch}`.quiet();
			s.stop("Reset");

			s.start(`Force pushing ${branch}...`);
			await Bun.$`git push --force-with-lease origin ${branch}`.quiet();
			s.stop("Pushed");

			prompts.outro("Deployed!");
		} catch (e: any) {
			s.stop("Failed");
			prompts.log.error(e.message);
			process.exit(1);
		} finally {
			// Always return to source branch
			await Bun.$`git checkout ${sourceBranch}`.quiet();
		}
	});
