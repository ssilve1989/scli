// Extracts the most informative message from a Bun.$ ShellError
export function getShellError(e: unknown): string {
	const err = e as { message?: string; stderr?: { toString(): string } };
	return err.stderr?.toString().trim() || err.message || "Unknown error";
}
