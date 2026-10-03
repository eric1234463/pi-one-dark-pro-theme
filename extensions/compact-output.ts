import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	createBashToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
	errorLine,
	expandedBlock,
	firstText,
	isErrorResult,
	nonEmptyLines,
	shortCommand,
	totalLines,
	truncationMarker,
} from "./render-shared.ts";

// Compact output: result-oriented transcript.
//
// Read-only tools (read, bash, grep, find, ls) collapse to one line:
//   `$ pnpm test` → `✓ done (12 lines)`
// Full content returns on expand (ctrl+e). edit/write are untouched so
// code diffs stay visible. renderShell "self" drops the box chrome.
//
// Counts prefer the tool's details.truncation metadata (exact totals even
// when the model-facing text was cut); the exit code still comes from the
// model-facing text because BashToolDetails carries no status field.

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	const originalRead = createReadToolDefinition(cwd);
	pi.registerTool({
		...originalRead,
		renderShell: "self",
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("read "));
			text += theme.fg("accent", args.path);
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Reading..."), 0, 0);
			const text = firstText(result);
			if (isErrorResult(result, text)) return errorLine(theme, text);
			if (result.content[0]?.type === "image") {
				return new Text(theme.fg("success", "Image loaded"), 0, 0);
			}
			const lines = nonEmptyLines(text);
			const head =
				theme.fg("success", `${totalLines(text, result.details)} lines`) +
				truncationMarker(theme, result.details);
			if (!expanded) return new Text(head, 0, 0);
			return expandedBlock(theme, head, lines, lines.length, 15);
		},
	});

	const originalBash = createBashToolDefinition(cwd);
	pi.registerTool({
		...originalBash,
		renderShell: "self",
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("$ "));
			text += theme.fg("accent", shortCommand(args.command));
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Running..."), 0, 0);
			const text = firstText(result);
			if (isErrorResult(result, text)) return errorLine(theme, text);
			const exitMatch = text.match(/exit code: (\d+)/);
			const exitCode = exitMatch ? Number(exitMatch[1]) : 0;
			const lines = nonEmptyLines(text).filter((line) => !line.startsWith("exit code:"));
			const head =
				exitCode === 0
					? theme.fg("success", "✓ done") + theme.fg("dim", ` (${lines.length} lines)`)
					: theme.fg("error", `✗ exit ${exitCode}`) + theme.fg("dim", ` (${lines.length} lines)`);
			if (!expanded) return new Text(head, 0, 0);
			return expandedBlock(theme, head, lines, lines.length, 20);
		},
	});

	const originalGrep = createGrepToolDefinition(cwd);
	pi.registerTool({
		...originalGrep,
		renderShell: "self",
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("grep "));
			text += theme.fg("accent", shortCommand(args.pattern, 60));
			text += theme.fg("dim", ` in ${args.path ?? "."}`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Searching..."), 0, 0);
			const text = firstText(result);
			if (isErrorResult(result, text)) return errorLine(theme, text);
			const lines = nonEmptyLines(text);
			const head =
				lines.length === 0
					? theme.fg("dim", "no matches")
					: theme.fg("success", `${lines.length} matches`) +
						truncationMarker(theme, result.details);
			if (!expanded) return new Text(head, 0, 0);
			return expandedBlock(theme, head, lines, lines.length, 15);
		},
	});

	const originalFind = createFindToolDefinition(cwd);
	pi.registerTool({
		...originalFind,
		renderShell: "self",
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("find "));
			text += theme.fg("accent", shortCommand(args.pattern ?? ".", 60));
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Finding..."), 0, 0);
			const text = firstText(result);
			if (isErrorResult(result, text)) return errorLine(theme, text);
			const lines = nonEmptyLines(text);
			const head =
				theme.fg("success", `${lines.length} paths`) + truncationMarker(theme, result.details);
			if (!expanded) return new Text(head, 0, 0);
			return expandedBlock(theme, head, lines, lines.length, 15);
		},
	});

	const originalLs = createLsToolDefinition(cwd);
	pi.registerTool({
		...originalLs,
		renderShell: "self",
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("ls "));
			text += theme.fg("accent", args.path ?? ".");
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Listing..."), 0, 0);
			const text = firstText(result);
			if (isErrorResult(result, text)) return errorLine(theme, text);
			const lines = nonEmptyLines(text);
			const head =
				theme.fg("success", `${lines.length} entries`) + truncationMarker(theme, result.details);
			if (!expanded) return new Text(head, 0, 0);
			return expandedBlock(theme, head, lines, lines.length, 15);
		},
	});
}
