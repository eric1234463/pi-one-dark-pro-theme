# AGENTS.md

Pi package: One Dark Pro Glass theme + starship-style statusline +
background-filled input block + compact tool output.

## Layout

```text
├── package.json                  # pi-package manifest (keywords, peerDeps, pi.extensions/themes)
├── themes/one-dark-pro-glass.json
├── extensions/one-dark-pro-glass.ts   # input block + custom footer
├── extensions/compact-output.ts       # one-line read-only tool results
├── extensions/diff-view.ts            # side-by-side edit diffs
├── docs/spec.md                  # design spec + decision log (D1–D7)
└── README.md
```

## Source of truth

- Colors: `~/.config/otty/themes/one-dark-pro-glass.ottytheme`
  (port of `bukitoka/one-dark-pro-max`). Paseo sibling:
  `../paseo-one-dark-pro-glass-theme/index.client.tsx`.
- Pi theme doc: `pi.dev/docs/latest/themes`. Built-in reference:
  `dark.json` in the pi repo (`packages/coding-agent/src/modes/interactive/theme/`).
- Decisions D1–D7 live in `docs/spec.md`. Update the spec when a
  decision changes; keep README's feature list in sync.

## Theme rules (`themes/`)

- Filename must equal `name` (`one-dark-pro-glass.json`).
  `appearance: dark`, include `$schema`.
- All 52 required `colors` roles present (see `theme-schema.json`).
  `searchMatchBg`/`searchMatchText` may be omitted (documented
  fallbacks); `export` is explicit (`pageBg`/`cardBg`/`infoBg`).
- Hex only (`#RGB`/`#RRGGBB`) — no alpha, no `oklch`/`okhsl` here.
  Keep `vars` indirection acyclic; every `colors`/`export` ref must
  resolve.
- Slot discipline: `theme.style()` only accepts fg tokens in `fg` and
  bg tokens in `bg`. For a background fill use a `*Bg` token
  (`userMessageBg` = `#101214` raised; `selectedBg` = `#2C313A`
  control) or `theme.colors[token]` as a concrete `Color`.

## Extension rules (`extensions/`)

- Host types (`Theme`, `CustomEditor`, tool factories) import from
  `@earendil-works/pi-coding-agent` — never `pi-tui` for these
  (runtime works, `tsc` breaks). `Text`/`truncateToWidth` come from
  `@earendil-works/pi-tui`.
- `one-dark-pro-glass.ts`:
  - `BlockEditor extends CustomEditor`, `{ paddingX: 1 }`. Do NOT
    clamp `setPaddingX` — `/settings` → `editorPaddingX` (0–3) is live.
  - Fill via `theme.bg("userMessageBg", line)`; re-open bg after every
    `\x1b[0m` (the block cursor emits a full reset mid-line).
    Read theme live per render (`() => ctx.ui.theme`).
  - Footer is one ` | `-separated line (D1). Branch from
    `footerData.getGitBranch()`; status from
    `git status --porcelain=v1 -b` (2s timeout). Time in HKT.
    Battery hidden when unavailable. Limits segment hidden until
    `fetchLimits()` has a real source (D4, spec §6.3) — never `0%`.
  - Guard everything behind `ctx.hasUI`; non-TUI returns early.
- `diff-view.ts`:
  - Same-name `registerTool` over `createEditToolDefinition(cwd)` +
    `renderShell: "self"`. Overrides `edit` only.
  - Columns lay out in a custom `Component.render(width)` at the real
    terminal width; never pre-render fixed-width `Text` (it word-wraps
    and breaks alignment). <90 cols → unified fallback.
  - Row cap 100 + `... N more — view in PR`; `ctrl+e` expands. File
    path from `context.args`.
  - Same-name `registerTool` over `create*ToolDefinition(cwd)`,
    overriding only `renderCall`/`renderResult` + `renderShell: "self"`.
    Execution untouched. Only read-only tools (`read`/`bash`/`grep`/
    `find`/`ls`) — never `edit`/`write` (diffs stay visible).
  - Errors show first line in error color; `ctrl+e` expands to 15–20
    dim lines + `... N more`.
- `pi.exec` returns `{ stdout, code }` — the field is **`code`**,
  not `exitCode`. Always pass a `timeout` (2000ms) for polling commands.
- No runtime `dependencies`. Host packages stay in
  `peerDependencies: "*"`. New extension files need a manifest entry
  in `package.json` → `pi.extensions` (independently toggleable via
  `pi config`).

## Verify

```bash
# extension loads + executes (non-TUI smoke)
pi --no-session -p "reply with the single word ok" -e ./extensions/<file>.ts
# visual check (TUI): theme + footer + input block
pi -e ./extensions/one-dark-pro-glass.ts --theme ./themes --use-theme one-dark-pro-glass
```

Then `/reload` picks up edits (local path install). Keep lines short:
no new deps, no speculative features, no reformatting unrelated code.
