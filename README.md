# bloomwright-ui

> A DaisyUI-based **Astro UI kit and render core** — presentation components and their pure
> domain logic, plus the **ECharts SSR engine** and the **Mermaid render pipeline** (with a
> caller-owned render port), client web components, styles, and shared types.

`bloomwright-ui` owns **rendering** ("how a chart/diagram/component becomes UI"). It is
consumed by:

1. **Astro applications** — as a component library and render core, and
2. **[`bloomwright-mdx`](../bloomwright-mdx)** — the extraction layer that parses code fences
   and drives this package's rendering workflows.

The dependency graph points **into** `bloomwright-ui` and never out of it (a ui→mdx import
would be a cycle). It is **not** a dependency-free leaf: it depends on rendering libraries
(`echarts`, `hast-util-*`, `unist-util-visit`, `postcss`) and on `astro`. It still must not
import a host app or `bloomwright-mdx`, and reads **no** ambient environment — all inputs
(render pipeline, cache store, themes) are injected.

```
your-astro-app ─▶ bloomwright-mdx (extraction) ─▶ bloomwright-ui (render core)
      └───────────────────────────────────────▶ bloomwright-ui
```

## Status

✅ **v0.3 implemented (render core + `mermaidRenderer`).** Components, resolvers, runtime
elements, styles, the ECharts SSR engine, the Mermaid pipeline + injected render port, the
cache/addressing, and now the **`mermaidRenderer()` Astro integration** that owns Mermaid SVG
creation end to end (pre-scan → batch render → emit → bridge) are in place and green
(`typecheck`, **112 unit tests**, `guard:leaf`, and the `examples/` app's `astro build` +
`astro check`). `bloomwright-mdx` only emits `<MermaidDiagram code>`; this package renders it.
See [`EPIC.md`](./EPIC.md) and [`SPEC.md`](./SPEC.md).

## What's inside

| Area | Contents |
|------|----------|
| **display** | `Callout`, `ChatBubble`, `List`, `Steps`, `MockupBrowser`, `MockupPhone`, `MockupWindow`, `SectionHeader` |
| **primitive** | `SVGIcon`, `Button`, `GlassPanel`, `OverlayPanel` |
| **prose** (generic MDX surfaces) | `CodeBlock`, `ProseTable`, `HeadingAnchor`, `VideoPlayer` |
| **render** (`components/render/*`) | `EChart`, `MermaidDiagram`, `MermaidDiagramWrapper` |
| **echarts** (`bloomwright-ui/echarts`) | SSR-to-SVG engine, fence-definition parse/compile, markup, artifact store |
| **mermaid** (`bloomwright-ui/mermaid`) | batch pipeline, transform/theme/palette, build-context bridge, discovery pre-scan, `MermaidRenderPipeline` port, `fixtureRenderPipeline` |
| **mermaid-renderer** (`bloomwright-ui/mermaid-renderer`) | the `mermaidRenderer()` Astro integration — owns Mermaid SVG creation (register alongside `bloomwrightMdx()`) |
| **cache** (`bloomwright-ui/cache`) | `DiagramCacheStore` port + `createDiskCacheStore` default + addressing helpers |
| **logic** (pure, framework-free) | `callout`, `chat`, `list`, `steps`, `section-header` resolvers |
| **runtime** (client web components) | `overlay-panel`, `video-player-shell`, `echart-shell`, `mermaid-diagram-shell` |
| **types / styles** | `Icon`, `ButtonVariant`, …; component CSS + a DaisyUI include preset |

## Install (once published)

```bash
npm install bloomwright-ui
# peers you already own in an Astro app:
npm install astro tailwindcss daisyui echarts
```

`astro`, `tailwindcss`, `daisyui`, and `echarts` are **peer dependencies** — bloomwright-ui
uses the single copy your app installs.

## Usage

Components:

```astro
---
import Callout from "bloomwright-ui/components/display/Callout.astro";
import EChart from "bloomwright-ui/components/render/EChart.astro";
import type { Icon } from "bloomwright-ui";
---
<Callout variant="warning" title="Heads up">Content…</Callout>
<EChart option={{ xAxis: { type: "category", data: ["A","B"] }, yAxis: {}, series: [{ type: "bar", data: [3,7] }] }} />
```

Render core (typically driven by `bloomwright-mdx`, but usable directly):

```ts
import { renderEChartSvg } from "bloomwright-ui/echarts";
import { createPipeline, fixtureRenderPipeline, type MermaidRenderPipeline } from "bloomwright-ui/mermaid";
import { createDiskCacheStore } from "bloomwright-ui/cache";
```

The **Mermaid render pipeline is caller-owned** (SPEC §4.7): production SVGs come from a
`MermaidRenderPipeline` you supply. bloomwright-ui only ever invokes its built-in
`fixtureRenderPipeline` (dev/tests) — a reference production pipeline lives in the
bloomwright-mdx `examples/reference/` directory.

```css
/* your app's global.css */
@import "tailwindcss";
@plugin "daisyui" { themes: light, dark; include: "button","card","badge","mockup","steps","chat","list","modal","table","input","select"; }
@source "../node_modules/bloomwright-ui/src";
@import "bloomwright-ui/styles.css";
```

## Develop

```bash
npm install
npm run typecheck     # tsc --noEmit
npm test              # vitest
npm run guard:leaf    # assert no host/bloomwright-mdx imports AND no ambient env reads leaked in
```

Live smoke test — a dev-only Astro app that renders every component through the package
`exports` map (not published):

```bash
cd examples
npm install
npm run build         # astro build
npm run check         # astro check
npm run dev           # interactive gallery
```

## License

MIT © Alberto Duran
