import { describe, expect, test } from "bun:test";
import { parseBranchList } from "../../src/commands/git/prune";

describe("parseBranchList", () => {
	test("current branch (marked with *) goes into currentBranch, not branches", () => {
		const result = parseBranchList("* main\n  feature-x\n");
		expect(result.currentBranch).toBe("main");
		expect(result.branches).not.toContain("main");
	});

	test("non-current branches go into branches array", () => {
		const result = parseBranchList("* main\n  feature-x\n  feature-y\n");
		expect(result.branches).toEqual(["feature-x", "feature-y"]);
	});

	test("single branch (current only) returns empty branches array", () => {
		const result = parseBranchList("* main\n");
		expect(result.currentBranch).toBe("main");
		expect(result.branches).toEqual([]);
	});

	test("empty input returns empty currentBranch and branches", () => {
		const result = parseBranchList("");
		expect(result.currentBranch).toBe("");
		expect(result.branches).toEqual([]);
	});

	test("branch names with slashes are preserved", () => {
		const result = parseBranchList("* main\n  feature/ABC-123\n");
		expect(result.branches).toEqual(["feature/ABC-123"]);
	});

	test("whitespace is trimmed from all branch names", () => {
		const result = parseBranchList("  * main\n    feature-x\n");
		expect(result.currentBranch).toBe("main");
		expect(result.branches).toEqual(["feature-x"]);
	});
});
