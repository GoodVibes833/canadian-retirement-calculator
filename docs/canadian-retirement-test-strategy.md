# Canadian Retirement Test Strategy

Last updated: 2026-03-30

## 1. Purpose

This document defines how we should test the retirement engine without drowning in every variation at once.

The strategy is:

1. lock a `Golden 10` core scenario set,
2. expand each core scenario through a `Province Matrix`,
3. validate special-rule behavior through `Edge-Case Packs`.

This lets us cover all important cases while keeping implementation order practical.

## 2. Test Layers

### 2.1 Golden 10

Purpose:

- prove the core engine works,
- catch the biggest modeling mistakes early,
- create stable reference fixtures for ongoing development.

Golden 10 should cover:

- single and couple households,
- accumulation and drawdown,
- standard CPP/OAS,
- partial OAS,
- DB pension,
- RRIF drawdown,
- OAS clawback,
- Quebec path,
- rental or external income,
- staggered spouse retirement timing.

### 2.2 Province Matrix

Purpose:

- verify that the same economic household behaves correctly across provinces,
- isolate tax and public-rule differences without changing too many variables at once.

Principle:

- use a small number of reusable base personas,
- rerun them in multiple provinces,
- treat Quebec as a special branch, not just another tax code.

### 2.3 Edge-Case Packs

Purpose:

- validate high-risk or low-frequency rules,
- protect against misleading outputs for vulnerable or complex users.

Examples:

- GIS and Allowance,
- survivor planning,
- LIF / locked-in rules,
- social security agreement cases,
- cross-border exclusion behavior,
- widowhood,
- heavy non-registered assets.

## 3. Golden 10 Scenarios

These should be the first fixed fixtures in the repo.

| ID | Scenario | Why It Must Be In Golden 10 | Status |
| --- | --- | --- | --- |
| G01 | Ontario salaried single saver | baseline single-person accumulation and retirement case | planned |
| G02 | Ontario dual-income couple | baseline household planning and pension splitting case | partly represented |
| G03 | Ontario DB pension employee | core Canadian public-sector / employer-pension case | planned |
| G04 | Ontario phased retiree | validates part-time retirement income and retirement transition | planned |
| G05 | Early retiree at 55 | validates bridge years before CPP/OAS | planned |
| G06 | High-income OAS clawback case | validates public-benefit reduction pressure at higher income | planned |
| G07 | Already retired RRIF couple | validates current-drawdown household behavior | planned |
| G08 | Quebec professional couple | validates special Quebec path and QPP-aware branching | planned |
| G09 | Immigrant with partial OAS and foreign pension | validates manual benefit override and non-standard benefit path | partly represented |
| G10 | Rental-income retiree | validates external non-employment income integration | planned |

### 3.1 Existing Fixture Mapping

- Golden fixtures now live under `data/fixtures/golden/`
- Human-readable acceptance expectations live in `docs/canadian-retirement-golden-10-acceptance-spec.md`

### 3.2 Acceptance Expectations For Golden 10

Each Golden 10 fixture should eventually have acceptance assertions in plain language.

Examples:

- `G01`: retirement income should begin increasing with CPP/OAS at elected start ages
- `G02`: spouse timing and pension splitting inputs should be preserved in output
- `G03`: DB pension should appear as a distinct income source
- `G04`: part-time post-retirement income should appear only in the configured age range
- `G05`: OAS should remain zero before age 65 and bridge spending should be visible
- `G06`: OAS recovery tax should become positive once income crosses the configured threshold
- `G07`: RRIF-related warnings should appear once age 71+ applies
- `G08`: Quebec cases should be flagged for QPP / Quebec-specific handling
- `G09`: partial OAS warning should appear and foreign pension should count as planned income
- `G10`: rental income should persist on the configured schedule

## 4. Province Matrix

### 4.1 Why Province Matrix Exists

An Ontario single and a BC single are mostly the same household economically.

What changes is mainly:

- provincial tax treatment,
- province-specific credit treatment,
- Quebec-specific pension path,
- some planner messaging and assumptions.

So we should not invent 13 unrelated personas from scratch. We should reuse base personas.

### 4.2 Province Matrix Base Personas

Use these as the reusable base rows:

- `P-Single-Core`
- `P-Couple-Core`
- `P-High-Income`
- `P-Low-Income`

### 4.3 Province Matrix Rollout

Recommended rollout:

1. `Ontario`
2. `British Columbia`
3. `Alberta`
4. `Quebec`
5. remaining provinces and territories

Reason:

- Ontario is the easiest baseline,
- BC and Alberta give useful non-Quebec provincial comparisons,
- Quebec must be handled early because it is structurally different,
- the rest are mostly scale-out after the tax engine is stable.

### 4.4 Province Matrix Table

| Matrix ID | Base Persona | Provinces | Main Goal |
| --- | --- | --- | --- |
| PM01 | P-Single-Core | ON, BC, AB, QC | confirm province-level tax and pension-path differences |
| PM02 | P-Couple-Core | ON, BC, AB, QC | confirm spouse planning and province interaction |
| PM03 | P-High-Income | ON, BC, AB, QC | compare higher-income tax burden and OAS clawback behavior |
| PM04 | P-Low-Income | ON, BC, AB, QC | prepare for GIS-sensitive province behavior once V2 lands |

## 5. Edge-Case Packs

Edge-case packs should not block the first Golden 10 implementation, but they should be planned early.

### 5.1 Pack A: Benefit Complexity

- partial OAS
- mixed OAS couple
- manual CPP/QPP amount
- foreign pension income
- delayed OAS to 70
- delayed QPP beyond 70

### 5.2 Pack B: Low-Income / Supplement Sensitivity

- GIS single
- GIS couple
- Allowance household
- low-income Quebec senior

### 5.3 Pack C: Drawdown Rules

- RRIF minimum
- LIF min/max
- taxable-first vs tax-aware drawdown
- non-registered-heavy investor

### 5.4 Pack D: Household Shocks

- widowhood
- survivor-income couple
- large age-gap couple
- one-time healthcare shock
- downsizing event

### 5.5 Pack E: Specialist / Exclusion Cases

- incorporated business owner
- treaty-based social security agreement household
- U.S.-Canada cross-border retiree
- complex divorce / pension credit split

These should either be explicitly supported later or explicitly marked as not yet supported.

## 6. Fixture Naming Strategy

Recommended naming format:

- `golden-on-single-saver.json`
- `golden-on-couple-core.json`
- `golden-on-db-pension.json`
- `golden-qc-couple-core.json`
- `golden-bc-immigrant-partial-oas.json`
- `matrix-p-single-core-on.json`
- `matrix-p-single-core-bc.json`
- `edge-gis-single-on.json`

## 7. Minimum Acceptance Spec Format

Every fixture should have:

1. `input fixture`
2. `human-readable description`
3. `must-pass expectations`
4. `known limitations`

Suggested expectation categories:

- benefit timing,
- tax behavior,
- warnings,
- cash-flow continuity,
- spouse handling,
- special-rule handling.

## 8. Recommended Build Order

### Step 1

Create all Golden 10 fixture files.

### Step 2

For each Golden 10 fixture, add a markdown acceptance spec.

Current smoke command:

- `npm run smoke:golden`

### Step 3

Implement engine features in the order that unlocks the most Golden 10 scenarios:

1. annual account roll-forward
2. spending-gap drawdown
3. provincial tax interface
4. OAS clawback
5. RRIF minimum logic
6. Quebec path depth

### Step 4

Expand into the Province Matrix.

### Step 5

Build Edge-Case Packs based on the V2 roadmap.

## 9. What Success Looks Like

We should eventually be able to say:

- the core engine passes all Golden 10 fixtures,
- the same core personas behave consistently across the province matrix,
- special rules are covered by named edge-case packs,
- unsupported cases are explicit instead of silently mishandled.
