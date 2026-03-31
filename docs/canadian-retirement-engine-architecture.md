# Canadian Retirement Engine Architecture

Last updated: 2026-03-31

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
- baseline GIS / Allowance support with explicit approximation warnings,
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
- baseline ON / BC / AB / QC provincial residual-credit approximation for foreign non-business income,
- baseline same-year and carryforward net-capital-loss handling,
- later fuller Quebec form-level and multi-country foreign tax credit detail.

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

- taxes now use a 2026 federal and province-aware scaffold for ON, BC, AB, and QC, including basic personal, age, and pension-income credits for federal / ON / BC / AB and a Quebec path that now includes dividend handling, residual foreign tax credits, a baseline career-extension credit, and a household-level Schedule B age, living-alone, and retirement-income approximation,
- RRIF minimum withdrawals are modeled, and locked-in accounts now support baseline LIRA-to-LIF conversion plus ON / BC / AB piecewise LIF maximum formulas that follow the published age-90 withdrawal-factor structure using the greater of the November long-term rate and 6% for the first 15 years and 6% thereafter; Quebec retains a FRV path that recognizes the 2025+ no-maximum rule for ages 55 and older, and for ages under 55 it can baseline-model a start-of-year temporary-income election when the request and declaration inputs are supplied, while institution-specific and mid-year detail remain partial,
- non-registered withdrawals now track adjusted cost base and realize taxable capital gains using the ruleset inclusion rate, while explicit taxable-account interest, foreign dividends, Canadian eligible / non-eligible dividends, and return-of-capital cash distributions can be modeled annually; return-of-capital distributions also reduce modeled non-registered market value, and baseline federal plus ON / BC / AB / QC provincial residual-credit foreign-tax-credit approximations are now supported alongside same-year and carryforward net-capital-loss handling, while fuller Quebec form-level and multi-country foreign tax credit detail remain incomplete,
- GIS / Allowance now use a baseline prior-year assessable-income path with the published 2026 maximums and income cutoffs, plus the work-income exemption. When quarterly OAS / GIS / Allowance tables are loaded, the engine annualizes them across the calendar year instead of using a flat January maximum; the first projection year still falls back to a current-year proxy unless `household.incomeTestedBenefitsBaseIncome` is supplied, survivor Allowance still requires an explicit eligibility flag, and exact Service Canada July-to-June reassessment timing plus top-up detail remain incomplete,
- pension splitting now uses an annual heuristic on planned eligible pension income before discretionary drawdown, not a full lifetime optimization,
- spouse-aware survivor logic now includes a baseline spousal asset rollover, defined-benefit survivor continuation, partial CPP / QPP survivor-pension support, warning-heavy under-65 and age-65-plus combined-benefit approximations when the survivor is already receiving retirement benefits, a user-overridable survivor spending path that defaults to 72% of couple spending, and a mid-year death heuristic that prorates recurring income / mandatory withdrawals in couple death years and adds a half-year survivor public pension baseline. Death-year annual results now add a baseline final-return tax adjustment, and registered accounts can now be tagged as estate, spouse-designated, or direct-beneficiary assets so probate proxy and survivor household balance flow react differently. User-entered joint-with-surviving-spouse shares for non-registered assets and cash now reduce the death-year probate proxy as a baseline common-law survivorship path, and Quebec estate paths can now distinguish notarial wills from non-notarial wills when `estateAdministrationProfile` is supplied, including manual verification-cost overrides for non-notarial paths. Summary output also includes a projection-end after-tax estate proxy that applies terminal tax to remaining registered balances, uses net capital losses against terminal gains and then other income on a final-return baseline, and approximates ON / BC / AB probate-style estate administration costs while treating Quebec notarial wills as a no-verification path unless a manual cost override is supplied. Full CRA optional-return detail, exact Quebec verification-fee/search-certificate detail, broader joint-ownership and beneficial-ownership analysis, and DC pension death treatment remain incomplete,
- custom withdrawal order now supports supported account tokens and then falls back to the blended default path,
- QPP delayed-start increases are now baseline-supported through age 72, while early-start reductions still use a set-proportion approximation unless the user enters a manual start-age amount.

## 8. Next Implementation Order

Recommended order from here:

1. Add widowhood year+1 OAS / GIS / Allowance reassessment behavior on top of the current survivor baseline.
2. Deepen GIS / Allowance and OAS with exact July-to-June reassessment timing and top-up behavior beyond the current annualized-quarterly baseline.
3. Add more exact multi-country and treaty-aware foreign tax credit handling.
4. Add a real household withdrawal optimizer beyond the current heuristic order.
5. Tighten survivor and estate settlement detail with fuller CRA optional returns plus Quebec will-search and court/notary fee detail.
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
- `docs/canadian-retirement-improvement-roadmap.md`
