# Canadian Retirement Golden 10 Acceptance Spec

Last updated: 2026-03-30

## 1. Purpose

This document defines the first 10 fixture scenarios that the retirement engine should eventually pass.

These are not unit tests yet. They are human-readable acceptance targets that will guide:

- engine implementation,
- fixture validation,
- later automated tests,
- frontend intake coverage.

## 2. Golden 10 Fixture Index

| ID | Fixture | Scenario |
| --- | --- | --- |
| G01 | [golden-on-single-saver.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-single-saver.json) | Ontario salaried single saver |
| G02 | [golden-on-couple-core.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-couple-core.json) | Ontario dual-income couple |
| G03 | [golden-on-db-pension.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-db-pension.json) | Ontario DB pension employee |
| G04 | [golden-on-phased-retiree.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-phased-retiree.json) | Ontario phased retiree |
| G05 | [golden-on-early-retiree.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-early-retiree.json) | Ontario early retiree |
| G06 | [golden-on-high-income-clawback.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-high-income-clawback.json) | High-income OAS clawback case |
| G07 | [golden-on-rrif-couple.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-rrif-couple.json) | Already retired RRIF couple |
| G08 | [golden-qc-couple-core.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-qc-couple-core.json) | Quebec couple core |
| G09 | [golden-bc-immigrant-partial-oas.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-bc-immigrant-partial-oas.json) | BC immigrant partial OAS |
| G10 | [golden-on-rental-income-retiree.json](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/data/fixtures/golden/golden-on-rental-income-retiree.json) | Ontario rental-income retiree |

## 3. Acceptance Scenarios

### G01: Ontario Salaried Single Saver

Goal:

- validate the simplest mainstream accumulation-to-retirement flow.

Must-pass expectations:

- CPP income begins at the elected age, not before.
- OAS income begins at age 65, not before.
- spending is inflation-aware over time.
- no spouse-only logic should appear in outputs.
- no partial OAS warning should appear.

Known limitations to tolerate for now:

- detailed provincial tax accuracy,
- full account drawdown realism,
- non-registered tax character.

### G02: Ontario Dual-Income Couple

Goal:

- validate the baseline household model.

Must-pass expectations:

- both people remain distinct in ages and retirement timing.
- partner retirement at 63 should not force primary retirement at 65 or vice versa.
- spouse incomes should both be present in the projection.
- pension splitting inputs should be preserved and later affect tax behavior.
- one-time events should remain visible in the timeline.

Known limitations to tolerate for now:

- optimized pension splitting,
- survivor logic,
- fully realistic drawdown ordering.

### G03: Ontario DB Pension Employee

Goal:

- prove that employer pension income is not flattened into generic retirement income.

Must-pass expectations:

- DB pension appears as a distinct income source.
- DB pension begins at the configured age.
- CPP and OAS remain separate from DB pension.
- the scenario should remain viable even with smaller personal savings than the non-DB cases.

Known limitations to tolerate for now:

- bridge-to-65 logic may be placeholder,
- survivor continuation may not yet change results.

### G04: Ontario Phased Retiree

Goal:

- validate transition years where retirement is not a clean stop.

Must-pass expectations:

- part-time retirement income appears only between the configured ages.
- retirement income should show a different pattern before and after phased work ends.
- CPP and OAS should still respect their own start ages, independent of part-time work.

Known limitations to tolerate for now:

- PRB-like post-retirement public pension enhancement,
- advanced tax interactions between work income and benefits.

### G05: Ontario Early Retiree

Goal:

- validate long bridge periods before public benefits begin.

Must-pass expectations:

- OAS should remain zero before age 65.
- CPP should remain zero before its elected start age of 70.
- the model should show a long savings-funded retirement bridge.
- delayed public benefits should produce larger later-life benefit amounts than age-65 start assumptions.

Known limitations to tolerate for now:

- exact drawdown sequencing,
- Monte Carlo sequence risk analysis.

### G06: High-Income OAS Clawback Case

Goal:

- force the engine to confront OAS recovery tax behavior.

Must-pass expectations:

- OAS should still appear as income if the person is eligible.
- OAS recovery tax should become positive once income crosses the applicable threshold.
- the result should clearly distinguish ordinary tax from OAS recovery tax.
- high pension and annuity income should push this scenario into a clawback-sensitive zone.

Known limitations to tolerate for now:

- exact final tax optimization,
- withdrawal-order tuning to reduce clawback.

### G07: Already Retired RRIF Couple

Goal:

- validate current retirees rather than only pre-retirees.

Must-pass expectations:

- RRIF balances must be represented distinctly from RRSP balances.
- age-71-plus RRIF warnings should appear.
- both spouses should still retain separate public benefit and pension amounts.
- current retirees should not show pre-retirement employment growth assumptions affecting cash flow.

Known limitations to tolerate for now:

- exact RRIF minimum withdrawal math,
- spouse-age-elected RRIF minimum optimization.

### G08: Quebec Couple Core

Goal:

- validate that Quebec is not silently treated like Ontario.

Must-pass expectations:

- both household members should stay on the Quebec path.
- QPP should remain distinct from CPP in assumptions and messaging.
- delayed-start or manual QPP inputs should remain editable.
- the scenario should surface that Quebec-specific depth is required.

Known limitations to tolerate for now:

- precise Quebec tax implementation,
- full QPP delayed-start math beyond manual override support.

### G09: BC Immigrant Partial OAS

Goal:

- validate adult-immigrant retirement planning.

Must-pass expectations:

- partial OAS should be based on a shorter residence history, not full OAS.
- manual CPP entry at start age should be respected.
- foreign pension income should appear as planned income.
- the scenario should warn that treaty or social-security-agreement cases need careful handling.

Known limitations to tolerate for now:

- treaty-country logic,
- foreign pension tax treatment depth.

### G10: Ontario Rental-Income Retiree

Goal:

- validate non-employment recurring income in retirement.

Must-pass expectations:

- rental income should appear on the configured schedule.
- rental income should remain distinct from CPP, OAS, and pension income.
- one-time property-related outflows should be visible in the timeline.
- the scenario should still support ordinary retirement-income planning around that rental stream.

Known limitations to tolerate for now:

- advanced rental tax treatment,
- capital cost allowance and recapture treatment.

## 4. Recommended Automation Later

When we start writing automated tests, each Golden 10 case should have:

1. a fixture load test,
2. a smoke simulation test,
3. a set of scenario assertions,
4. a snapshot or tabular summary test for key output rows.
