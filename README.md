# pi-one-dark-pro-glass-theme

One Dark Pro Glass theme plus a starship-style statusline and a
background-filled input block for [Pi](https://pi.dev) interactive mode.
Ported from the same source as `paseo-one-dark-pro-glass-theme`
(upstream `bukitoka/one-dark-pro-max` `one-dark-pro-glass.json` for Zed,
via the Otty port).

## What you get

- **Theme** (`themes/one-dark-pro-glass.json`) — near-black `#080909`
  glass palette, One Dark Pro syntax colors.
- **Statusline** — plain starship-style footer segments:

  ```text
  󰉋 ~/proj |  main 󰷫2 1 | meta/muse-spark-1.3 · high | ctx 42% CH91% | $0.042 | 󰥔 02:45 󰁹 87%
  ```

  workdir, git branch + status counts, model + thinking level, context
  usage, cache-hit rate, session cost, HKT time + battery. Needs a Nerd
  Font (e.g. JetBrainsMono Nerd Font).
- **Input block** — accent `─` borders on a `#101214` background fill,
  1-cell inner padding (adjustable via `/settings` → `editorPaddingX`,
  0–3).

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
├── extensions/one-dark-pro-glass.ts
└── docs/spec.md            # design spec + decision log (D1–D5)
```

No runtime dependencies. Host packages
(`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`) are
`peerDependencies` and must not be installed alongside.
