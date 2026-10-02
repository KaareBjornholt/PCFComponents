# PCFComponents Project Instructions

## Available Skills (load automatically)

You have 9 domain skills in `.claude/skills/`. Use them based on the task:

| Skill | When to Use |
|---|---|
| `pcf-controls` | Building, deploying, and using PowerApps Component Framework (PCF) controls — field controls, dataset controls, React virtual controls. |
| `plan-with-team` | Planning/architecting any Power Platform app. Spawn an Agent Team with Data Architect, UX Designer, and The Skeptic. |
| `dataverse-web-api` | Creating Dataverse schema (tables, columns, relationships, views, forms) via the Web API. |
| `dataverse-web-resources` | Creating, deploying, and managing web resources (JS form scripts, HTML dashboards, images). |
| `dataverse-plugins` | Developing and deploying C# Dataverse plugins for server-side business logic. |
| `power-apps-code-apps` | Building Code App frontends with React/Vue/TS using the @microsoft/power-apps SDK. |
| `code-review` | Deep code audit — finds dead wiring, silent failures, placeholders, bloated files, dead code. Produces graded report with pruning plan. |
| `visual-qa` | Testing any web app visually — record actions, caption expected behavior, review with Gemini. |
| `record-screen` | Recording the screen for visual review or QA documentation. |

## Standard Workflow

When building or extending a PCF control, follow this sequence:

1. **Plan** — Use `plan-with-team` to spawn an Agent Team. Specialists debate and produce a consolidated plan. Get user approval before proceeding.
2. **Build Control** — Use `pcf-controls` to scaffold, build, and deploy PCF field or dataset controls.
3. **Build Schema** — If Dataverse schema changes are needed, use `dataverse-web-api` to create tables, columns, relationships, option sets, forms, and views.
4. **Review** — Use `code-review` to audit the codebase for dead wiring, missing error handling, placeholders, and dead code. Fix all CRITICAL findings before testing.
5. **Test** — Use `visual-qa` to walk through the control, record with captions, and optionally send to Gemini for AI review.

## Rules

- Always use Agent Teams for planning if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled.
- Always include the `MSCRM.SolutionUniqueName` header when creating or updating Dataverse components.
- Use `pac pcf push` to deploy controls during development; use `pac solution build` + import for production.
- Run `npm run build` before pushing — never push a broken build.
- When testing controls, use the PCF test harness (`npm start`) before deploying to an environment.
- Always use environment variables for any configuration that differs across environments. Never hardcode org URLs or GUIDs.
- When designing controls that interact with Dataverse, always consult `dataverse-web-api/resources/dataverse-design-rules.md` before designing schema.
- Always define a security model during planning. PCF controls inherit field-level security — plan column-level security accordingly.
- When registering plugins triggered by control actions, ALWAYS define filtering attributes to avoid triggering on autosave.

## Best Practices

- **No placeholder columns** — Never create empty columns "to be configured later."
- **No rollup fields** — Prefer code-based aggregation or server-side plugins over rollup field configuration via API.
- **PowerShell only** — On Windows, always use `.ps1` scripts for Dataverse API calls. Bash/curl mangles OData `$` parameters.
- **Primary name column** — Every Dataverse POST must include the primary name column (inspect metadata first — it's not always `prefix_name`).
- **Never silently swallow errors** — At minimum `console.error`, ideally show user feedback. Silent catch blocks hide real issues.
- **Dataverse POST returns 204** — A null return from POST means success, not failure. Use `Prefer: return=representation` to get the created record back.
- **Lookup @odata.bind is lowercase** — Navigation property names for `@odata.bind` must use the column logical name (lowercase), not the SchemaName.
- **Audit frontend-backend wiring** — Every service function needs a caller, every store action needs UI.
- **PCF manifest** — Keep `ControlType`, `property` types, and `data-set` definitions accurate — mismatches cause silent failures in the test harness.

## Dataverse API Authentication

Before making any Dataverse Web API calls:

1. Run `pac auth list` to check if already connected.
2. If not connected, run `pac auth create --environment <org-url>` and follow the prompts.
3. For every API call, get a fresh token via Azure CLI:
   ```powershell
   $token = az account get-access-token --resource "https://[org].crm6.dynamics.com/" --tenant "[tenant-id]" --query accessToken -o tsv
   ```
4. Use the token as `Authorization: Bearer <token>` in all HTTP requests.

Tokens expire after ~1 hour. If a call returns 401, get a fresh token and retry.

**IMPORTANT:** On Windows, always use PowerShell `.ps1` scripts for Dataverse API calls. Bash/curl mangles OData `$` parameters (`$filter`, `$select`, etc.).

```powershell
$token = az account get-access-token --resource "https://org.crm6.dynamics.com/" --tenant "your-tenant-id" --query accessToken -o tsv
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json; charset=utf-8"
    "OData-Version" = "4.0"
    "MSCRM.SolutionUniqueName" = "MySolution"
}
Invoke-RestMethod -Uri "https://org.crm6.dynamics.com/api/data/v9.2/EntityDefinitions" -Method POST -Headers $headers -Body ($payload | ConvertTo-Json -Depth 10)
```

## Environment

- Platform: macOS (Darwin)
- Project type: PowerApps Component Framework (PCF) — multi-control project
- Build tool: `pcf-scripts` (npm scripts: `build`, `start`, `start:watch`, `rebuild`)
- Agent Teams enabled (experimental)
- Auth via `pac auth` CLI
