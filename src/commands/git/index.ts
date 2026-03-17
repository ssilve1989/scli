import { Command } from "commander";
import { amend } from "./amend";
import { deploy } from "./deploy";
import { prune } from "./prune";
import { rebase } from "./rebase";
import { start } from "./start";
import { sync } from "./sync";
import { worktree } from "./worktree";

export const git = new Command("git")
	.description("Git utilities")
	.addCommand(prune)
	.addCommand(sync)
	.addCommand(rebase)
	.addCommand(amend)
	.addCommand(start)
	.addCommand(deploy)
	.addCommand(worktree);
