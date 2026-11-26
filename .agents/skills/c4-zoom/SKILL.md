---
name: c4-zoom
description: >-
  Use c4-zoom to explore a C4 map, turn Structurizr workspace JSON or DSL into
  a single offline HTML file, or investigate load errors, missing elements,
  and unexpected relationships in a map loaded from a workspace.
  Excludes general C4 modeling, individual Structurizr view exports, and
  development of c4-zoom itself.
license: MIT
compatibility: >-
  Requires a c4-zoom viewer or checkout for the chosen workflow.
  Running the checkout uses Node.js 26+ and pnpm 10+.
  DSL conversion uses official Structurizr tooling or Docker.
---

# Use c4-zoom

Use c4-zoom to explore the static C4 model as a continuous map or deliver it as one offline HTML file.

Use a running viewer or a local checkout for the commands below. [c4-zoom repository](https://github.com/ta-dadadada/c4-zoom)

## Route the request

- For an existing map or a request to inspect a model, use **Explore**.
- For a single offline HTML deliverable from workspace JSON or DSL, use **Export**.
- For a load failure, missing element, or unexpected relationship, use **Diagnose**.

## Resolve the input

- Use the supplied official Structurizr workspace JSON directly. For DSL, use the official local or Docker export in [Workspace input](references/workspace-input.md#convert-dsl-to-workspace-json). Confirm that the export produced a fresh, nonempty JSON file and use its actual path.
- For demonstrations or smoke checks, use a viewer sample or the checkout's `docs/architecture/workspace.json`. For a requested project map, use the project's model.

## Explore

Open an existing standalone HTML directly in a browser. To inspect JSON, use a c4-zoom viewer with file loading enabled and choose **JSON を開く** or drop the file onto the map. To start a local viewer, run `pnpm install --frozen-lockfile` as needed and `pnpm dev` from the c4-zoom checkout. On narrow screens, open **メニュー** (accessible name **地図メニュー**) to reach the file and export controls.

Confirm the active workspace name in the first breadcrumb under **地図の現在地**. Map labels are drawn on Canvas 2D. For DOM-based browser automation, press `/` to open **スポット検索**, select the matching result, and verify the element name, details, and upstream or downstream relationships in the inspector. Use `1` for Context, `2` for Containers, and `3` for Components.

## Export

Use the CLI for repeatable builds. Set `--theme light` or `--theme dark`, `--title <title>`, and `--overrides <path>` as needed. From the c4-zoom checkout, reuse a current build or run `pnpm install --frozen-lockfile` and `pnpm build` as needed. Replace `./out/<exported>.json` with the actual input path and provide an explicit HTML output path in an existing directory.

```sh
pnpm c4-zoom build "./out/<exported>.json" -o "./architecture.html"
```

Keep the default precomputed layout for immediate rendering on open. Check `pnpm c4-zoom build --help` for task-specific options. Use `--strict` when the output must be rejected on warnings, and `--allow-file-drop` when recipients need to load another JSON in the standalone viewer.

Use browser export to capture the current theme and manual placement. Confirm that the intended model finished loading, apply any requested changes, choose **HTML を書き出す**, and locate the downloaded HTML.

For either route, open the produced file via `file://` and use the breadcrumb and search checks in **Explore** to verify the workspace and an expected element. Return the actual output path, relevant diagnostics, and any checks that could not run. Treat the HTML with the same sensitivity as the source workspace because it embeds model data, including descriptions and properties.

## Diagnose

- For CLI diagnostics, read stderr. In the viewer, a failed load opens **JSON 診断** and can leave the previous map visible. To see warnings or reopen the panel, choose **診断** with its count. On narrow screens, find it under **メニュー**. Resolve errors at the reported location and confirm the intended workspace after retrying.
- If content is missing, inspect the JSON's `model`, the relationship endpoints, and the [mapped fields and diagnostic severities](references/workspace-input.md#mapped-fields). Compare the expected items and relationships with the active workspace before reporting the cause.
- If the CLI or viewer template is missing, run `pnpm build` from the checkout and retry. After a failed export, confirm that any HTML present belongs to the current run before handing it over.
