import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { getCurrentBranch, getDefaultBranch } from "../../utils/git";

export const sync = new Command("sync")
	.description("Sync default branch and return to current branch")
	.action(async () => {
		prompts.intro("git sync");

		const s = prompts.spinner();
		try {
			const defaultBranch = await getDefaultBranch();
			const currentBranch = await getCurrentBranch();

			if (currentBranch === defaultBranch) {
				s.start("Pulling latest changes...");
				await Bun.$`git pull`.quiet();
				s.stop(`${defaultBranch} is up to date`);
			} else {
				s.start(`Switching to ${defaultBranch} and pulling...`);
				await Bun.$`git checkout ${defaultBranch}`.quiet();
				await Bun.$`git pull`.quiet();
				s.stop(`${defaultBranch} is up to date`);

				s.start(`Switching back to ${currentBranch}...`);
				await Bun.$`git checkout ${currentBranch}`.quiet();
				s.stop(`Back on ${currentBranch}`);
			}

			prompts.outro("Synced!");
		} catch (e: any) {
			s.stop("Failed");
			prompts.log.error(e.message);
			process.exit(1);
		}
	});
