import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { getShellError } from "../../utils/errors";
import { getCurrentBranch } from "../../utils/git";

export const amend = new Command("amend")
	.description("Stage tracked changes and amend the last commit")
	.option("-p, --push", "Force push after amending")
	.action(async (opts: { push?: boolean }) => {
		prompts.intro("git amend");

		const s = prompts.spinner();
		try {
			const status = await Bun.$`git status --porcelain`.quiet().text();
			const trackedChanges = status
				.split("\n")
				.filter((l) => l.trim() && !l.startsWith("??"));

			if (trackedChanges.length === 0) {
				prompts.log.warn("No tracked changes to amend.");
				process.exit(0);
			}

			s.start("Staging and amending...");
			await Bun.$`git add -u`.quiet();
			await Bun.$`git commit --amend --no-edit`.quiet();
			s.stop("Amended");

			if (opts.push) {
				const currentBranch = await getCurrentBranch();
				s.start(`Force pushing ${currentBranch}...`);
				await Bun.$`git push --force-with-lease origin ${currentBranch}`.quiet();
				s.stop("Pushed");
			}

			prompts.outro("Done!");
		} catch (e: unknown) {
			s.stop("Failed");
			prompts.log.error(getShellError(e));
			process.exit(1);
		}
	});
