import { describe, expect, test } from "bun:test";
import { applyManagedSection } from "../../src/commands/setup";

const BEGIN = "# BEGIN managed";
const END = "# END managed";
const SECTION = `${BEGIN}\nsome content\n${END}`;

describe("applyManagedSection", () => {
	test("appends to empty file", () => {
		const result = applyManagedSection("", SECTION, BEGIN, END);
		expect(result).toBe(`${SECTION}\n`);
		expect(result.endsWith("\n")).toBe(true);
	});

	test("appends to non-empty file with double newline separator", () => {
		const result = applyManagedSection("existing content", SECTION, BEGIN, END);
		expect(result).toBe(`existing content\n\n${SECTION}\n`);
	});

	test("replaces section in-place when both markers present", () => {
		const existing = `before\n${BEGIN}\nold content\n${END}\nafter`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		expect(result).toBe(`before\n${SECTION}\nafter`);
	});

	test("replacement preserves content before markers", () => {
		const existing = `line1\nline2\n${BEGIN}\nold\n${END}`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		expect(result.startsWith("line1\nline2\n")).toBe(true);
	});

	test("replacement preserves content after markers", () => {
		const existing = `${BEGIN}\nold\n${END}\nafter1\nafter2`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		expect(result.endsWith("\nafter1\nafter2")).toBe(true);
	});

	test("result contains exactly one BEGIN marker after replacement", () => {
		const existing = `before\n${BEGIN}\nold\n${END}\nafter`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		const count = result.split(BEGIN).length - 1;
		expect(count).toBe(1);
	});

	test("result contains exactly one END marker after replacement", () => {
		const existing = `before\n${BEGIN}\nold\n${END}\nafter`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		const count = result.split(END).length - 1;
		expect(count).toBe(1);
	});

	test("falls back to append when only BEGIN marker present", () => {
		const existing = `existing\n${BEGIN}\norphaned`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		// Corrupt state → append
		expect(result.includes(`${BEGIN}\norphaned`)).toBe(true);
		expect(result.endsWith(`${SECTION}\n`)).toBe(true);
	});

	test("falls back to append when only END marker present", () => {
		const existing = `${END}\nsome content`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		expect(result.endsWith(`${SECTION}\n`)).toBe(true);
	});

	test("falls back to append when END appears before BEGIN", () => {
		const existing = `${END}\nstuff\n${BEGIN}`;
		const result = applyManagedSection(existing, SECTION, BEGIN, END);
		expect(result.endsWith(`${SECTION}\n`)).toBe(true);
	});
});
