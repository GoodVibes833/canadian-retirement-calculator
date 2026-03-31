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
- baseline taxable-account ACB and realized capital-gain treatment,
- baseline taxable-account interest and Canadian dividend character treatment,
- baseline return-of-capital handling and foreign-dividend ordinary-income treatment,
- baseline federal foreign tax credit approximation for foreign non-business income,
- baseline ON / BC / AB provincial residual-credit approximation for foreign non-business income,
- baseline same-year and carryforward net-capital-loss handling,
- later Quebec and fuller multi-country foreign tax credit detail.

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
- RRIF minimum withdrawals are modeled, and locked-in accounts now support baseline LIRA-to-LIF conversion plus ON / BC / AB fallback LIF guardrails with Quebec warning-heavy partial support,
- non-registered withdrawals now track adjusted cost base and realize taxable capital gains using the ruleset inclusion rate, while explicit taxable-account interest, foreign dividends, Canadian eligible / non-eligible dividends, and return-of-capital cash distributions can be modeled annually; return-of-capital distributions also reduce modeled non-registered market value, and baseline federal plus ON / BC / AB provincial residual-credit foreign-tax-credit approximations are now supported alongside same-year and carryforward net-capital-loss handling, while Quebec and fuller multi-country foreign tax credit detail remain incomplete,
- GIS is not calculated,
- pension splitting now uses an annual heuristic on planned eligible pension income before discretionary drawdown, not a full lifetime optimization,
- spouse-aware survivor logic now includes a baseline spousal asset rollover and defined-benefit survivor continuation, but still omits CPP survivor pension and estate-tax effects,
- custom withdrawal order now supports supported account tokens and then falls back to the blended default path,
- QPP delayed-start increases are now baseline-supported through age 72, while early-start reductions still use a set-proportion approximation unless the user enters a manual start-age amount.

## 8. Next Implementation Order

Recommended order from here:

1. Replace locked-in fallback maximums with more exact institution-style annual calculations and fuller Alberta / BC formulas.
2. Deepen Quebec-specific FRV and tax-path behavior, including Quebec-side foreign tax credit detail and more exact early-start QPP reduction handling.
3. Add GIS and Allowance.
4. Add fuller survivor modeling including CPP survivor pension and death-year tax handling.
5. Add more exact multi-country and treaty-aware foreign tax credit handling.
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
