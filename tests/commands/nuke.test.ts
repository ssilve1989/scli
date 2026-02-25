import { describe, expect, test } from "bun:test";
import {
	filterOwnPid,
	parseLsofOutput,
	parsePgrepOutput,
} from "../../src/commands/nuke";

describe("parseLsofOutput", () => {
	test("single PID line returns one entry", () => {
		const result = parseLsofOutput("1234\n", 3000);
		expect(result).toEqual([{ pid: 1234, label: "PID 1234 (port 3000)" }]);
	});

	test("multiple PID lines returns multiple entries", () => {
		const result = parseLsofOutput("1234\n5678\n", 8080);
		expect(result).toEqual([
			{ pid: 1234, label: "PID 1234 (port 8080)" },
			{ pid: 5678, label: "PID 5678 (port 8080)" },
		]);
	});

	test("empty string returns empty array", () => {
		expect(parseLsofOutput("", 3000)).toEqual([]);
	});

	test("whitespace-only lines are ignored", () => {
		expect(parseLsofOutput("   \n  \n", 3000)).toEqual([]);
	});
});

describe("parsePgrepOutput", () => {
	test("single line returns one entry", () => {
		const result = parsePgrepOutput("1234 node server.js\n");
		expect(result).toEqual([{ pid: 1234, label: "1234 — node server.js" }]);
	});

	test("multi-word command is preserved in label", () => {
		const result = parsePgrepOutput("5678 bun run dev --port 3000\n");
		expect(result).toEqual([
			{ pid: 5678, label: "5678 — bun run dev --port 3000" },
		]);
	});

	test("empty string returns empty array", () => {
		expect(parsePgrepOutput("")).toEqual([]);
	});

	test("multiple lines return multiple entries", () => {
		const result = parsePgrepOutput("111 node a.js\n222 bun b.ts\n");
		expect(result).toEqual([
			{ pid: 111, label: "111 — node a.js" },
			{ pid: 222, label: "222 — bun b.ts" },
		]);
	});
});

describe("filterOwnPid", () => {
	const pids = [
		{ pid: 100, label: "100 — proc-a" },
		{ pid: 200, label: "200 — proc-b" },
		{ pid: 300, label: "300 — proc-c" },
	];

	test("removes entry matching myPid", () => {
		const result = filterOwnPid(pids, 200);
		expect(result.map((p) => p.pid)).toEqual([100, 300]);
	});

	test("removes entries with NaN pid", () => {
		const withNaN = [
			{ pid: NaN, label: "bad" },
			{ pid: 100, label: "100 — proc-a" },
		];
		const result = filterOwnPid(withNaN, 999);
		expect(result).toEqual([{ pid: 100, label: "100 — proc-a" }]);
	});

	test("passes through entries that do not match myPid", () => {
		const result = filterOwnPid(pids, 999);
		expect(result).toEqual(pids);
	});
});
