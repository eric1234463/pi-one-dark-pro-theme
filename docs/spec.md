# pi-one-dark-pro-glass-theme — Spec

## 1. Goal

Personal Pi package that makes interactive `pi` look like the terminal
One Dark Pro Glass theme, tightens the input box, and extends the
statusline with subscription limit readouts.

Scope is deliberately narrow:

1. `themes/one-dark-pro-glass.json` — dark Pi theme ported from the
   same source as `paseo-one-dark-pro-glass-theme` (upstream
   `bukitoka/one-dark-pro-max` / Otty `one-dark-pro-glass`).
2. `extensions/one-dark-pro-glass.ts` — input block (accent borders on
   `#101214` fill, 1-cell padding) + custom plain-segment footer in
   starship style (`dir | branch status | model | context | cost |
   limits | time`).
3. `extensions/compact-output.ts` — result-oriented transcript:
   `read`/`bash`/`grep`/`find`/`ls` collapse to one line, `edit`/`write`
   diffs stay visible.

Decisions (user-confirmed):

- D1 — footer style: plain segments, no powerline blocks.
- D2 — input box: ~~borderless~~ superseded by D5 below.
- D3 — extras: git status counts, session cost, time + battery — all on.
- D5 — input box: bordered block with background fill (user revision
  of D2). Accent `─` borders on `userMessageBg`; full-block bg fill.
- D6 — compact output: read-only tools collapse to one line;
  edit/write diffs stay visible.

## 2. Non-goals

- No powerline block backgrounds in the footer (D1); plain colored
  text with ` | ` separators only.
- No per-provider OAuth scraping in v1 beyond what Pi exposes. Missing
  limit windows hide the segment, never display as zero.
- No light-theme variant, no HTML-export overrides beyond what falls out
  of the palette.

## 3. Package layout (Pi package, conventional dirs)

```text
pi-one-dark-pro-glass-theme/
├── package.json            # name, keywords ["pi-package"], pi manifest
├── themes/
│   └── one-dark-pro-glass.json
├── extensions/
│   ├── one-dark-pro-glass.ts  # input block + starship footer
│   └── compact-output.ts       # one-line read-only tool results
├── docs/
│   └── spec.md             # this file
└── README.md
```

`package.json` declares host packages as `peerDependencies: "*"`
(`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`), never in
`dependencies`. Ships with `pi` manifest pointing at `themes/` and
`extensions/`.

## 4. Theme — `one-dark-pro-glass.json`

- `name`: `one-dark-pro-glass`, `appearance`: `dark`.
- Base palette (verbatim from the Paseo port, which documents the Otty
  source per role):

| Token      | Value     | Source role                              |
|------------|-----------|------------------------------------------|
| background | `#080909` | window bg, alpha stripped (`#080909DD`)  |
| foreground | `#D7DAE0` | mono0 / primary text                     |
| raised     | `#101214` | near-black panel (NOT `#2C313A`)         |
| control    | `#2C313A` | element bg (inputs, selected rows)       |
| border     | `#3E4452` | selection bg; visible edge on `#080909`  |
| accent     | `#61AFEF` | syntax.function / active indicator       |
| muted      | `#ABB2BF` | mono1 / secondary text                   |
| ring       | `#4E5666` | scrollbar thumb, alpha stripped          |

- Syntax colors from One Dark Pro (standard values, to confirm against
  terminal during review): red `#E06C75`, green `#98C379`, yellow
  `#E5C07B`, blue `#61AFEF`, purple `#C678DD`, cyan `#56B6C2`,
  comment `#5C6370`, orange `#D19A66`.
- Mapping to required Pi theme roles (`theme-schema.json`):

| Pi role                              | Value source                          |
|--------------------------------------|---------------------------------------|
| `text` / `userMessageText`           | foreground `#D7DAE0`                  |
| `muted`                              | muted `#ABB2BF`                       |
| `dim`, `borderMuted`                 | comment `#5C6370`                     |
| `border`                             | border `#3E4452`                      |
| `borderAccent` / `accent`            | accent `#61AFEF`                      |
| `selectedBg`                         | control `#2C313A`                     |
| `userMessageBg` / tool bgs          | raised `#101214` / control `#2C313A`  |
| `success`                            | green `#98C379`                       |
| `error` / `toolDiffRemoved`          | red `#E06C75`                         |
| `warning`                            | yellow `#E5C07B`                      |
| `syntax*`                            | One Dark Pro syntax set above         |
| `thinkingLow..Xhigh`                 | blue→purple ramp ending accent/purple |
| `thinkingOff`                        | dim; `bashMode` accent                |

- Validation: `pi --use-theme one-dark-pro-glass` starts clean, no
  "invalid theme" warning; `/reload` hot-reloads; contrast spot-check
  body text ≥ 4.5:1 on `#080909`.

## 5. Input box — bordered block with bg fill (D5, supersedes D2)

- Extension registers a `BlockEditor` (`CustomEditor` subclass) with
  `{ paddingX: 1 }` (was 0; user wants a little breathing room).
  `setPaddingX` is NOT clamped — `/settings` → `editorPaddingX` (0–3)
  works live, Pi pushes changes through.
- Borders: accent-fg `─` lines on `userMessageBg` bg (via
  `theme.style(raw, { fg: "accent", bg: "userMessageBg" })`).
- Fill: every rendered line (content + autocomplete) gets a full-width
  `userMessageBg` (`#101214` raised near-black) fill via `theme.bg()`.
  (Was `selectedBg #2C313A`; user asked for deeper to match terminal.)
  `theme.bg` closes with `\x1b[49m` (bg-only reset), but the block cursor
  emits a full `\x1b[0m` mid-line — bg is re-opened after each one.
- Theme is read live per render (`() => ctx.ui.theme`), so `/settings`
  theme switches apply with no stored ANSI.
- Guard: installed only when `ctx.hasUI`; RPC/JSON/print paths return
  early.

## 6. Statusline

### 6.1 Layout: custom plain-segment footer (D1, D3)

One line, ` | ` (dim) separators, Nerd Font glyphs (JetBrainsMono Nerd
Font in use):

```text
󰉋 ~/proj |  main 󰷫2 1 | meta/muse-spark-1.3 · high | ctx 42%/200k CH91% | $0.042 | 5h 62% · W 31% | 󰥔 02:45 󰁹 87%
```

Field colors mirror starship: dir accent-blue, branch success-green,
status counts warning-orange, model/effort muted, ctx % by threshold
(>90 error, >70 warning), cost dim, time accent-blue. `provider/`
prefix only when >1 provider (via
`footerData.getAvailableProviderCount()`). Right-side overflow is
truncated (time drops first). Git status comes from
`git status --porcelain=v1 -b` (staged/modified/untracked/ahead/behind,
zero buckets omitted); branch itself from `footerData.getGitBranch()`.
Time is HKT; battery via `pmset` (macOS) / sysfs (Linux), hidden when
unavailable. Refresh: session start, `turn_end`, `model_select`, branch
change, plus 10 s interval.

### 6.2 Field rules

- `5h`: session-window utilization. `W`: weekly-window utilization.
  Percentages = used (not remaining), rounded to whole numbers.
- Conditional display: both windows → `5h N% · W N%`; one window →
  that pill only; neither → segment hidden (no `—`, no `0%`).
- Never imply zero/unlimited: fetch failure, unauthenticated provider,
  or API-key billing (no subscription window) hides the segment.
- Near-limit color: `≥90%` error, `≥70%` warning, else dim (reuse theme
  helpers; compute outside render path).
- Truncation: single line, sanitized (no `\r\n\t`), Pi truncates to
  width. Key `limits` sorts alphabetically among extension statuses —
  acceptable for v1.

### 6.3 Limits data source — meta spike DONE (D4: keep hidden)

Probed 2026-10-02 for `meta/muse-spark` (OAuth subscription,
`https://api.meta.ai/v1`, `openai-responses`):

- Pay-as-you-go has only per-minute RPM/TPM caps (Standard 3000/4M),
  no 5h/weekly windows. The documented per-response rate-limit headers
  do not arrive in practice (verified live: 200 responses carry only
  `x-request-id`); no usage endpoint exists in the API reference —
  usage lives on the web dashboard only.
- Muse subscription has a 5h prompt window (10–50 prompts/5h by plan)
  but exposes no programmatic remaining-quota surface.
- Pi itself surfaces no usage API (`dist/*.d.ts` grep confirmed).

D4 (user-confirmed): limits segment stays hidden on meta — never 0%.
`fetchLimits()` in the extension is the hook for a future official
source.

## 7. Settings

No new settings in v1. Honors existing `theme`, `editorPaddingX`,
`tuiMode`. README documents: install via `pi install <source>`,
select theme in `/settings`, done.

## 8. Acceptance

1. Fresh `pi` in a git repo: glass colors, `#101214` input block with
   1-cell padding, one-line footer
   `󰉋 dir |  branch | model · effort | ctx% CH% | $cost | time`.
2. Tool calls: `read`/`bash`/`grep`/`find`/`ls` render one line
   (`✓ done (N lines)`); `ctrl+e` expands full output; `edit` shows
   the diff.
3. Narrow (80-col) resize: no wrapped/overflowing statusline.
4. `/reload` after changes: no errors. Non-TUI (`pi -p`): no errors.

## 9. Open questions — all answered

- O1: `meta/muse-spark` (→ D4).
- O2: yes, effort = thinking level.
- O3: used-% (moot while limits hidden).

## 10. Compact output (D6)

- New file `extensions/compact-output.ts`, separate manifest entry so
  it can be disabled independently via `pi config`.
- Same-name `registerTool` replaces the built-ins; originals are
  spread in, only `renderCall`/`renderResult` overridden +
  `renderShell: "self"` (no box chrome). Execution untouched; only
  read-only tools are overridden, so file-mutation queue semantics
  cannot be affected.
- Collapsed: `read path` → `N lines`; `$ cmd` → `✓ done (N lines)` /
  `✗ exit N (M lines)`; `grep` → `N matches` / `no matches`;
  `find` → `N paths`; `ls` → `N entries`. Errors show their first
  line in error color. Expanded (`ctrl+e`): first 15–20 dim lines +
  `... N more`.
- Verified: overridden definitions execute correctly in `-p` mode.

## 11. Side-by-side edit diffs (D7)

- New file `extensions/diff-view.ts`, separate manifest entry
  (independently toggleable via `pi config`). Overrides `edit` only;
  `write` stays default.
- Same-name `registerTool` over `createEditToolDefinition(cwd)` +
  `renderShell: "self"`. Parses `details.diff` (`+<num>` / `-<num>` /
  context / `...` separators) and pairs del/add runs into old | new
  rows. Removed lines red, added green (theme `toolDiff*`); context
  dim full-width.
- Syntax colors: each side highlighted as one block via
  `highlightCode(text, getLanguageFromPath(path))`, mapped back per
  line (line count preserved). Unknown language → plain.
- Layout happens in a custom `Component.render(width)` at the real
  terminal width — never pre-render to fixed-width `Text` (`Text`
  word-wraps and would break column alignment). Below 90 cols falls
  back to unified single-column.
- Row cap 100 (D7): collapsed shows first 100 rows +
  `... N more — view in PR`; `ctrl+e` shows all. Path for file args
  comes from `context.args`, not the result.
- Verified: real `edit` in `-p` mode applies + renders without error.
  TUI column alignment needs eyeball check.
