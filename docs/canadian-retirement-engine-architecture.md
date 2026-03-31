# Canadian Retirement Engine Architecture

Last updated: 2026-03-30

## 1. Purpose

This document turns the product PRD into an implementation-ready engine design.

The goal is to create a reusable core that can power:

- a quick consumer calculator,
- a guided retirement planner,
- a detailed advisor-style planning flow.

The engine should be UI-agnostic and rules-driven.

## 2. High-Level Architecture

Recommended top-level structure:

- `src/domain`
  - canonical input and output types
- `src/rules`
  - typed rule-table definitions
- `data/rules`
  - dated JSON rule sets and reference values
- `src/engine`
  - simulation orchestration and calculation modules
- `docs`
  - product, rules, and implementation notes

## 3. Engine Boundaries

The engine is responsible for:

- validating and normalizing user input,
- projecting ages and timeline states,
- applying Canadian benefit rules,
- applying account drawdown rules,
- estimating annual tax and after-tax cash flow,
- returning comparable scenario outputs.

The engine is not responsible for:

- UI form logic,
- copywriting,
- chart rendering,
- authentication,
- persistence,
- external account imports.

## 4. Canonical Data Flow

1. Collect household input
2. Validate ages, account balances, and key rule constraints
3. Load dated rule tables for the relevant simulation year(s)
4. Build a timeline for each household member
5. Run accumulation stage until retirement
6. Run benefit eligibility and start events
7. Run drawdown and tax estimation
8. Produce annual result rows
9. Derive summary metrics and warnings

## 5. Recommended Modules

### 5.1 Input Normalization

Responsibilities:

- default missing optional values,
- reject invalid ages,
- reject impossible pension start combinations,
- standardize currency assumptions,
- prepare spouse-aware structures.

### 5.2 Timeline Builder

Responsibilities:

- generate annual or monthly projection periods,
- keep person ages aligned to calendar year,
- trigger retirement milestones,
- trigger pension start milestones,
- trigger one-time events.

### 5.3 Benefits Module

Responsibilities:

- CPP/QPP estimation,
- OAS and partial OAS,
- OAS delay uplift,
- OAS clawback thresholds,
- statement-based, manual, and entitlement-percent benefit input modes,
- immigrant and shorter-residence cases,
- foreign pension income hooks,
- GIS / Allowance in later versions,
- survivor and bridge-benefit hooks.

### 5.4 Drawdown Module

Responsibilities:

- determine annual spending gap,
- apply withdrawal order,
- enforce RRIF minimum rules,
- later enforce LIF min/max rules,
- track tax consequences of withdrawals,
- coordinate spouse assets.

### 5.5 Tax Module

Responsibilities:

- federal tax estimate,
- provincial tax estimate,
- pension income amount,
- age amount,
- pension splitting,
- OAS recovery tax,
- later taxable-account character treatment.

### 5.6 Reporting Module

Responsibilities:

- compute readiness summary,
- detect first shortfall year,
- surface key warnings,
- expose annual income and spending rows,
- support scenario comparison.

## 6. Rule Table Strategy

All date-sensitive logic should come from versioned JSON files, not hardcoded constants.

Recommended characteristics:

- one dated ruleset per jurisdiction and effective period,
- explicit source URLs and access date,
- no hidden assumptions,
- simple machine-readable structure,
- safe fallbacks when a table is missing.

## 7. Current Scaffold Decisions

The initial scaffold in `src/engine/simulateRetirementPlan.ts` intentionally does three things:

- validates key start-age constraints,
- builds an annual timeline,
- rolls account balances forward annually and returns a shape-compatible result object.

The scaffold is intentionally incomplete in these areas:

- taxes now use a 2026 federal and province-aware scaffold for ON, BC, AB, and QC, including basic personal, age, and pension-income credits for federal / ON / BC / AB and a partial Quebec path,
- RRIF minimum withdrawals are modeled, but LIF withdrawals are not,
- GIS is not calculated,
- pension splitting now uses an annual heuristic on planned eligible pension income before discretionary drawdown, not a full lifetime optimization,
- spouse-aware survivor logic now includes a baseline spousal asset rollover and defined-benefit survivor continuation, but still omits CPP survivor pension and estate-tax effects,
- custom withdrawal order now supports supported account tokens and then falls back to the blended default path,
- QPP delayed-start math still needs Quebec-specific implementation beyond manual-input support.

## 8. Next Implementation Order

Recommended order from here:

1. Add LIF and locked-in account min / max withdrawal logic by province.
2. Add taxable-account character treatment for non-registered withdrawals.
3. Deepen Quebec-specific QPP and tax-path behavior.
4. Add GIS and Allowance.
5. Add fuller survivor modeling including CPP survivor pension and death-year tax handling.
6. Add Monte Carlo.

## 9. Technical Notes

- Keep the engine pure and deterministic by default.
- Pass rules into functions rather than importing global constants.
- Separate `rule data`, `calculation functions`, and `result formatting`.
- Prefer annual outputs first, then monthly expansion if needed.
- Keep scenario comparison as repeated runs over the same engine.

Related validation docs:

- `docs/canadian-retirement-persona-coverage.md`
- `docs/canadian-retirement-test-strategy.md`
- `docs/canadian-retirement-locked-in-accounts-plan.md`
