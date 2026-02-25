import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import { git } from "./commands/git";
import { nuke } from "./commands/nuke";
import { setup } from "./commands/setup";
import { update } from "./commands/update";
import { getLatestRelease, isUpdateAvailable } from "./utils/update";

const program = new Command("scli")
	.description("Steve's CLI toolkit")
	.version(pkg.version)
	.addCommand(git)
	.addCommand(nuke)
	.addCommand(setup)
	.addCommand(update);

// Non-blocking background update check — prints a dimmed notice after the
// command runs. Skipped when running `update`, `--version`, or `--help`.
const argv = process.argv.slice(2);
const skipCheck =
	argv[0] === "update" ||
	argv.includes("--version") ||
	argv.includes("-V") ||
	argv.includes("--help") ||
	argv.includes("-h");

// Start the check early so it runs in parallel with the command.
const updateCheckPromise: Promise<string | undefined> = skipCheck
	? Promise.resolve(undefined)
	: getLatestRelease()
			.then(({ version }) => {
				if (isUpdateAvailable(pkg.version, version)) {
					return `A new version of scli is available: v${version} (current: v${pkg.version}). Run \`scli update\` to upgrade.`;
				}
			})
			.catch(() => undefined);

await program.parseAsync();

// Race: if the check resolved during the command, show the notice; otherwise
// give it up to 500 ms more before giving up so we don't slow down fast exits.
const notice = await Promise.race([
	updateCheckPromise,
	new Promise<undefined>((resolve) =>
		setTimeout(() => resolve(undefined), 500),
	),
]);

if (notice) {
	process.stderr.write(`\n\x1b[2m${notice}\x1b[0m\n`);
}
