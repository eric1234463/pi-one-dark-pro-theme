import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component, Color, EditorTheme, TUI } from "@earendil-works/pi-tui";
import { parseColor, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// One Dark Pro Glass statusline + input block.
//
// Footer: powerline blocks mirroring the starship bar (surface0 user
// block, surface1 content block, surface0 time block,  separators).
// Segments drop by priority on narrow widths (user/time anchors stay);
// set NO_NERD_FONT=1 for an ASCII fallback. Limits segment is hidden
// until a provider usage source exists (see fetchLimits).
// Editor: 1-cell side padding, accent borders, full-block userMessageBg fill.

// Starship one_dark_pro_glass palette (verbatim from starship.toml).
const pal: Record<string, Color> = {
	mono0: parseColor("#d7dae0"),
	surface0: parseColor("#2c313a"),
	surface1: parseColor("#3e4452"),
	green: parseColor("#98c379"),
	blue: parseColor("#61afef"),
	orange: parseColor("#d19a66"),
	purple: parseColor("#c678dd"),
	yellow: parseColor("#e5c07b"),
	red: parseColor("#ff616e"),
	dim: parseColor("#828997"),
};

const nerdFont = !process.env.NO_NERD_FONT && !process.env.PI_NO_NERD_FONT;

const glyph = {
	capL: nerdFont ? "" : "",
	sep: nerdFont ? "\ue0b4" : "",
	capR: nerdFont ? "\ue0b4" : "",
	dir: nerdFont ? "󰉋" : "",
	branch: nerdFont ? "" : "git:",
	staged: nerdFont ? "󰐕" : "+",
	modified: nerdFont ? "󰷫" : "~",
	untracked: nerdFont ? "" : "?",
	time: nerdFont ? "󰥔" : "",
	battery: nerdFont ? "󰁹" : "",
	plainSep: " | ",
};

const timeFmt = new Intl.DateTimeFormat("en-HK", {
	hour: "2-digit",
	minute: "2-digit",
	hour12: true,
	timeZone: "Asia/Hong_Kong",
});

function formatTokens(count: number): string {
	if (count < 1000) return `${count}`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${Math.round(count / 1000000)}M`;
}

function shortCwd(cwd: string): string {
	const home = process.env.HOME ?? process.env.USERPROFILE;
	if (home && cwd.startsWith(home)) return `~${cwd.slice(home.length)}`;
	return cwd;
}

class BlockEditor extends CustomEditor {
	private readonly getTheme: () => Theme;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, getTheme: () => Theme) {
		super(tui, theme, keybindings, { paddingX: 1 });
		this.getTheme = getTheme;
	}

	protected renderTopBorder(width: number, hidden: number): string {
		const raw = hidden > 0 ? super.renderTopBorder(width, hidden) : "─".repeat(width);
		return this.getTheme().style(raw, { fg: "accent", bg: "userMessageBg" });
	}

	protected renderBottomBorder(width: number, hidden: number): string {
		const raw = hidden > 0 ? super.renderBottomBorder(width, hidden) : "─".repeat(width);
		return this.getTheme().style(raw, { fg: "accent", bg: "userMessageBg" });
	}

	render(width: number): string[] {
		const theme = this.getTheme();
		// theme.bg() closes with \x1b[49m (bg-only reset), but the block
		// cursor emits a full \x1b[0m mid-line — re-open bg after each one.
		const bgOpen = theme.bg("userMessageBg", "").slice(0, -"\x1b[49m".length);
		return super
			.render(width)
			.map((line) => theme.bg("userMessageBg", line).split("\x1b[0m").join(`\x1b[0m${bgOpen}`));
	}
}

type GitState = { status: string; branch: string | null };
type BatteryState = { text: string };

function parsePorcelain(out: string): string {
	let ahead = 0;
	let behind = 0;
	let staged = 0;
	let modified = 0;
	let untracked = 0;
	for (const line of out.split("\n")) {
		if (line.startsWith("## ")) {
			const m = line.match(/ahead (\d+)|behind (\d+)/g);
			for (const hit of m ?? []) {
				const n = Number(hit.split(" ")[1]);
				if (hit.startsWith("ahead")) ahead = n;
				else behind = n;
			}
		} else if (line.startsWith("??")) {
			untracked++;
		} else if (line.length >= 2) {
			if (line[0] !== " " && line[0] !== "?") staged++;
			if (line[1] === "M" || line[1] === "D") modified++;
		}
	}
	const parts: string[] = [];
	if (staged > 0) parts.push(`${glyph.staged}${staged}`);
	if (modified > 0) parts.push(`${glyph.modified}${modified}`);
	if (untracked > 0) parts.push(`${glyph.untracked}${untracked}`);
	if (ahead > 0) parts.push(`⇡${ahead}`);
	if (behind > 0) parts.push(`⇣${behind}`);
	return parts.join(" ");
}

// v1: no Pi API exposes subscription windows, so this always resolves
// to undefined and the limits segment stays hidden (never 0%).
// Plug a provider usage source in here when one exists.
async function fetchLimits(): Promise<string | undefined> {
	return undefined;
}

async function readGit(pi: ExtensionAPI, cwd: string): Promise<GitState> {
	const [porcelain, branch] = await Promise.all([
		pi.exec("git", ["status", "--porcelain=v1", "-b"], { cwd, timeout: 2000 }).catch(() => undefined),
		pi.exec("git", ["branch", "--show-current"], { cwd, timeout: 2000 }).catch(() => undefined),
	]);
	if (!porcelain || porcelain.code !== 0) return { status: "", branch: null };
	const name = branch && branch.code === 0 ? branch.stdout.trim() : "";
	return { status: parsePorcelain(porcelain.stdout ?? ""), branch: name || null };
}

async function readBattery(pi: ExtensionAPI): Promise<BatteryState> {
	if (process.platform === "darwin") {
		const result = await pi.exec("pmset", ["-g", "batt"], { timeout: 2000 }).catch(() => undefined);
		const m = result?.stdout.match(/(\d+)%;\s*(charging|discharging|charged)/);
		if (!m) return { text: "" };
		return { text: `${glyph.battery} ${m[1]}%` };
	}
	if (process.platform === "linux") {
		const result = await pi
			.exec("sh", ["-c", "cat /sys/class/power_supply/BAT*/capacity 2>/dev/null | head -1"], {
				timeout: 2000,
			})
			.catch(() => undefined);
		const pct = result?.stdout.trim();
		if (!pct || !/^\d+$/.test(pct)) return { text: "" };
		return { text: `${glyph.battery} ${pct}%` };
	}
	return { text: "" };
}

function sessionCost(ctx: ExtensionContext): number {
	let cost = 0;
	for (const e of ctx.sessionManager.getBranch() as any[]) {
		if (e.type === "usage") cost += e.usage?.cost?.total ?? 0;
		else if (e.type === "message" && e.message?.role === "assistant") {
			cost += e.message.usage?.cost?.total ?? 0;
		} else if (e.type === "message" && e.message?.role === "toolResult" && e.message.usage) {
			cost += e.message.usage.cost?.total ?? 0;
		} else if ((e.type === "branch_summary" || e.type === "compaction") && e.usage) {
			cost += e.usage.cost?.total ?? 0;
		}
	}
	return cost;
}

function cacheHitRate(ctx: ExtensionContext): number | undefined {
	const branch = ctx.sessionManager.getBranch() as any[];
	for (let i = branch.length - 1; i >= 0; i--) {
		const e = branch[i];
		if (e.type === "message" && e.message?.role === "assistant") {
			const u = e.message.usage;
			const total = (u?.input ?? 0) + (u?.cacheRead ?? 0) + (u?.cacheWrite ?? 0);
			return total > 0 ? (u.cacheRead / total) * 100 : undefined;
		}
	}
	return undefined;
}

// A middle content item. priority: lowest drops first on narrow widths.
// The user/time anchors are not items, so they are never dropped.
interface Item {
	text: string;
	fg: Color;
	priority: number;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		// Footer/editor are TUI components; RPC has dialogs but no custom
		// terminal rendering, and print/JSON have no UI at all.
		if (ctx.mode !== "tui") return;

		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) => new BlockEditor(tui, theme, keybindings, () => ctx.ui.theme),
		);

		let tuiRef: TUI | undefined;
		let git: GitState = { status: "", branch: null };
		let battery: BatteryState = { text: "" };
		let limits: string | undefined;
		let cost = 0;
		let cacheHit: number | undefined;

		const refresh = async () => {
			const [g, b, l] = await Promise.all([
				readGit(pi, ctx.cwd),
				readBattery(pi),
				fetchLimits(),
			]);
			git = g;
			battery = b;
			limits = l;
			// Session totals change only on turn boundaries, so cache them
			// here instead of re-walking the branch on every render.
			cost = sessionCost(ctx);
			cacheHit = cacheHitRate(ctx);
			tuiRef?.requestRender();
		};
		void refresh();
		const timer = setInterval(() => void refresh(), 10000);

		const rerender = () => tuiRef?.requestRender();
		const offModel = pi.on("model_select", rerender);
		const offTurn = pi.on("turn_end", () => void refresh());

		ctx.ui.setFooter((tui, theme, footerData) => {
			tuiRef = tui;
			const offBranch = footerData.onBranchChange(() => void refresh());
			return {
				dispose: () => {
					clearInterval(timer);
					offBranch();
					offModel();
					offTurn();
					tuiRef = undefined;
				},
				invalidate() {},
				render(width: number): string[] {
					const usage = ctx.getContextUsage();
					const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;

					const middle: Item[] = [
						{ text: `${glyph.dir} ${shortCwd(ctx.cwd)}`, fg: pal.blue, priority: 90 },
					];

					const branch = footerData.getGitBranch() ?? git.branch;
					if (branch) {
						middle.push({
							text: git.status
								? `${glyph.branch} ${branch} ${git.status}`
								: `${glyph.branch} ${branch}`,
							fg: pal.green,
							priority: 80,
						});
					}

					if (ctx.model) {
						const multi =
							footerData.getAvailableProviderCount() > 1 ? `(${ctx.model.provider}) ` : "";
						const thinking = pi.getThinkingLevel();
						const effort = thinking === "off" ? "thinking off" : thinking;
						middle.push({
							text: `${multi}${ctx.model.id} · ${effort}`,
							fg: pal.purple,
							priority: 70,
						});
					}

					if (usage && usage.percent !== null && usage.percent !== undefined) {
						const pct = Math.round(usage.percent);
						middle.push({
							text: `ctx ${pct}%/${formatTokens(window)}`,
							fg: pct > 90 ? pal.red : pct > 70 ? pal.yellow : pal.green,
							priority: 50,
						});
					}
					if (cacheHit !== undefined) {
						middle.push({ text: `CH${cacheHit.toFixed(0)}%`, fg: pal.dim, priority: 30 });
					}
					if (cost > 0) {
						middle.push({ text: `$${cost.toFixed(3)}`, fg: pal.dim, priority: 20 });
					}
					if (limits) middle.push({ text: limits, fg: pal.dim, priority: 10 });

					const tail: string[] = [`${glyph.time} ${timeFmt.format(new Date())}`.trim()];
					if (battery.text) tail.push(battery.text);

					// Drop lowest-priority middle items until the plain-text
					// estimate fits; user/time anchors always stay.
					const user = process.env.USER ?? "eric";
					const chrome = 8 + visibleWidth(tail.join(" ")) + visibleWidth(user) + 4;
					let items = middle;
					while (items.length > 0) {
						const estimate =
							chrome + items.reduce((n, item) => n + visibleWidth(item.text) + 2, 0);
						if (estimate <= width) break;
						const drop = [...items].sort((a, b) => a.priority - b.priority)[0];
						items = items.filter((item) => item !== drop);
					}

					if (!nerdFont) {
						const parts = [user, ...items.map((i) => i.text), tail.join(" ")];
						return [truncateToWidth(parts.join(glyph.plainSep), width)];
					}

					const block = (text: string, fg: Color, bg: Color): string =>
						theme.style(` ${text} `, { fg, bg, bold: true });
					const trans = (from: Color, to: Color): string =>
						theme.style(glyph.sep, { fg: from, bg: to });

					let line = theme.style(glyph.capL, { fg: pal.surface0 });
					line += block(`\uf035 ${user}`, pal.mono0, pal.surface0);
					line += trans(pal.surface0, pal.surface1);
					for (const item of items) {
						line += block(item.text, item.fg, pal.surface1);
					}
					line += trans(pal.surface1, pal.surface0);
					line += block(tail.join(" "), pal.blue, pal.surface0);
					line += theme.style(glyph.capR, { fg: pal.surface0 });

					return [truncateToWidth(line, width)];
				},
			};
		});
	});
}
