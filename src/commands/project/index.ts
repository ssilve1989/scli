import { Command } from "commander";
import { newProject } from "./new";

export const project = new Command("project")
	.description("Project utilities")
	.addCommand(newProject);
