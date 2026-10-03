import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { homedir } from "node:os";

// Shared collapsed/expanded rendering helpers for the tool overrides.
//
// This is NOT an extension (no default export, no manifest entry): it is
// imported relatively by compact-output.ts and diff-view.ts so both stay
// independently toggleable via `pi config` while sharing one implementation.
// Relative imports use the explicit `.ts` suffix, matching Pi 1.0's own
// multi-file extension examples (e.g. doom-overlay/).

export type ToolResult = AgentToolResult;

export interface TruncationInfo {
	truncated?: boolean;
	truncatedBy?: "lines" | "bytes" | null;
	totalLines?: number;
	outputLines?: number;
}

export function firstText(result: ToolResult): string {
	const content = result.content[0];
	return content?.type === "text" ? content.text : "";
}

export function isErrorResult(result: ToolResult, text: string): boolean {
	return result.isError || text.startsWith("Error");
}

export function nonEmptyLines(text: string): string[] {
	return text.split("\n").filter((line) => line.trim() !== "");
}

export function errorLine(theme: Theme, text: string): Text {
	return new Text(theme.fg("error", nonEmptyLines(text)[0] ?? "Error"), 0, 0);
}

/** Collapsed head + up to `cap` dim detail lines + `... N more`. */
export function expandedBlock(
	theme: Theme,
	head: string,
	lines: string[],
	total: number,
	cap: number,
): Text {
	let text = head;
	for (const line of lines.slice(0, cap)) {
		text += `\n${theme.fg("dim", line)}`;
	}
	if (total > cap) {
		text += `\n${theme.fg("muted", `... ${total - cap} more`)}`;
	}
	return new Text(text, 0, 0);
}

/** `+N more (limit)` marker when the tool truncated server-side. */
export function truncationMarker(theme: Theme, details?: { truncation?: TruncationInfo }): string {
	return details?.truncation?.truncated ? theme.fg("warning", " (truncated)") : "";
}

/** Total line count preferring the tool's truncation metadata over recounting. */
export function totalLines(text: string, details?: { truncation?: TruncationInfo }): number {
	return details?.truncation?.totalLines ?? nonEmptyLines(text).length;
}

export function shortCommand(cmd: string, max = 80): string {
	return cmd.length > max ? `${cmd.slice(0, max - 3)}...` : cmd;
}

export function shortenPath(path: string): string {
	const home = homedir();
	return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}
