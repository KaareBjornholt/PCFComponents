# Plan: AccountLookupWithMapping PCF Control

## Context
In model-driven apps (Field Service), native field mapping does not apply when creating a record from a lookup's quick create form. The user wants field mapping from Work Order (`msdyn_workorder`) to Account when creating a new Service Account (`msdyn_serviceaccount` lookup → `account`) via quick create. Solution: a PCF React virtual field control that fully replaces the lookup — search existing accounts, clear, and a "+ New Account" button that opens the quick create form with `formParameters` built from a configurable JSON mapping.

User-confirmed decisions:
- Full lookup replacement (bound `Lookup.Simple`)
- Field mapping configurable via a JSON input property (no recompile to change)
- Standard Field Service tables (`msdyn_workorder.msdyn_serviceaccount` → `account`)

## Architecture Decision Record: alternatives considered

- **Ribbon button + custom quick create parameters** — rejected. Cannot intercept the native "+ New" click on a standard lookup without replacing the control itself; a ribbon button would only fire from a custom command, not the native `+`, so it doesn't solve the stated problem.
- **Power Automate flow (post-create field update)** — rejected. Fires after save, so the pre-filled quick-create UX is lost, and it introduces an async dependency/failure mode for what should be a synchronous interaction.
- **Canvas-embedded component** — not applicable; this is a model-driven form field, not a canvas app.
- **Verdict**: full PCF lookup replacement is the correct architecture given the constraint that the native `+` must be intercepted.

## Design
- **React virtual control** (`control-type="virtual"`, platform-provided React 16.8.6 + Fluent 9), namespace `Columbus` (matches existing project).
- **Source values**: `context.webAPI.retrieveRecord` on the current work order using `(context.mode as any).contextInfo` (`entityTypeName`, `entityId`). If the work order is unsaved (no entityId), open quick create without prefill.
- **Quick create**: `context.navigation.openForm({entityName: "account", useQuickCreateForm: true}, formParameters)`. On resolve, take `savedEntityReference[0]` (strip `{}` from GUID), set lookup via `getOutputs()` + `notifyOutputChanged()`. User cancel rejects the promise — swallow it.
- **Search**: debounced (300ms) `retrieveMultipleRecords("account", "?$select=name,accountid&$filter=contains(name,'…')&$top=10")`, escape single quotes.
- **Mapping property**: `of-type="Multiple"` input property `fieldMappingJson`, e.g.:
  ```json
  {
    "version": 1,
    "sourceEntity": "msdyn_workorder",
    "mapping": {
      "msdyn_address1": "address1_line1"
    }
  }
  ```
  - `version` — reserved for future breaking changes to the mapping shape (e.g. transforms, optionset value maps). Unused in v1 logic but present so old configs don't get silently misinterpreted later.
  - `sourceEntity` — guard key. Parser checks it against `contextInfo.entityTypeName` at runtime and warns (not throws) on mismatch, so copy-pasting the control onto a different form's lookup fails loudly instead of silently mismapping.
  - Parser validates a plain object with logical-name-shaped string keys/values; invalid entries dropped with warning; never throws into `updateView`. v1 supports simple-typed source columns only (text/memo/phone); lookups/optionsets documented as unsupported.
  - `mappingParser.ts` is written as pure functions with no PCF context dependency, so it can be unit-tested outside the harness — the one piece of business logic in this control that can be automated-tested.

## Reusability
- The control is pitched as configurable/reusable via JSON, so it should not hardcode the target entity in code. Add `targetEntity` as a second input property (default `"account"`) alongside `fieldMappingJson`, so the same control can be dropped onto other Field-Service-style lookups without a rebuild.

## Steps

1. **Scaffold** (from project root):
   ```
   pac pcf init --namespace Columbus --name AccountLookupWithMapping --template field --framework react
   npm install
   ```

2. **Manifest** (`AccountLookupWithMapping/ControlManifest.Input.xml`):
   - Bound property `value` of-type `Lookup.Simple`, required
   - Input property `fieldMappingJson` of-type `Multiple`, optional
   - Input property `targetEntity` of-type `SingleLine.Text`, optional, default `account`
   - `<platform-library name="React" version="16.8.6"/>`, `<platform-library name="Fluent" version="9.46.2"/>`
   - `<feature-usage>`: `WebAPI` and `Utility` required

3. **Files** (all new):
   - `AccountLookupWithMapping/index.ts` — `ReactControl<IInputs,IOutputs>` shim: holds `selected: LookupValue[] | null`, wires notifyOutputChanged, `openQuickCreate()` (retrieve record → build formParameters → openForm → set selected), `getOutputs()` returns `{value: selected}`. Reads `targetEntity` from input properties rather than hardcoding `"account"`.
   - `AccountLookupWithMapping/AccountLookupComponent.tsx` — Fluent UI 9: `Combobox` search with debounce + `Spinner`, current-value tag with dismiss/clear, "+ New Account" `Button`. Controlled value via props; local state only for search text/results. Accessibility (keyboard nav, focus management on dismiss/clear) is an explicit acceptance criterion, not assumed free from Fluent defaults.
   - `AccountLookupWithMapping/mappingParser.ts` — `parseMapping(raw): { sourceEntity?: string; mapping: Record<string,string> }` with JSON.parse in try/catch, `version`/`sourceEntity` handling, and validation. Pure/unit-testable.
   - `PCFComponents.pcfproj` updated automatically by `pac pcf init`

4. **Error handling**
   - `openForm` cancel-rejection: swallow (not an error).
   - `retrieveRecord` failure on the work order (network error, revoked privilege, mid-save race): catch, log to console, fall back to opening quick create with **no** `formParameters` rather than blocking "+ New" entirely.
   - Missing/malformed `contextInfo`: same fallback as above.
   - `sourceEntity` mismatch: warn to console, proceed without prefill.
   - Mapped target column not present on the Account quick create form: silently ignored by the platform (formParameters for non-existent fields are dropped) — documented as expected behavior, not a bug to chase during testing.

5. **Build & harness**: `npm run build`, `npm start watch`. Harness can verify render/styling/parsing/disabled state but NOT webAPI, openForm, or contextInfo — guard those so the harness doesn't crash. Real testing requires deployment.

6. **Deploy to dev**: `pac auth create --environment <url>` (once), then `pac pcf push --publisher-prefix <prefix>`. In form designer: Work Order form → msdyn_serviceaccount → add `Columbus.AccountLookupWithMapping` → set static `fieldMappingJson` (e.g. `{"version":1,"sourceEntity":"msdyn_workorder","mapping":{"msdyn_address1":"address1_line1","msdyn_city":"address1_city","msdyn_postalcode":"address1_postalcode"}}`) → publish.

7. **Promotion beyond dev**: `pac pcf push` is dev inner-loop only. Add the control to the project's managed solution, export, and promote dev → test → prod via the existing ALM process (pipeline or manual import), consistent with how the rest of this `Columbus`/`PCFComponents` project is deployed. This step was missing from the original plan and must be defined before this ships past dev.

## Verification (dev environment) — repeatable checklist

| # | Scenario | Expected outcome |
|---|---|---|
| 1 | Search for an existing account | Debounced results appear, selecting sets the lookup |
| 2 | Clear a selected value | Lookup clears, `notifyOutputChanged` fires |
| 3 | "+ New Account" with saved work order | Quick create opens with mapped fields pre-filled per `fieldMappingJson` |
| 4 | Save the quick create form | Lookup is set to the new account |
| 5 | Invalid mapping JSON | Control still works, no prefill, warning logged |
| 6 | Unsaved work order (no entityId) | Quick create opens with no prefill |
| 7 | User cancels quick create | No error surfaced, control returns to prior state |
| 8 | Null/empty source field values | Corresponding target fields skipped, not blanked |
| 9 | `retrieveRecord` fails (simulate offline/network error) | Quick create still opens, no prefill, warning logged |
| 10 | `sourceEntity` in mapping doesn't match actual source entity | Warning logged, no prefill applied |
| 11 | Swap `fieldMappingJson` on the already-deployed control (no rebuild) | Behavior changes immediately after publish — proves the "configurable without recompile" claim end-to-end |

- Precondition: confirm the Account quick create form is enabled and all target columns exist on it before testing prefill.
