# Canadian Retirement Persona Coverage

Last updated: 2026-03-30

## 1. Purpose

This document stress-tests the current product plan against 30 realistic Canadian retirement personas.

Important note:

- `Coverage status` below refers to the current product design target in the PRD.
- It does not mean the current code scaffold already implements the case end to end.

## 2. Coverage Legend

- `MVP-Strong`: current PRD already targets this case directly
- `MVP-Partial`: current PRD can serve this case, but with important simplifications or caveats
- `V2`: not strong enough for MVP, but explicitly should be supported in V2
- `Later / Out`: not currently targeted before a later release

## 3. Persona Matrix

| # | Persona | Core Situation | Key Needs | Coverage | Why |
| --- | --- | --- | --- | --- | --- |
| 1 | Ontario salaried single saver | Age 50-60 employee with RRSP, TFSA, CPP, OAS | retirement date, spending target, after-tax income | MVP-Strong | This is the core mainstream planning case |
| 2 | Ontario dual-income couple | Married couple with similar ages and standard savings accounts | couple cash flow, pension splitting, joint retirement timing | MVP-Strong | Household support and pension splitting are core MVP scope |
| 3 | Quebec professional couple | Couple retiring in Quebec under QPP rules | QPP, Quebec tax path, province-specific assumptions | MVP-Partial | Quebec is in MVP scope, but QPP and Quebec tax depth still need tighter modeling |
| 4 | Public-sector DB pension employee | One spouse has indexed DB pension plus CPP/OAS | DB pension integration, bridge benefit awareness, after-tax view | MVP-Strong | DB pension is a stated MVP input and common Canadian case |
| 5 | Group DC pension employee | Employee with DC plan and registered savings | combine DC assets with RRSP/TFSA drawdown | MVP-Strong | DC balances can be modeled as investable assets in MVP |
| 6 | Self-employed consultant | No employer pension, uneven savings path, lower CPP history | irregular earnings, manual CPP assumptions, tax-aware withdrawals | MVP-Partial | Core plan works, but self-employed tax and CPP precision are limited |
| 7 | Incorporated owner-manager | Holds retirement assets partly inside a corporation | salary vs dividend extraction, corp investment assets, exit strategy | Later / Out | Corporate decumulation and private-company planning are not in current scope |
| 8 | High-income executive | Large RRSP and taxable assets, OAS clawback likely | OAS clawback, withdrawal order, delayed benefits, tax smoothing | MVP-Partial | MVP includes OAS recovery warning, but not full optimization |
| 9 | Moderate-income renter | No home equity, simple lifestyle budget, standard benefits | spending-first planning, affordability without downsizing | MVP-Strong | Simple but important mainstream case well aligned to MVP |
| 10 | Homeowner planning to downsize | Home sale later in retirement funds future spending | one-time proceeds, housing reset, post-downsize cash flow | MVP-Partial | Basic one-time event works in MVP, but full downsizing model is V2 |
| 11 | Early retiree at 55 | Stops work well before CPP/OAS, must bridge with savings | bridge withdrawals, sequence risk, delayed public benefits | MVP-Partial | Retirement age comparisons are supported, but drawdown depth is limited |
| 12 | Delayed-benefit optimizer | Works longer and delays CPP/OAS to 70 | compare benefit timing and long-life outcomes | MVP-Partial | Start-age comparisons fit MVP, but full optimization is later |
| 13 | Phased retiree | Retires from full-time work but keeps consulting income | part-time retirement income, changing spending | MVP-Strong | Part-time post-retirement income is already in the variable model |
| 14 | Already retired RRIF couple | In drawdown today with RRIF income and pensions | ongoing withdrawal sustainability, taxes, annual cash flow | MVP-Partial | Drawdown is in scope, but RRIF minimum and tax engine depth still need work |
| 15 | LIRA / LIF holder | Pension transfer or locked-in plan dominates retirement assets | LIF min/max rules, locked-in access limits | V2 | Detailed LIRA/LIF support is explicitly planned for V2 |
| 16 | Annuity plus portfolio retiree | Bought or considering annuity for part of income | guaranteed income plus portfolio longevity | V2 | Annuity modeling is a V2 item, though manual income can bridge temporarily |
| 17 | Large age-gap couple | Spouses retire at different times and ages | staggered retirement, staggered OAS/CPP, spouse coordination | MVP-Strong | Different retirement ages and spouse timing are core to the household model |
| 18 | Survivor-focused couple | Wants to know income after first spouse death | widowhood cash flow, survivor pension continuation, spending drop | V2 | Survivor-income engine is explicitly a V2 need |
| 19 | Divorced planner | Pension credits split, support history, spousal RRSP complexity | post-divorce retirement cash flow and tax nuance | Later / Out | Divorce-driven pension attribution and legal complexity are not modeled yet |
| 20 | Widow or widower | Already single after spouse death and may have survivor benefits | survivor CPP, changed tax status, reduced spending base | V2 | Survivor handling is planned, but not strong enough yet |
| 21 | Late-life immigrant with partial OAS | Arrived in Canada as an adult, lower CPP/OAS, foreign pension | partial OAS, manual CPP, foreign pension inputs | MVP-Partial | We now model this path conceptually, but treaty and tax detail remain limited |
| 22 | Immigrant couple with mixed OAS status | One spouse has full OAS, the other partial OAS | spouse-specific OAS, mixed residence histories | MVP-Partial | Household model can represent this, but GIS/treaty edge cases remain limited |
| 23 | Social-security-agreement case | Benefit rights depend on treaty country coordination | eligibility nuance, partial contribution aggregation, foreign rules | Later / Out | This needs explicit treaty logic beyond current scope |
| 24 | Low-income single senior | Likely GIS eligible and extremely sensitive to taxable withdrawals | GIS, clawback, tiny margin of error in income planning | V2 | GIS is not strong enough for MVP and is a major V2 need |
| 25 | Low-income couple with Allowance/GIS | One spouse may be 60-64 and household depends on supplements | GIS, Allowance, spouse income interactions | V2 | Allowance and GIS logic are deferred to V2 |
| 26 | Quebec low-income senior | QPP plus Quebec tax plus GIS-like sensitivity | Quebec rules plus low-income benefit precision | V2 | This is a compounded edge case that needs QPP, Quebec tax, and GIS depth |
| 27 | Non-registered-heavy investor | Most assets are taxable, not registered | dividend/capital gains treatment, tax drag, withdrawal order | MVP-Partial | Non-registered balances are in MVP, but tax character is simplified |
| 28 | Rental-property retiree | Owns rental income that continues through retirement | rental income integration and cash flow planning | MVP-Strong | Scheduled external income fits current design |
| 29 | Foreign pension recipient | Receives pension from another country | foreign pension as income source, tax treatment, benefit interactions | MVP-Partial | Foreign income can be input, but full tax treatment is not yet modeled |
| 30 | U.S.-Canada cross-border retiree | Has U.S. Social Security, IRA/401(k), residency or tax complexity | bilateral tax and retirement rules | Later / Out | Cross-border tax engine is outside current first-release scope |

## 4. Coverage Summary

### 4.1 Count By Coverage Status

- `MVP-Strong`: 8 personas
- `MVP-Partial`: 10 personas
- `V2`: 8 personas
- `Later / Out`: 4 personas

### 4.2 What This Means

The current PRD is good enough for the Canadian mainstream core, especially:

- standard employees,
- couples,
- DB/DC pension holders,
- phased retirement,
- renters and ordinary homeowners,
- staggered spouse retirement timing.

The biggest weak areas are:

- GIS and Allowance households,
- LIF / locked-in pension money,
- survivor-income planning,
- Quebec-specific deep modeling,
- business-owner and corporate-retirement cases,
- treaty and cross-border cases.

## 5. Most Important Gaps To Close

These are the gaps that most affect real-world usefulness in Canada.

### 5.1 High-Priority Before Frontend Lock-In

1. `GIS and Allowance`
2. `Survivor-income logic`
3. `RRIF and LIF withdrawal rules`
4. `Quebec-specific depth`
5. `Non-registered tax character`

Reason:

- These affect large or financially vulnerable user groups.
- These also change what inputs the frontend must ask for.

### 5.2 Medium-Priority

1. `Downsizing and housing transitions`
2. `Foreign pension tax treatment`
3. `Business-sale and liquidity-event planning`

### 5.3 Later-Or-Specialist

1. `Social security agreement treaty logic`
2. `Cross-border U.S.-Canada retirement tax`
3. `Complex divorce and pension-credit attribution`

## 6. Frontend Implications From Persona Review

The frontend should not be a single flat form. The personas imply a branching setup flow.

Recommended branching questions:

1. `Household setup`
   Ask whether the user is single, married, common-law, widowed, or planning jointly.
2. `Province and Quebec path`
   Ask province early because Quebec should branch to QPP and Quebec tax messaging.
3. `Public benefit confidence`
   Ask whether the user has an official CPP/QPP estimate, knows the expected start-age amount, or needs a rough estimate.
4. `OAS residence history`
   Ask whether the user has 40 years in Canada after age 18. If not, ask residence years directly.
5. `Immigrant / foreign pension branch`
   Ask whether the user immigrated as an adult or expects any foreign pension income.
6. `Low-income benefit branch`
   Ask whether household income in retirement is expected to be low enough that GIS or Allowance may matter.
7. `Pension type branch`
   Ask whether the user has DB, DC, RRSP/RRIF only, or locked-in assets such as LIRA/LIF.
8. `Home and one-time event branch`
   Ask whether home sale, downsizing, inheritance, or business sale should be modeled.
9. `Decumulation branch`
   Ask whether the user is still saving, already retired, or partly retired.

## 7. Recommended Product Decisions After This Review

1. `GIS and Allowance` should be treated as a serious V2 milestone, not a nice-to-have.
2. `Survivor planning` should move up in priority because many couple personas depend on it.
3. `Quebec depth` should not be treated as a cosmetic province toggle.
4. `Manual benefit override paths` must stay in the product for immigrant and irregular-benefit cases.
5. `Corporate and cross-border cases` should be clearly labeled as later-scope specialist scenarios so users are not misled.

## 8. Suggested Next Step

Turn these personas into:

- `frontend intake branches`,
- `sample fixtures`,
- `acceptance test scenarios`.

That would give us a practical path from product planning into implementation and QA.
