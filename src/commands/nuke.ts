import * as prompts from "@clack/prompts";
import { Command } from "commander";

export const nuke = new Command("nuke")
	.description("Kill processes by port number or name")
	.argument("<target>", "Port number or process name")
	.option("-f, --force", "Kill all matches without prompting")
	.action(async (target: string, opts: { force?: boolean }) => {
		prompts.intro("nuke");

		const port = parseInt(target, 10);
		const isPort = !isNaN(port) && port >= 1 && port <= 65535;

		let pids: { pid: number; label: string }[] = [];

		if (isPort) {
			const result = await Bun.$`lsof -i :${port} -t`.nothrow().quiet().text();
			pids = result
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.map((pid) => ({
					pid: parseInt(pid, 10),
					label: `PID ${pid} (port ${port})`,
				}));
		} else {
			const result = await Bun.$`pgrep -fl ${target}`.nothrow().quiet().text();
			pids = result
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.map((line) => {
					const [pid, ...rest] = line.split(" ");
					return {
						pid: parseInt(pid, 10),
						label: `${pid} — ${rest.join(" ")}`,
					};
				});
		}

		// Filter out own PID
		const myPid = process.pid;
		pids = pids.filter((p) => p.pid !== myPid && !isNaN(p.pid));

		if (pids.length === 0) {
			prompts.log.warn(
				isPort
					? `No processes found on port ${port}.`
					: `No processes matching "${target}".`,
			);
			process.exit(0);
		}

		let toKill: number[];

		if (opts.force) {
			toKill = pids.map((p) => p.pid);
		} else {
			const selected = await prompts.multiselect({
				message: "Select processes to kill",
				options: pids.map((p) => ({ value: p.pid, label: p.label })),
				required: true,
			});

			if (prompts.isCancel(selected)) {
				prompts.cancel("Cancelled.");
				process.exit(0);
			}

			toKill = selected as number[];
		}

		for (const pid of toKill) {
			try {
				await Bun.$`kill -9 ${pid}`.quiet();
				prompts.log.success(`Killed ${pid}`);
			} catch {
				prompts.log.error(`Failed to kill ${pid}`);
			}
		}

		prompts.outro(
			`Nuked ${toKill.length} process${toKill.length > 1 ? "es" : ""}.`,
		);
	});
