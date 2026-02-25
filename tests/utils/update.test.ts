import { describe, expect, test } from "bun:test";
import {
	getDownloadUrl,
	getPlatformSlug,
	isUpdateAvailable,
} from "../../src/utils/update";

describe("isUpdateAvailable", () => {
	test("returns false when versions are equal", () => {
		expect(isUpdateAvailable("1.2.3", "1.2.3")).toBe(false);
	});

	test("returns true when latest has higher patch", () => {
		expect(isUpdateAvailable("1.2.3", "1.2.4")).toBe(true);
	});

	test("returns false when current has higher patch", () => {
		expect(isUpdateAvailable("1.2.4", "1.2.3")).toBe(false);
	});

	test("returns true when latest has higher minor", () => {
		expect(isUpdateAvailable("1.2.3", "1.3.0")).toBe(true);
	});

	test("returns false when current has higher minor", () => {
		expect(isUpdateAvailable("1.3.0", "1.2.9")).toBe(false);
	});

	test("returns true when latest has higher major", () => {
		expect(isUpdateAvailable("1.9.9", "2.0.0")).toBe(true);
	});

	test("returns false when current has higher major", () => {
		expect(isUpdateAvailable("2.0.0", "1.9.9")).toBe(false);
	});

	test("handles 0.0.1 -> 0.0.2", () => {
		expect(isUpdateAvailable("0.0.1", "0.0.2")).toBe(true);
	});
});

describe("getPlatformSlug", () => {
	const originalPlatform = process.platform;
	const originalArch = process.arch;

	test("returns linux-x64 for linux/x64", () => {
		Object.defineProperty(process, "platform", { value: "linux" });
		Object.defineProperty(process, "arch", { value: "x64" });
		expect(getPlatformSlug()).toBe("linux-x64");
		Object.defineProperty(process, "platform", { value: originalPlatform });
		Object.defineProperty(process, "arch", { value: originalArch });
	});

	test("returns macos-arm64 for darwin/arm64", () => {
		Object.defineProperty(process, "platform", { value: "darwin" });
		Object.defineProperty(process, "arch", { value: "arm64" });
		expect(getPlatformSlug()).toBe("macos-arm64");
		Object.defineProperty(process, "platform", { value: originalPlatform });
		Object.defineProperty(process, "arch", { value: originalArch });
	});

	test("returns macos-x64 for darwin/x64", () => {
		Object.defineProperty(process, "platform", { value: "darwin" });
		Object.defineProperty(process, "arch", { value: "x64" });
		expect(getPlatformSlug()).toBe("macos-x64");
		Object.defineProperty(process, "platform", { value: originalPlatform });
		Object.defineProperty(process, "arch", { value: originalArch });
	});

	test("throws for unsupported platform", () => {
		Object.defineProperty(process, "platform", { value: "win32" });
		Object.defineProperty(process, "arch", { value: "x64" });
		expect(() => getPlatformSlug()).toThrow("Unsupported platform");
		Object.defineProperty(process, "platform", { value: originalPlatform });
		Object.defineProperty(process, "arch", { value: originalArch });
	});
});

describe("getDownloadUrl", () => {
	test("builds correct URL", () => {
		expect(getDownloadUrl("v1.2.3", "linux-x64")).toBe(
			"https://github.com/ssilve1989/personal-cli/releases/download/v1.2.3/scli-linux-x64",
		);
	});

	test("builds correct URL for macos-arm64", () => {
		expect(getDownloadUrl("v2.0.0", "macos-arm64")).toBe(
			"https://github.com/ssilve1989/personal-cli/releases/download/v2.0.0/scli-macos-arm64",
		);
	});
});
