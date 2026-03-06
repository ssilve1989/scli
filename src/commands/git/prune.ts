import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { getShellError } from "../../utils/errors";

export function parseBranchList(raw: string): {
	currentBranch: string;
	branches: string[];
} {
	const lines = raw.split("\n").filter((l) => l.trim());
	let currentBranch = "";
	const branches: string[] = [];

	for (const line of lines) {
		const name = line.replace("*", "").trim();
		if (line.trimStart().startsWith("*")) {
			currentBranch = name;
		} else {
			branches.push(name);
		}
	}

	return { currentBranch, branches };
}

export const prune = new Command("prune")
	.description("Interactively delete local git branches")
	.argument("[pattern]", "Filter branches by substring")
	.option("-f, --force", "Skip confirmation prompt")
	.action(async (pattern: string | undefined, opts: { force?: boolean }) => {
		const result = await Bun.$`git branch`.text();
		const { currentBranch, branches } = parseBranchList(result);

		const filtered = pattern
			? branches.filter((b) => b.includes(pattern))
			: branches;

		if (filtered.length === 0) {
			console.log(
				pattern
					? `No branches matching "${pattern}" (excluding current: ${currentBranch})`
					: `No branches to prune (only current: ${currentBranch})`,
			);
			return;
		}

		let toDelete: string[];

		if (opts.force) {
			toDelete = filtered;
		} else {
			prompts.intro("git branch prune");

			const selected = await prompts.multiselect({
				message: `Select branches to delete (current: ${currentBranch})`,
				options: filtered.map((b) => ({ value: b, label: b })),
				required: true,
			});

			if (prompts.isCancel(selected)) {
				prompts.cancel("Cancelled.");
				process.exit(0);
			}

			toDelete = selected as string[];
		}

		if (toDelete.length === 0) {
			console.log("No branches selected.");
			return;
		}

		for (const branch of toDelete) {
			try {
				await Bun.$`git branch -D ${branch}`.quiet();
				console.log(`  Deleted ${branch}`);
			} catch (e: unknown) {
				console.error(`  Failed to delete ${branch}: ${getShellError(e)}`);
			}
		}

		console.log(
			`\nPruned ${toDelete.length} branch${toDelete.length > 1 ? "es" : ""}.`,
		);
	});
