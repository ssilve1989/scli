import { Command } from "commander";
import { git } from "./commands/git";
import { nuke } from "./commands/nuke";
import { setup } from "./commands/setup";

const program = new Command("scli")
	.description("Steve's CLI toolkit")
	.version("0.1.0")
	.addCommand(git)
	.addCommand(nuke)
	.addCommand(setup);

program.parse();
