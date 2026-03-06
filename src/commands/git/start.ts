import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { getShellError } from "../../utils/errors";
import { getDefaultBranch } from "../../utils/git";

export const start = new Command("start")
	.description("Create a new branch from a fresh default branch")
	.argument("<name>", "Name for the new branch")
	.action(async (name: string) => {
		prompts.intro("git start");

		const s = prompts.spinner();
		try {
			const defaultBranch = await getDefaultBranch();

			s.start(`Switching to ${defaultBranch} and pulling...`);
			await Bun.$`git checkout ${defaultBranch}`.quiet();
			await Bun.$`git pull`.quiet();
			s.stop(`${defaultBranch} is up to date`);

			s.start(`Creating branch ${name}...`);
			await Bun.$`git checkout -b ${name}`.quiet();
			s.stop(`On new branch ${name}`);

			prompts.outro("Ready to go!");
		} catch (e: unknown) {
			s.stop("Failed");
			prompts.log.error(getShellError(e));
			process.exit(1);
		}
	});
