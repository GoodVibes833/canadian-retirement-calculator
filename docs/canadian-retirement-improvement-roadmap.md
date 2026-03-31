# Canadian Retirement Improvement Roadmap

Last updated: 2026-03-31

## 1. Purpose

This document turns the current engine gap list into a practical backlog.

The goal is not just to list ideas. The goal is to decide:

- what matters most for Canadian users,
- what is hardest to get wrong,
- what should be implemented first,
- what can wait until V2 or V3.

Priority labels:

- `P0`: highest-value accuracy gap or trust risk
- `P1`: strong user value and should follow soon after P0
- `P2`: important expansion or optimization work
- `P3`: later-stage sophistication or specialist coverage

Effort labels:

- `S`: under 1 focused day
- `M`: 1 to 3 focused days
- `L`: 3 to 7 focused days
- `XL`: more than a week or multi-part rollout

## 2. Ranked Backlog

| ID | Theme | Improvement | Priority | User Impact | Difficulty | Effort | Why It Matters |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | Death / estate | Add actual `death-year final return` tax handling into annual cash flow | P0 | Very high | High | L | Current death years use a mid-year heuristic, but the cash-flow row still does not behave like a real final return. |
| R02 | Death / estate | Add `beneficiary designation` inputs for RRSP / RRIF / TFSA / LIF | P0 | Very high | Medium | M | Users care whether assets go through the estate at all. This directly changes probate and after-tax estate output. |
| R03 | Death / estate | Add `joint ownership / JTWROS` estate exclusions | P0 | Very high | Medium | M | Estate and probate outputs are misleading without knowing which assets bypass the estate. |
| R04 | Income-tested benefits | Switch `GIS / Allowance` from current-year proxy to `prior-year income` logic | P0 | Very high | High | L | Low-income households are very sensitive to this. Current baseline is useful but not yet planner-grade. |
| R05 | Locked-in | Replace ON / BC / AB LIF fallback maximums with more exact formulas | P0 | High | High | L | Locked-in decumulation is a major Canadian-specific trust point. |
| R06 | Drawdown | Build a real `withdrawal optimizer` instead of a heuristic order | P0 | Very high | High | XL | This is the biggest engine upgrade for higher-asset households and advisor-style planning. |
| R07 | Death / estate | Add Quebec `will-form` inputs and probate / verification branching | P1 | High | Medium | M | Quebec estate outputs are incomplete without distinguishing notarial vs verified wills. |
| R08 | Survivor benefits | Add `CPP survivor / QPP survivor` under-65 combined-benefit detail | P1 | High | High | L | Widowhood planning is common and under-65 cases are still partial. |
| R09 | Public benefits | Add quarterly `OAS / GIS / Allowance` indexation tables | P1 | Medium | Medium | M | Helps align real payout timing and reduces benefit drift over long horizons. |
| R10 | Taxes | Add `GRE 164(6)` and terminal loss carryback support | P1 | High | High | L | Important for estates with large taxable losses and real death-year tax planning. |
| R11 | Non-registered | Add beneficiary-aware taxable-account death treatment | P1 | High | Medium | M | Estate and survivor outputs should distinguish liquidation, rollover, and estate retention paths. |
| R12 | Foreign income | Add multi-country and treaty-aware `foreign tax credit` logic | P1 | High | High | L | Immigrants and cross-border retirees are a core Canada use case. |
| R13 | Public benefits | Add country-specific `social security agreement` handling | P1 | High | High | XL | This meaningfully affects CPP/OAS expectations for many immigrants. |
| R14 | Quebec | Add fuller Quebec form-level tax path beyond current Schedule B baseline | P1 | Medium | High | L | Quebec is not just another province; users expect confidence there. |
| R15 | Survivor planning | Add `widowhood year+1` OAS / GIS / Allowance reassessment behavior | P1 | High | Medium | M | Survivor households often change benefit eligibility sharply after the death year. |
| R16 | Death / estate | Add `DC pension` death-time treatment and beneficiary branching | P1 | High | Medium | M | Summary estate values currently warn that DC death treatment is incomplete. |
| R17 | Input UX | Build `statement-driven intake` for CPP / QPP / OAS / account snapshots | P1 | Very high | Medium | L | This is the fastest path to higher accuracy without making users do manual tax work. |
| R18 | OAS | Add residence-timeline-based `partial OAS` instead of years-only estimate | P2 | Medium | Medium | M | Strong improvement for immigrants and partial-residence edge cases. |
| R19 | Public pensions | Add `CPP post-retirement benefit / QPP supplement` detail | P2 | Medium | Medium | M | Useful for phased retirement and later-working retirees. |
| R20 | Employer pensions | Add richer `DB pension` rules: early reduction, bridge, index caps | P2 | High | High | L | DB pensions are common in Canada and drive retirement timing decisions. |
| R21 | Registered plans | Add fuller `DC pension / DPSP / VRSP / group plan` conversion paths | P2 | Medium | Medium | L | Expands employer-plan realism and supports advisor-style households. |
| R22 | Non-registered | Add `tax-lot / average-cost` precision beyond household-level ACB baseline | P2 | Medium | High | L | Better accuracy for large taxable investors and realized-gain planning. |
| R23 | Housing | Add `downsizing / rent transition / reverse mortgage` scenarios | P2 | High | Medium | M | Housing is one of the biggest real-world retirement planning levers. |
| R24 | Spending shocks | Add healthcare and long-term-care shock scenario modeling | P2 | High | Medium | M | Users need stress tests, not just base-case retirement. |
| R25 | OAS | Add explicit `OAS clawback management mode` in optimizer | P2 | High | High | L | Very useful for affluent retirees with RRSP/RRIF-heavy balance sheets. |
| R26 | GIS | Add explicit `GIS preservation mode` in drawdown strategy | P2 | High | High | L | Low-income optimization is as important as high-income tax minimization. |
| R27 | Product reliability | Add rules-data versioning workflow and annual source-audit checklist | P2 | High | Medium | M | This keeps the calculator trustworthy as tax and benefit rules move. |
| R28 | Cross-border | Add U.S. Social Security / IRA / 401(k) income support | P3 | Medium | High | XL | Valuable but specialized relative to the Canadian core. |
| R29 | Simulation | Add Monte Carlo and sequence-of-returns stress testing | P3 | High | High | XL | Important, but deterministic accuracy gaps should be tightened first. |
| R30 | Household optimization | Add whole-household tax balancing beyond pension splitting | P3 | High | High | XL | Strong long-run value, but it depends on the optimizer and estate inputs above. |

## 3. Recommended Order

### 3.1 Next 5 Engine Priorities

If we want the highest user trust gain per week, this is the best order:

1. `R01` actual death-year final return handling
2. `R02` beneficiary designations
3. `R03` joint ownership / estate exclusions
4. `R04` GIS / Allowance prior-year logic
5. `R05` exact LIF formulas

This order is strong because it fixes:

- the biggest death / estate trust gaps,
- the biggest low-income trust gaps,
- one of the biggest Canada-specific decumulation gaps.

### 3.2 After That

Once the five items above land, the next best cluster is:

1. `R06` withdrawal optimizer
2. `R07` Quebec probate / will-form logic
3. `R08` under-65 survivor combined-benefit detail
4. `R12` treaty-aware foreign tax credits
5. `R17` statement-driven intake

## 4. Sprint Buckets

### 4.1 Sprint A: Estate Trustworthiness

- `R01`
- `R02`
- `R03`
- `R07`
- `R16`

Outcome:

- estate output becomes much less misleading,
- survivor planning becomes easier to explain,
- probate numbers become more realistic.

### 4.2 Sprint B: Low-Income Accuracy

- `R04`
- `R09`
- `R15`
- `R26`

Outcome:

- GIS-sensitive households become much safer to model,
- widowhood and low-income transitions improve meaningfully.

### 4.3 Sprint C: Locked-In And Drawdown Intelligence

- `R05`
- `R06`
- `R25`
- `R30`

Outcome:

- decumulation logic starts to look like a true Canadian planning engine instead of a baseline calculator.

### 4.4 Sprint D: Quebec Depth

- `R07`
- `R08`
- `R14`

Outcome:

- Quebec path becomes much closer to a first-class branch.

### 4.5 Sprint E: Immigrant And Cross-Border Depth

- `R12`
- `R13`
- `R17`
- `R18`
- `R28`

Outcome:

- immigrant and foreign-income households become much better served.

## 5. What Not To Do First

These are valuable, but they should not jump ahead of the current trust gaps:

- `R28` U.S. retirement account detail
- `R29` Monte Carlo
- `R30` whole-household optimization
- deep tax-lot precision before death-year and GIS logic are fixed

Reason:

- the engine still has a few rule-accuracy gaps that matter more than advanced modeling sophistication,
- adding flashy simulation layers too early can make incorrect outputs look more professional than they really are.

## 6. Suggested Release Framing

### MVP-Trust

- `R01`
- `R02`
- `R03`
- `R04`
- `R05`

### V2-Advisor

- `R06`
- `R07`
- `R08`
- `R09`
- `R10`
- `R12`
- `R14`
- `R17`

### V3-Advanced

- `R13`
- `R18`
- `R20`
- `R21`
- `R22`
- `R23`
- `R24`
- `R25`
- `R26`
- `R28`
- `R29`
- `R30`

## 7. Current Recommendation

If we keep building immediately, the best next implementation target is:

1. `R01` actual death-year final return handling

Right behind it:

2. `R02` beneficiary designations
3. `R03` joint ownership estate exclusions

That trio would make the new estate summary materially more trustworthy very quickly.
