# pi-one-dark-pro-glass-theme

One Dark Pro Glass theme plus a starship-style statusline and a
background-filled input block for [Pi](https://pi.dev) interactive mode.
Ported from the same source as `paseo-one-dark-pro-glass-theme`
(upstream `bukitoka/one-dark-pro-max` `one-dark-pro-glass.json` for Zed,
via the Otty port).

## What you get

- **Theme** (`themes/one-dark-pro-glass.json`) — near-black glass
  palette in `okhsl()` (Pi 1.0 style, converted from the `#080909`
  originals), One Dark Pro syntax colors.
- **Statusline** — powerline footer blocks like the terminal bar:

```text
 eric  ~/proj  branch status  model · effort  ctx 42% CH91%  $0.042   02:45 
```
(user on surface0, content on surface1, time on surface0)

  workdir, git branch + status counts, model + thinking level, context
  usage, cache-hit rate, session cost, HKT time + battery. Needs a Nerd
  Font (e.g. JetBrainsMono Nerd Font); `NO_NERD_FONT=1` falls back to
  ASCII. Narrow terminals drop segments by priority, keeping the
  user/time anchors.
- **Input block** — accent `─` borders on a `#101214` background fill,
  1-cell inner padding (adjustable via `/settings` → `editorPaddingX`,
  0–3).
- **Compact output** (`extensions/compact-output.ts`) — result-oriented
  transcript: `read`/`bash`/`grep`/`find`/`ls` collapse to one line
  (e.g. `$ pnpm test` → `✓ done (12 lines)`), full content on expand
  (`ctrl+e`). Counts use the tools' truncation metadata, with a
  `(truncated)` marker when the output was cut. `edit`/`write` diffs
  stay visible. Shares helpers with the diff view via
  `extensions/render-shared.ts` (not an extension, not toggleable).
- **Diff view** (`extensions/diff-view.ts`) — `edit` renders side-by-side
  old | new columns with syntax colors (falls back to unified below
  90 cols). Past 100 rows collapses to `... N more — view in PR`;
  `ctrl+e` expands.

Subscription limit windows (5h/weekly) stay hidden: the `meta`
provider exposes no programmatic quota surface, and the extension
never fabricates a `0%`. See `docs/spec.md` §6.3 for the probe notes;
`fetchLimits()` in the extension is the hook for a future source.

## Install

```bash
pi install git:github.com/eric1234463/pi-one-dark-pro-theme
```

Then in Pi: `/settings` → **Theme** → `one-dark-pro-glass`.
The extension activates on next session (or `/reload`).

Local preview without installing:

```bash
pi -e ./extensions/one-dark-pro-glass.ts --theme ./themes --use-theme one-dark-pro-glass
```

## Layout

```text
├── package.json            # pi-package manifest
├── themes/one-dark-pro-glass.json
├── extensions/one-dark-pro-glass.ts   # statusline + input block
├── extensions/render-shared.ts        # shared tool-render helpers
├── extensions/compact-output.ts       # one-line tool results
├── extensions/diff-view.ts            # side-by-side edit diffs
└── docs/spec.md            # design spec + decision log (D1–D9)
```

No runtime dependencies. Host packages
(`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`) are
`peerDependencies` and must not be installed alongside.
