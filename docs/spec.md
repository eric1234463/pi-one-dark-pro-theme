# pi-one-dark-pro-glass-theme — Spec

## 1. Goal

Personal Pi package that makes interactive `pi` look like the terminal
One Dark Pro Glass theme, tightens the input box, and extends the
statusline with subscription limit readouts.

Scope is deliberately narrow:

1. `themes/one-dark-pro-glass.json` — dark Pi theme ported from the
   same source as `paseo-one-dark-pro-glass-theme` (upstream
   `bukitoka/one-dark-pro-max` / Otty `one-dark-pro-glass`).
2. `extensions/one-dark-pro-glass.ts` — borderless editor (zero side
   padding, no top/bottom border lines) + custom plain-segment footer
   in starship style (`dir | branch status | model | context | cost |
   limits | time`).

Decisions (user-confirmed):

- D1 — footer style: plain segments, no powerline blocks.
- D2 — input box: ~~borderless~~ superseded by D5 below.
- D3 — extras: git status counts, session cost, time + battery — all on.
- D5 — input box: bordered block with background fill (user revision
  of D2). Accent `─` borders on `selectedBg`; full-block bg fill.

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
│   └── one-dark-pro-glass.ts  # borderless editor + starship footer
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

1. `pi -e <this-package>` in a git repo shows One Dark Pro Glass
   colors, tight input (no side padding), footer line 1
   `~/proj (main)`, line 2 with `↑ ↓ R W CH% …ctx%… model • level`.
2. On a subscription provider exposing both windows, a third footer
   line reads `5h N% · W N%`; on API-key-only providers the line is
   absent (not `0%`).
3. Narrow (80-col) resize: no wrapped/overflowing statusline, no crash.
4. `/reload` with theme/extension changed: no errors, rendering intact.
5. Non-TUI (`pi -p "hi"`): no extension errors.

## 9. Open questions

- O1: Which provider(s) do you actually use in Pi (Claude/Codex/Grok/
  Kimi)? Decides the limits-spike target. Assume: whatever Pi's
  default auth surfaces first; confirm before build.
- O2: "effort" = thinking level (`minimal..max`)? Assume yes (matches
  footer `• {level}`); say if you mean something else.
- O3: Limits as used-% vs remaining-%? Spec uses used-% (matches Paseo
  pill semantics); one-word confirm.
