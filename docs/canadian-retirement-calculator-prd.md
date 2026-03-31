# Canadian Retirement Calculator PRD

Last updated: 2026-03-30

## 1. Product Summary

Build a Canada-first retirement planning engine for people who live in Canada now or expect to retire in Canada.

This should not be a thin "how much do I need" widget. It should be a household-level retirement simulator that can:

- estimate retirement readiness,
- project after-tax retirement income and spending,
- model Canadian public benefits and tax rules,
- simulate drawdown from multiple account types,
- show household outcomes year by year,
- highlight risks such as longevity, inflation, sequence of returns, and OAS/GIS interactions.

The target user is a Canadian resident or future Canadian retiree. The long-term goal is to be better than the average bank calculator by combining:

- Canadian public pensions,
- Canadian tax-aware decumulation,
- household and spouse logic,
- retirement cash flow planning,
- stress testing.

## 2. What We Learned From 20 Existing Tools

Market scan date: 2026-03-30. Tool content, assumptions, and rates may change over time.

### 2.1 Benchmark Set

| # | Tool | Category | Key Inputs Exposed | Strength | Gap We Should Avoid |
| --- | --- | --- | --- | --- | --- |
| 1 | Government of Canada: Canadian Retirement Income Calculator | Full retirement planner | retirement goal, CPP/QPP, OAS, employer pension, RRSP, TFSA, annuities, other income | Best official structure for Canadian income sources | Household and tax optimization depth is limited |
| 2 | Government of Canada: Old Age Security Benefits Estimator | Public benefits estimator | age, net income, residence history, marital status, spouse | Strong OAS/GIS eligibility framing | Not a full retirement plan |
| 3 | Desjardins Retirement Calculator | Full retirement planner | situation, retirement plan, government plans, personal savings, pension plan | Good scenario structure in today's dollars | Tax and drawdown detail unclear |
| 4 | Sun Life Retirement Savings Calculator | Savings planner | retirement age, goal, current savings, monthly savings, other income | Fast and approachable | Uses fixed assumptions and broad tax averages |
| 5 | Sun Life CPP/QPP Calculator | Public pension sub-tool | CPP/QPP starting age, income assumptions | Useful pension timing support | Not integrated with whole plan |
| 6 | Sun Life Annuity Calculator | Income product comparison | premium amount, income stream assumptions | Good annuity framing | Not integrated with tax and benefits |
| 7 | CIBC Retirement Savings Calculator | Full retirement planner | user + partner, income, savings, retirement age, life expectancy, CPP/QPP, OAS | Strong consumer-friendly household inputs | Explicitly says taxes are not considered |
| 8 | CIBC Retirement Budget Calculator | Retirement budget planner | CPP/QPP, OAS/GIS, employer pensions, RRSP/RRIF withdrawals, annuities, rental income, detailed expense categories | Excellent expense taxonomy | Not a tax-accurate lifetime simulator |
| 9 | RBC Retirement Budget Calculator | Before/after retirement budget | salary, bonus, pension, CPP, OAS, annuities, rental income, spousal income | Good before/after cash flow framing | Not a full decumulation engine |
| 10 | BMO Investment Payout Calculator | Withdrawal planner | payout amount, investment balance, frequency, time horizon | Useful decumulation component | Not retirement-system aware |
| 11 | iA Retirement Calculator | Savings planner with account variety | sex, birth date, income, retirement age, income replacement, TFSA, RRSP, LIRA, DC RPP, DB pension, province, OAS, CPP/QPP | Broad account coverage | Household, tax, and withdrawal optimization still limited |
| 12 | Wealthsimple Retirement Calculator | Quick retirement estimate | age, income, savings, registered share, province, marital status, extra retirement income, life expectancy | Fast UX and some tax/inflation assumptions | Uses average CPP/OAS defaults and limited public benefit fidelity |
| 13 | GetSmarterAboutMoney Retirement Cash Flow Calculator | Cash flow planner | age, retirement age, income, CPP/QPP, OAS, pension, expenses, RRSP, TFSA, non-registered, one-time expenses | Best publicly visible cash flow model | Limited tax sophistication and household depth |
| 14 | GetSmarterAboutMoney RRIF Withdrawal Calculator | RRIF drawdown | current or retirement RRIF value, first withdrawal age, spouse age, return, extra withdrawal, province | Good RRIF rule exposure | Single-account view only |
| 15 | Empire Life RRSP Calculator | Savings planner | age, retirement age, years retired, income, return, inflation, current assets, desired retirement income, monthly RRSP contribution | Simple savings story | RRSP-centric and rule-light |
| 16 | Empire Life RRIF Calculator | RRIF drawdown | RRIF balance and income potential | Good income-from-RRIF view | Narrow scope |
| 17 | Empire Life LIF Calculator | Locked-in decumulation | LIF balance and income potential | Covers locked-in assets | Narrow scope |
| 18 | Mackenzie Retirement Calculator | Advisor retirement planner | savings and retirement income needs | Advisor-facing planning breadth | Details not fully exposed publicly |
| 19 | Mackenzie RRIF Payment Calculator | RRIF rules | minimum withdrawals and longevity | Strong decumulation component | Narrow scope |
| 20 | Mackenzie LIF Payment Calculator / Investment Withdrawal Calculator | LIF and generic withdrawal | payments, portfolio duration | Useful modular tools | No household, tax, or benefit integration |

### 2.2 Clear Patterns Across the Market

Most tools split into four product types:

- `Full planner`: retirement goal + savings + pensions
- `Budget planner`: spending and cash flow before/after retirement
- `Savings planner`: how much to save before retirement
- `Drawdown planner`: RRIF/LIF/annuity/investment withdrawal

Most tools are weak in at least one of these areas:

- after-tax modeling,
- household and spouse planning,
- government benefit fidelity,
- RRIF/LIF and drawdown sequencing,
- survivor scenarios,
- province-specific logic,
- optimization and stress testing.

### 2.3 Product Opportunity

To be meaningfully better than the market, our calculator must combine:

- `planning` + `budgeting` + `benefit estimation` + `drawdown simulation`
- `single` and `couple` household support
- `pre-retirement` and `post-retirement` cash flow
- `before-tax` and `after-tax` views
- `deterministic` and `stress-test / Monte Carlo` outputs

## 3. Product Goals

### 3.1 Primary Goal

Help a Canadian household answer:

"Can I retire when I want, in Canada, with the lifestyle I want, after taxes and public-benefit rules are taken into account?"

### 3.2 Secondary Goals

- Show which variable matters most: savings rate, retirement age, spending, returns, taxes, benefit timing, housing, or longevity.
- Give users a realistic annual and monthly retirement cash flow projection.
- Show the tradeoffs of taking CPP/QPP/OAS earlier or later.
- Highlight tax-sensitive decisions such as RRSP/RRIF withdrawals, pension splitting, OAS clawback, and GIS eligibility.
- Support advisors or power users with a detailed mode.

### 3.3 Non-Goals For The First Release

- Full estate law and probate modeling
- Insurance recommendation engine
- Investment product recommendation engine
- Portfolio construction advice
- U.S. cross-border retirement tax engine

## 4. Core Design Principles

1. Canada-first, not generic.
2. Household-first, not individual-only.
3. Cash-flow-first, not rule-of-thumb-first.
4. After-tax outputs must be first-class.
5. Public benefits must be explicit, not hidden assumptions.
6. Assumptions must be editable and visible.
7. Quick mode and expert mode should share one underlying engine.
8. Quebec must be treated as a special ruleset, not a tiny toggle.

## 5. Target Users

Detailed persona stress test:

- See `docs/canadian-retirement-persona-coverage.md` for a 30-persona coverage review against the current PRD.

### 5.1 Primary Personas

- `Pre-retiree employee`: age 45-64, wants to know if current savings are enough.
- `Near-retiree couple`: one or both members retiring in the next 10 years, needs spouse-aware planning.
- `Retiree in drawdown`: already retired, wants to know whether money lasts and how to draw efficiently.
- `Advisor / planner / power user`: wants more knobs, account-level inputs, and scenario comparison.
- `Immigrant / partial-benefit household`: may have shorter Canadian residence history, shorter CPP/QPP contribution history, or foreign pension income.

### 5.2 Jobs To Be Done

- "Tell me whether I can retire at 60, 65, 67, or 70."
- "Show me how much I can safely spend after tax."
- "Tell me when to take CPP/QPP and OAS."
- "Show the impact of delaying retirement by 2 years."
- "Show what happens if I downsize, keep working part-time, or increase travel."
- "Show what happens if one spouse dies first."
- "Show whether OAS clawback or GIS should affect my drawdown strategy."

## 6. Scope By Release

### 6.1 MVP

MVP should support:

- single and couple households,
- all provinces and territories,
- special Quebec mode,
- immigrant and partial-benefit households,
- accumulation plus retirement drawdown,
- RRSP, RRIF, TFSA, non-registered, cash,
- DB pension and DC pension as inputs,
- CPP/QPP and OAS,
- annual federal + provincial income tax estimate,
- pension income splitting,
- OAS recovery tax warning,
- one-time expenses,
- deterministic base case,
- scenario comparison.

### 6.2 V2

- GIS and Allowance engine
- LIRA / LIF detailed rules by jurisdiction
- Monte Carlo
- asset location and drawdown optimization
- survivor-income engine
- healthcare / long-term care scenario packs
- home sale / downsizing / reverse mortgage scenarios
- annuity modeling

### 6.3 V3

- statement import
- CRA / My Service Canada statement-driven setup
- optimization recommendations
- advisor-facing printable reports

## 7. Functional Requirements

### 7.1 Input Modes

The product should support three input modes that all map to the same engine:

- `Quick Estimate`: fast setup using broad assumptions
- `Guided Planner`: step-by-step consumer flow
- `Detailed Planner`: account-level and rule-level setup

### 7.2 Required Output Views

- retirement readiness summary
- projected retirement start age options
- annual and monthly income before tax and after tax
- annual and monthly spending
- year-by-year account balances
- government benefit schedule
- taxes by year
- OAS clawback and GIS flags
- withdrawal breakdown by account
- stress-test outcomes
- shortfall / surplus explanation

### 7.3 Required Comparison Views

- retire at age X vs Y
- CPP/QPP start ages
- OAS start ages
- base spending vs higher spending
- conservative vs normal vs optimistic returns
- single-life vs survivor-life outcome

## 8. Variable Dictionary

Variables below are the planning variables the engine should support. Not every variable must appear in Quick Estimate mode, but the engine should be designed to carry them.

### 8.1 Household Profile

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| household_type | enum | yes | single, married, common-law |
| province_of_residence | enum | yes | province/territory at retirement start |
| province_history | list | later | needed for moves and tax changes |
| user_current_age | number | yes | current age |
| partner_current_age | number | yes if partner | current age of spouse/partner |
| user_sex | enum | optional | for life expectancy defaults only |
| partner_sex | enum | optional | for life expectancy defaults only |
| user_citizenship_or_status | enum | later | helpful for OAS edge cases |
| partner_citizenship_or_status | enum | later | helpful for OAS edge cases |
| marital_status_change_events | list | later | widowhood, divorce, remarriage |

### 8.2 Timing And Longevity

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| plan_start_date | date | yes | simulation start |
| user_retirement_age | number | yes | can differ from pension start ages |
| partner_retirement_age | number | yes if partner | one spouse can retire later |
| user_life_expectancy | number | yes | editable default |
| partner_life_expectancy | number | yes if partner | editable default |
| user_death_age_scenarios | list | later | survivor planning |
| partner_death_age_scenarios | list | later | survivor planning |
| max_projection_age | number | yes | hard stop, e.g. 100 or 105 |

### 8.3 Earnings And Work

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| user_current_employment_income | currency | yes | pre-tax |
| partner_current_employment_income | currency | yes if partner | pre-tax |
| user_bonus_or_variable_income | currency | optional | separate from base salary |
| partner_bonus_or_variable_income | currency | optional | separate from base salary |
| user_salary_growth_rate | percent | yes | nominal or real toggle |
| partner_salary_growth_rate | percent | yes if partner | nominal or real toggle |
| user_part_time_income_in_retirement | currency schedule | yes | bridge income / phased retirement |
| partner_part_time_income_in_retirement | currency schedule | yes if partner | phased retirement |
| cpp_post_retirement_working_years | integer | later | for PRB logic |
| qpp_post_retirement_working_years | integer | later | for retirement supplement logic |

### 8.4 Public Benefits

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| user_cpp_or_qpp_mode | enum | yes | CPP or QPP |
| partner_cpp_or_qpp_mode | enum | yes if partner | CPP or QPP |
| user_cpp_qpp_statement_amount | currency | optional | preferred if available |
| partner_cpp_qpp_statement_amount | currency | optional | preferred if available |
| user_cpp_qpp_estimate_mode | enum | yes | statement-at-65, manual-at-start-age, entitlement-percent |
| partner_cpp_qpp_estimate_mode | enum | yes if partner | statement-at-65, manual-at-start-age, entitlement-percent |
| user_cpp_qpp_manual_amount_at_start_age | currency | optional | useful when statement is not available or immigrant case is irregular |
| partner_cpp_qpp_manual_amount_at_start_age | currency | optional | useful when statement is not available or immigrant case is irregular |
| user_cpp_qpp_entitlement_percent | percent | optional | fallback if no statement |
| partner_cpp_qpp_entitlement_percent | percent | optional | fallback if no statement |
| user_cpp_qpp_start_age | number | yes | CPP 60-70, QPP 60-72 |
| partner_cpp_qpp_start_age | number | yes if partner | CPP 60-70, QPP 60-72 |
| user_immigration_age_to_canada | number | optional | helps explain partial-benefit context |
| partner_immigration_age_to_canada | number | optional | helps explain partial-benefit context |
| user_oas_start_age | number | yes | 65-70 |
| partner_oas_start_age | number | yes if partner | 65-70 |
| user_oas_estimate_mode | enum | yes | residence-years or manual-at-start-age |
| partner_oas_estimate_mode | enum | yes if partner | residence-years or manual-at-start-age |
| user_manual_oas_amount_at_start_age | currency | optional | supports edge or advisor-entered cases |
| partner_manual_oas_amount_at_start_age | currency | optional | supports edge or advisor-entered cases |
| user_years_resided_in_canada_after_18 | number | yes | needed for partial OAS |
| partner_years_resided_in_canada_after_18 | number | yes if partner | needed for partial OAS |
| user_has_social_security_agreement_country | boolean | later | treaty cases may change eligibility framing |
| partner_has_social_security_agreement_country | boolean | later | treaty cases may change eligibility framing |
| user_oas_eligible | boolean | yes | based on age/status/residence |
| partner_oas_eligible | boolean | yes if partner | based on age/status/residence |
| gis_modeling_enabled | boolean | later | advanced low-income planning |
| allowance_modeling_enabled | boolean | later | spouse age 60-64 case |
| foreign_public_pension_income | list | yes | immigrant and treaty cases often need this |
| survivor_benefit_inputs | list | later | CPP survivor, foreign survivor pension |

### 8.5 Workplace Pensions

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| user_db_pension_annual_amount | currency | yes | if known from statement |
| partner_db_pension_annual_amount | currency | yes if partner | if known from statement |
| user_db_pension_start_age | number | yes | can differ from retirement age |
| partner_db_pension_start_age | number | yes if partner | can differ from retirement age |
| user_db_pension_indexation_rate | percent | optional | full, partial, none |
| partner_db_pension_indexation_rate | percent | optional | full, partial, none |
| user_db_bridge_to_65 | currency | later | public-sector style bridge benefit |
| partner_db_bridge_to_65 | currency | later | public-sector style bridge benefit |
| user_dc_plan_balance | currency | yes | can map to registered assets |
| partner_dc_plan_balance | currency | yes if partner | can map to registered assets |
| employer_match_rate | percent | optional | accumulation stage only |
| pension_split_eligible | boolean | yes | tax optimization |

### 8.6 Personal Accounts

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| user_rrsp_balance | currency | yes | includes personal RRSP |
| user_spousal_rrsp_balance | currency | later | attribution-sensitive |
| user_rrif_balance | currency | yes | if already retired |
| user_tfsa_balance | currency | yes | tax-free bucket |
| user_non_registered_balance | currency | yes | taxable bucket |
| user_cash_balance | currency | optional | emergency / spending reserve |
| user_lira_balance | currency | later | locked-in rules |
| user_lif_balance | currency | later | drawdown rules |
| user_annuity_income | currency schedule | later | guaranteed income stream |
| partner_rrsp_balance | currency | yes if partner | same logic as user |
| partner_rrif_balance | currency | yes if partner | same logic as user |
| partner_tfsa_balance | currency | yes if partner | same logic as user |
| partner_non_registered_balance | currency | yes if partner | same logic as user |
| partner_lira_balance | currency | later | locked-in rules |
| partner_lif_balance | currency | later | drawdown rules |

### 8.7 Contributions And Room

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| user_rrsp_annual_contribution | currency | yes | pre-retirement |
| user_tfsa_annual_contribution | currency | yes | pre-retirement |
| user_non_registered_annual_contribution | currency | yes | pre-retirement |
| partner_rrsp_annual_contribution | currency | yes if partner | pre-retirement |
| partner_tfsa_annual_contribution | currency | yes if partner | pre-retirement |
| partner_non_registered_annual_contribution | currency | yes if partner | pre-retirement |
| user_rrsp_room_remaining | currency | optional | warning and validation |
| partner_rrsp_room_remaining | currency | optional | warning and validation |
| user_tfsa_room_remaining | currency | optional | warning and validation |
| partner_tfsa_room_remaining | currency | optional | warning and validation |
| contribution_escalation_rate | percent | yes | usually inflation-linked |

### 8.8 Investment Assumptions

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| pre_retirement_return_rate | percent | yes | nominal by default |
| post_retirement_return_rate | percent | yes | nominal by default |
| inflation_rate | percent | yes | central inflation assumption |
| fee_rate | percent | optional | MER / advisory fee drag |
| non_registered_income_mix | enum | later | interest / dividends / capital gains split |
| real_return_mode | boolean | optional | advanced assumption toggle |
| monte_carlo_return_distribution | object | later | V2 |
| monte_carlo_inflation_distribution | object | later | V2 |

### 8.9 Spending And Cash Flow

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| target_income_replacement_ratio | percent | optional | quick estimate mode |
| desired_after_tax_spending | currency | yes | preferred retirement target |
| housing_expense | currency | yes | mortgage, rent, property tax, maintenance |
| utilities_expense | currency | yes | hydro, water, internet, phone |
| food_expense | currency | yes | groceries + dining |
| transportation_expense | currency | yes | car, transit, fuel, insurance |
| healthcare_expense | currency | yes | prescriptions, dental, uncovered services |
| insurance_expense | currency | yes | life, health, home, auto |
| family_support_expense | currency | optional | kids, parents, grandchildren |
| travel_and_recreation_expense | currency | yes | lifestyle variable |
| gifts_and_donations_expense | currency | optional | values-driven planning |
| professional_services_expense | currency | optional | tax prep, legal, advice |
| debt_payments | currency | yes | loans, credit lines, mortgage carryover |
| long_term_care_reserve | currency | later | aging and care shock |
| legacy_savings_goal | currency | optional | intentional leftover target |

### 8.10 One-Time Events

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| one_time_expense_events | list | yes | car, renovation, wedding, move |
| one_time_income_events | list | yes | inheritance, home sale proceeds |
| home_downsizing_event | object | later | property sale and housing reset |
| business_sale_event | object | later | liquidity event |
| pension_commutation_event | object | later | lump sum vs annuity choice |

### 8.11 Tax Strategy Variables

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| pension_income_splitting_enabled | boolean | yes | couple tax planning |
| preferred_withdrawal_order | enum | yes | customizable with default strategy |
| rrsp_to_rif_conversion_age | number | yes | usually 71 deadline aware |
| use_spouse_age_for_rif_minimum | boolean | later | RRIF setup optimization |
| oas_clawback_aware_mode | boolean | yes | warnings in MVP, optimization later |
| gis_preservation_mode | boolean | later | low-income optimization |

### 8.12 Reporting Variables

| Variable | Type | MVP | Notes |
| --- | --- | --- | --- |
| results_currency_mode | enum | yes | nominal dollars vs today's dollars |
| display_frequency | enum | yes | monthly and annual |
| success_threshold | percent | later | Monte Carlo definition of success |
| shortfall_tolerance | currency | optional | acceptable annual gap |

## 9. Calculation Engine Specification

### 9.1 Simulation Timeline

The core engine should project from `plan_start_date` until the last modeled death age or `max_projection_age`.

Recommended simulation grain:

- monthly engine for benefits, withdrawals, taxes, and retirement start timing
- annual summary layer for charts and tables

### 9.2 Calculation Order

The calculation order matters. Recommended order:

1. `Normalize inputs`
2. `Build household timeline`
3. `Project pre-retirement earnings and contributions`
4. `Grow assets during accumulation`
5. `Trigger retirement events`
6. `Start public benefits based on eligibility and elected ages`
7. `Start workplace pensions and bridge benefits`
8. `Convert RRSP assets to RRIF by required age`
9. `Calculate minimum / required withdrawals`
10. `Apply chosen drawdown order for spending gap`
11. `Estimate taxable income by spouse`
12. `Apply pension splitting if enabled and beneficial`
13. `Estimate federal + provincial tax`
14. `Apply OAS recovery tax logic`
15. `Apply GIS / Allowance logic when supported`
16. `Update after-tax cash flow`
17. `Adjust balances for growth, withdrawals, and one-time events`
18. `Repeat for each period`
19. `Run alternative scenarios / stress tests`

### 9.3 Public Benefit Logic

#### CPP

- Start age can be 60 through 70.
- Starting before 65 reduces benefits by 0.6% per month.
- Starting after 65 increases benefits by 0.7% per month up to age 70.
- User-entered statement amount should override crude averages whenever available.
- PRB should be a later enhancement if the user works while receiving CPP.

#### QPP

- Must be treated separately from CPP.
- Start age can extend to age 72.
- Delayed pension increases continue to 72.
- Quebec retirement supplement logic for working after retirement should be handled in later versions if not ready in MVP.

#### OAS

- Start age can be 65 through 70.
- Delaying after 65 increases benefit by 0.6% per month up to 70.
- Full OAS generally assumes 40 years of Canadian residence after age 18.
- Partial OAS must be modeled for shorter residence histories.
- OAS recovery tax must be checked against net income thresholds.

#### GIS / Allowance

- GIS should depend on marital status, OAS status, and prior-year income.
- This is important for low-income retirees and should not be ignored forever.
- If not fully implemented in MVP, the UI should clearly say so.

### 9.4 Drawdown Logic

The engine should support at least these strategies:

- `RRSP/RRIF first`
- `TFSA first`
- `Taxable first`
- `Blended tax-aware`
- `Custom order`

The default strategy should be a tax-aware blended strategy, not a naive first-bucket approach.

Drawdown must account for:

- RRIF minimums,
- taxable vs tax-free withdrawals,
- OAS clawback sensitivity,
- preserving lower-bracket space,
- spouse balance coordination.

### 9.5 Tax Logic

MVP tax engine should estimate:

- federal income tax,
- provincial or territorial tax,
- pension income amount,
- age amount,
- pension splitting,
- taxable RRSP/RRIF withdrawals,
- taxable DB pension and annuity income,
- non-registered investment income using a simplified mix,
- OAS recovery tax.

Future tax enhancements:

- precise dividend and capital gains treatment,
- Quebec return-specific handling,
- foreign pension treatment,
- medical expense credit interactions.

### 9.6 Spending Logic

Retirement spending should support:

- fixed base lifestyle costs,
- inflation-linked discretionary spending,
- declining or rising spending profiles,
- early-retirement "go-go years" vs later "slow-go years",
- healthcare escalation,
- one-time shocks.

### 9.7 Survivor Logic

The engine should eventually support:

- one spouse dies first,
- OAS/GIS status changes,
- household tax filing changes,
- spending drops but not by 50%,
- pension continuation percentages,
- asset transfer assumptions.

For MVP, at minimum include:

- a simple survivor scenario toggle,
- reduced household spending percentage,
- income source continuation rules where known.

## 10. Data And Rule Tables To Maintain

Do not hardcode these values inside the calculator logic. Put them in dated rule tables.

Required tables:

- federal tax brackets and credits by tax year
- provincial and territorial tax brackets and credits by tax year
- CPP rules and maximum benefit tables by year
- QPP rules and maximum benefit tables by year
- OAS rates by quarter and age band
- OAS recovery thresholds by recovery period
- GIS / Allowance thresholds and maximums by quarter
- RRSP annual dollar limit by year
- TFSA dollar limit by year
- YMPE and YAMPE by year
- RRIF minimum factors by age
- LIF minimum and maximum rules by jurisdiction

## 11. Current Official Rule Anchors To Reflect

These are especially important because they are date-sensitive:

- CPP start range is age 60 to 70, with 0.6% monthly reduction before 65 and 0.7% monthly increase after 65.
- Maximum CPP retirement pension at age 65 is $1,507.65 per month in January 2026.
- OAS can start at 65 and be delayed to 70, with a 0.6% monthly increase for delay.
- OAS recovery threshold for the July 2026 to June 2027 recovery period is based on 2025 income over $93,454.
- TFSA annual dollar limit for 2026 is $7,000.
- RRSP annual dollar limit for 2026 is $33,810.
- RRIF withdrawals must respect CRA minimum factors.
- QPP delayed retirement increases continue to age 72.

## 12. Product Risks And Failure Modes

If we do these poorly, the product will feel wrong even if the math is technically "working":

- hiding assumptions,
- using average CPP/OAS numbers without telling the user,
- ignoring spouse tax interactions,
- ignoring partial OAS and residence history,
- ignoring Quebec differences,
- using only pre-tax numbers,
- using only one retirement date for both spouses,
- ignoring one-time expenses,
- assuming spending is flat forever,
- assuming portfolio return is stable every year,
- not showing when money runs out.

## 13. Open Product Decisions

These need explicit decisions before implementation:

1. Should default output be in nominal dollars, today's dollars, or both?
2. Should Quick Estimate use replacement ratio or spending-based planning by default?
3. Should GIS be MVP or V2?
4. Should Quebec tax and QPP launch in MVP or be a staged rollout?
5. How deep should non-registered tax modeling be in MVP?
6. What is the default drawdown strategy?
7. How much optimization do we do automatically vs show manually?
8. Do we support home equity in MVP or treat it as a one-time event only?
9. For QPP edge cases, do we require manual entered amounts when a user does not have a current statement?

## 14. Recommended Build Plan

### Phase 0: Foundation

- finalize PRD and rule table structure
- define canonical variable schema
- define simulation order
- define annual and monthly output schema

### Phase 1: Deterministic Household Engine

- single and couple support
- accumulation and drawdown
- RRSP, RRIF, TFSA, taxable assets
- CPP/QPP, OAS
- DB pension inputs
- annual tax estimate
- scenario comparison

### Phase 2: Canadian Retirement Depth

- GIS / Allowance
- RRIF and LIF depth
- spouse-aware drawdown
- survivor planning
- better taxable-account modeling

### Phase 3: Stress Testing And Optimization

- Monte Carlo
- sequence of returns analysis
- tax-aware drawdown optimization
- benefit timing optimization

## 15. Appendix: Source Set

### 15.1 Official Government Sources

- Government of Canada: Canadian Retirement Income Calculator  
  https://www.canada.ca/en/services/benefits/publicpensions/cpp/retirement-income-calculator.html
- Government of Canada: Old Age Security Benefits Estimator  
  https://estimateursv-oasestimator.service.canada.ca/en
- Government of Canada: CPP retirement pension, when to start  
  https://www.canada.ca/en/services/benefits/publicpensions/cpp/when-start.html
- Government of Canada: CPP retirement pension, amount  
  https://www.canada.ca/en/services/benefits/publicpensions/cpp/amount.html
- Government of Canada: OAS when to start  
  https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/when-start.html
- Government of Canada: OAS recovery tax  
  https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html
- Government of Canada: OAS eligibility  
  https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/eligibility.html
- Government of Canada: GIS eligibility  
  https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/guaranteed-income-supplement/eligibility.html
- Government of Canada: GIS amount  
  https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/guaranteed-income-supplement/benefit-amount.html
- Government of Canada: 2026 CPP and OAS maximum figures  
  https://www.canada.ca/en/employment-social-development/programs/pensions/pension/statistics/2026-quarterly-january-march.html
- CRA: TFSA contribution room  
  https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributing/calculate-room.html
- CRA: MP, DB, RRSP, DPSP, ALDA, TFSA limits, YMPE and YAMPE  
  https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html
- CRA: Minimum amount from a RRIF  
  https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/completing-slips-summaries/t4rsp-t4rif-information-returns/payments/minimum-amount-a-rrif.html
- CRA: Chart - Prescribed factors  
  https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/completing-slips-summaries/t4rsp-t4rif-information-returns/payments/chart-prescribed-factors.html
- CRA: Age amount  
  https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-30100-amount.html
- CRA: Pension income amount  
  https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31400-pension-income-amount.html
- CRA: Pension income splitting / elected split-pension amount  
  https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/pension-income-splitting/other-topics.html
  https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-11600-elected-split-pension-amount.html
- Retraite Quebec: Calculation of Your Retirement Pension Under the Quebec Pension Plan  
  https://www.rrq.gouv.qc.ca/en/retraite/rrq/calcul_rente/Pages/calcul_rente.aspx

### 15.2 Market Benchmark Sources

- Desjardins Retirement Calculator  
  https://www.desjardins.com/ca/tools/retirement-calculator/index.jsp
- Sun Life tools and calculators  
  https://www.sunlife.ca/en/tools-and-resources/tools-and-calculators/
- Sun Life retirement savings tools page  
  https://www.sunlife.ca/en/tools-and-resources/money-and-finances/saving-for-retirement/
- CIBC retirement savings calculator  
  https://www.cibc.com/en/personal-banking/smart-advice/tools-calculators/retirement-savings-calculator.html
- CIBC retirement budget calculator  
  https://www.cibc.com/en/personal-banking/smart-advice/tools-calculators/retirement-budget-calculator.html
- RBC retirement budget calculator  
  https://www.rbcroyalbank.com/retirement/retirement-budget-calculator/before-after-budget-calculator.html
- BMO investment payout calculator  
  https://www.bmo.com/main/personal/financial-planning/investment-payout-calculator/
- iA retirement calculator  
  https://ia.ca/retirement-calculator
- iA practical tools  
  https://ia.ca/individuals/practical-tools
- Wealthsimple retirement calculator  
  https://www.wealthsimple.com/en-ca/tool/retirement-calculator
- GetSmarterAboutMoney retirement cash flow calculator  
  https://www.getsmarteraboutmoney.ca/calculators/retirement-cash-flow-calculator/
- GetSmarterAboutMoney RRIF withdrawal calculator  
  https://www.getsmarteraboutmoney.ca/tool-embeds/rrif-withdrawal-calculator/
- Empire Life forms and tools  
  https://www.empire.ca/forms-and-tools
- Empire Life RRSP calculator  
  https://www.empire.ca/forms-tools/rrsp-calculator
- Empire Life RRIF calculator  
  https://www.empire.ca/forms-tools/rrif-calculator
- Empire Life LIF calculator  
  https://www.empire.ca/forms-tools/lif-calculator
- Empire Life "How long will my money last?"  
  https://www.empire.ca/forms-and-tools/how-long-will-my-money-last
- Mackenzie tools and calculators  
  https://www.mackenzieinvestments.com/en/resources/tools-and-calculators
- Mackenzie retirement calculator  
  https://www.mackenzieinvestments.com/en/resources/tools-and-calculators/retirement-calculator
- Mackenzie LIF calculator  
  https://www.mackenzieinvestments.com/en/resources/tools-and-calculators/lif-calculator
- Mackenzie investment withdrawal calculator  
  https://www.mackenzieinvestments.com/en/resources/tools-and-calculators/investment-withdrawal-calculator
