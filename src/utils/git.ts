export async function getDefaultBranch(): Promise<string> {
	try {
		const ref = await Bun.$`git symbolic-ref refs/remotes/origin/HEAD`
			.quiet()
			.text();
		return ref.trim().split("/").pop()!;
	} catch {
		// Fallback: check if main or master exists locally
		const branches = await Bun.$`git branch --list`.quiet().text();
		const list = branches
			.split("\n")
			.map((b) => b.replace("*", "").trim())
			.filter(Boolean);
		if (list.includes("main")) return "main";
		if (list.includes("master")) return "master";
		throw new Error("Could not determine default branch");
	}
}

export async function getCurrentBranch(): Promise<string> {
	const branch = await Bun.$`git rev-parse --abbrev-ref HEAD`.quiet().text();
	const name = branch.trim();
	if (name === "HEAD") {
		throw new Error("Detached HEAD state — cannot determine current branch");
	}
	return name;
}

export async function ensureNotOnDefaultBranch(): Promise<{
	currentBranch: string;
	defaultBranch: string;
}> {
	const [currentBranch, defaultBranch] = await Promise.all([
		getCurrentBranch(),
		getDefaultBranch(),
	]);
	if (currentBranch === defaultBranch) {
		throw new Error(
			`Already on default branch (${defaultBranch}). Switch to a feature branch first.`,
		);
	}
	return { currentBranch, defaultBranch };
}
