import type {
	EditToolDetails,
	ExtensionAPI,
	Theme,
} from "@earendil-works/pi-coding-agent";
import {
	createEditToolDefinition,
	getLanguageFromPath,
	highlightCode,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { errorLine, firstText } from "./render-shared.ts";

// Side-by-side diff view for edits.
//
// `edit` renders old | new columns instead of the unified +/- list.
// Rows past MAX_ROWS collapse to `... N more — view in PR` (collapsed);
// `ctrl+e` expands to the full diff. Below MIN_WIDTH the layout falls
// back to unified single-column. Added/removed lines get One Dark Pro
// syntax colors (via highlightCode) under the red/green line signal.
//
// Columns lay out in render(width) at the real terminal width — never
// pre-rendered, so nothing word-wraps mid-column.

const MAX_ROWS = 100;
const MIN_WIDTH = 90;

type Cell = { num: string; content: string };
type DiffRow =
	| { kind: "context"; cell: Cell }
	| { kind: "gap" }
	| { kind: "change"; left?: Cell; right?: Cell };

function parseLine(line: string): { prefix: string; num: string; content: string } | undefined {
	const match = line.match(/^([+-\s])(\s*\d*)\s?(.*)$/);
	if (!match) return undefined;
	return { prefix: match[1], num: match[2], content: match[3] };
}

function parseDiff(diff: string): DiffRow[] {
	const rows: DiffRow[] = [];
	const lines = diff.split("\n");
	let i = 0;
	while (i < lines.length) {
		const parsed = parseLine(lines[i]);
		if (!parsed) {
			i++;
			continue;
		}
		if (parsed.prefix === " " && parsed.num === "") {
			rows.push({ kind: "gap" });
			i++;
			continue;
		}
		if (parsed.prefix === " ") {
			rows.push({ kind: "context", cell: { num: parsed.num, content: parsed.content } });
			i++;
			continue;
		}
		const dels: Cell[] = [];
		while (i < lines.length) {
			const p = parseLine(lines[i]);
			if (!p || p.prefix !== "-") break;
			dels.push({ num: p.num, content: p.content });
			i++;
		}
		const adds: Cell[] = [];
		while (i < lines.length) {
			const p = parseLine(lines[i]);
			if (!p || p.prefix !== "+") break;
			adds.push({ num: p.num, content: p.content });
			i++;
		}
		const pairs = Math.max(dels.length, adds.length);
		for (let k = 0; k < pairs; k++) {
			rows.push({ kind: "change", left: dels[k], right: adds[k] });
		}
	}
	return rows;
}

function padCell(cell: string, width: number): string {
	return cell + " ".repeat(Math.max(0, width - visibleWidth(cell)));
}

// Gutter (`-12` / `+12`) carries the del/add color; code keeps its
// syntax colors. A full-line fg wash would be cancelled anyway by the
// highlighter's inner resets, and reads worse on the tool tint.
function gutterLine(
	theme: Theme,
	prefix: string,
	cell: Cell,
	color: "toolDiffRemoved" | "toolDiffAdded",
	width: number,
): string {
	return truncateToWidth(`${theme.fg(color, `${prefix}${cell.num}`)} ${cell.content}`, width);
}

class SideBySideDiff implements Component {
	constructor(
		private readonly theme: Theme,
		private readonly head: string,
		private readonly rows: DiffRow[],
		private readonly hidden: number,
	) {}

	invalidate(): void {}

	render(width: number): string[] {
		const theme = this.theme;
		const sep = theme.fg("dim", " │ ");
		const narrow = width < MIN_WIDTH;
		const leftW = Math.floor((width - 3) / 2);
		const rightW = width - 3 - leftW;

		const out: string[] = [this.head];
		for (const row of this.rows) {
			if (row.kind === "gap") {
				out.push(theme.fg("dim", " ..."));
				continue;
			}
			if (row.kind === "context") {
				out.push(theme.fg("toolDiffContext", truncateToWidth(`  ${row.cell.num} ${row.cell.content}`, width)));
				continue;
			}
			const leftRaw = row.left ? { num: row.left.num, content: row.left.content } : undefined;
			const rightRaw = row.right ? { num: row.right.num, content: row.right.content } : undefined;
			if (narrow) {
				if (leftRaw) out.push(gutterLine(theme, "-", leftRaw, "toolDiffRemoved", width));
				if (rightRaw) out.push(gutterLine(theme, "+", rightRaw, "toolDiffAdded", width));
				continue;
			}
			const left = leftRaw
				? padCell(gutterLine(theme, "-", leftRaw, "toolDiffRemoved", leftW), leftW)
				: " ".repeat(leftW);
			const right = rightRaw ? gutterLine(theme, "+", rightRaw, "toolDiffAdded", rightW) : "";
			out.push(`${left}${sep}${right}`);
		}
		if (this.hidden > 0) {
			out.push(theme.fg("dim", `... ${this.hidden} more lines — view in PR`));
		}
		return out;
	}
}

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();
	const originalEdit = createEditToolDefinition(cwd);

	pi.registerTool({
		...originalEdit,
		renderShell: "self",
		renderCall(args, theme) {
			const path = (args as { path?: string; file_path?: string }).path ??
				(args as { file_path?: string }).file_path ??
				"";
			return new Text(`${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", path)}`, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text(theme.fg("warning", "Editing..."), 0, 0);

			const text = firstText(result);
			if (result.isError || text.startsWith("Error")) {
				return errorLine(theme, text);
			}

			const diff = (result.details as EditToolDetails | undefined)?.diff;
			if (!diff) return new Text(theme.fg("success", "✓ applied"), 0, 0);

			const toolArgs = context.args as { path?: string; file_path?: string };
			const path = toolArgs?.path ?? toolArgs?.file_path ?? "";
			const lang = path ? getLanguageFromPath(path) : undefined;

			const rows = parseDiff(diff);
			let additions = 0;
			let removals = 0;
			const delContents: string[] = [];
			const addContents: string[] = [];
			for (const row of rows) {
				if (row.kind !== "change") continue;
				if (row.left) {
					removals++;
					delContents.push(row.left.content);
				}
				if (row.right) {
					additions++;
					addContents.push(row.right.content);
				}
			}

			// Syntax-highlight each side as a block so multi-line
			// constructs color correctly; line count is preserved.
			const delHi = lang && delContents.length > 0
				? highlightCode(delContents.join("\n"), lang)
				: delContents;
			const addHi = lang && addContents.length > 0
				? highlightCode(addContents.join("\n"), lang)
				: addContents;
			let di = 0;
			let ai = 0;
			const hiRows = rows.map((row) => {
				if (row.kind !== "change") return row;
				return {
					...row,
					left: row.left ? { ...row.left, content: delHi[di++] ?? row.left.content } : undefined,
					right: row.right ? { ...row.right, content: addHi[ai++] ?? row.right.content } : undefined,
				};
			});

			const head =
				`${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", path)} ` +
				`${theme.fg("success", `+${additions}`)}${theme.fg("dim", "/")}${theme.fg("error", `-${removals}`)}`;
			const visible = expanded ? hiRows : hiRows.slice(0, MAX_ROWS);
			return new SideBySideDiff(theme, head, visible, hiRows.length - visible.length);
		},
	});
}
