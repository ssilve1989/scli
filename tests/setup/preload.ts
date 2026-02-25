import { mock } from "bun:test";

mock.module("@clack/prompts", () => ({
	intro: mock(() => {}),
	outro: mock(() => {}),
	cancel: mock(() => {}),
	spinner: mock(() => ({
		start: mock(() => {}),
		stop: mock(() => {}),
		message: mock(() => {}),
	})),
	confirm: mock(async () => true),
	multiselect: mock(async () => []),
	text: mock(async () => ""),
	isCancel: mock(() => false),
	log: {
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		success: mock(() => {}),
	},
}));
