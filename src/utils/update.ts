const GITHUB_REPO = "ssilve1989/personal-cli";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface ReleaseInfo {
	version: string;
	tag: string;
}

export async function getLatestRelease(): Promise<ReleaseInfo> {
	const res = await fetch(GITHUB_API, {
		headers: { Accept: "application/vnd.github+json" },
	});

	if (!res.ok) {
		throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
	}

	const data = (await res.json()) as { tag_name: string };
	const tag = data.tag_name;
	const version = tag.replace(/^v/, "");
	return { version, tag };
}

export function isUpdateAvailable(current: string, latest: string): boolean {
	const parse = (v: string) => v.split(".").map(Number);
	const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);
	const [lMaj = 0, lMin = 0, lPat = 0] = parse(latest);

	if (lMaj !== cMaj) return lMaj > cMaj;
	if (lMin !== cMin) return lMin > cMin;
	return lPat > cPat;
}

export function getPlatformSlug(): string {
	const { platform, arch } = process;

	if (platform === "linux" && arch === "x64") return "linux-x64";
	if (platform === "darwin" && arch === "arm64") return "macos-arm64";
	if (platform === "darwin" && arch === "x64") return "macos-x64";

	throw new Error(`Unsupported platform: ${platform}/${arch}`);
}

export function getDownloadUrl(tag: string, slug: string): string {
	return `https://github.com/${GITHUB_REPO}/releases/download/${tag}/scli-${slug}`;
}
