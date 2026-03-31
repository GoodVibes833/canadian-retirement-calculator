import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const buildEntryUrl = pathToFileURL(path.join(projectRoot, ".build", "index.js")).href;
const { estimateIncomeTax, simulateRetirementPlan } = await import(buildEntryUrl);

const rules = readJson("data/rules/canada/2026-01-01.json");

const scenarios = [
  {
    id: "G01",
    label: "Ontario single saver",
    fixture: "data/fixtures/golden/golden-on-single-saver.json",
    checks(result) {
      const age64 = byPrimaryAge(result, 64);
      const age65 = byPrimaryAge(result, 65);

      assert(age64.oasIncome === 0, "OAS should be zero before age 65.");
      assert(age65.oasIncome > 0, "OAS should begin at age 65.");
    },
  },
  {
    id: "G02",
    label: "Ontario couple core",
    fixture: "data/fixtures/golden/golden-on-couple-core.json",
    checks(result) {
      const retirementYear = result.years.find(
        (year) => year.primaryAge === 65 && year.partnerAge === 63,
      );

      assert(retirementYear, "Retirement transition year should exist.");
      assert(
        retirementYear.employmentIncome > 0,
        "Phased or bridge employment income should remain visible in retirement transition.",
      );
    },
  },
  {
    id: "G03",
    label: "Ontario DB pension",
    fixture: "data/fixtures/golden/golden-on-db-pension.json",
    checks(result) {
      const age59 = byPrimaryAge(result, 59);
      const age60 = byPrimaryAge(result, 60);

      assert(age59.dbPensionIncome === 0, "DB pension should not begin before start age.");
      assert(age60.dbPensionIncome > 0, "DB pension should begin at configured start age.");
    },
  },
  {
    id: "G04",
    label: "Ontario phased retiree",
    fixture: "data/fixtures/golden/golden-on-phased-retiree.json",
    checks(result) {
      const age64 = byPrimaryAge(result, 64);
      const age68 = byPrimaryAge(result, 68);

      assert(age64.employmentIncome > 0, "Phased retiree should still show work income during bridge years.");
      assert(age68.employmentIncome === 0, "Part-time work should end after the configured schedule.");
    },
  },
  {
    id: "G05",
    label: "Ontario early retiree",
    fixture: "data/fixtures/golden/golden-on-early-retiree.json",
    checks(result) {
      const age64 = byPrimaryAge(result, 64);
      const age69 = byPrimaryAge(result, 69);
      const age70 = byPrimaryAge(result, 70);

      assert(age64.oasIncome === 0, "OAS should remain zero before 65.");
      assert(age69.cppQppIncome === 0, "CPP should remain zero before elected age 70.");
      assert(age70.cppQppIncome > 0, "CPP should begin at elected age 70.");
    },
  },
  {
    id: "G06",
    label: "High-income OAS clawback",
    fixture: "data/fixtures/golden/golden-on-high-income-clawback.json",
    checks(result) {
      const first = result.years[0];

      assert(first.oasIncome > 0, "OAS income should exist in the high-income scenario.");
      assert(first.oasRecoveryTax > 0, "OAS recovery tax should be positive in the clawback scenario.");
    },
  },
  {
    id: "G07",
    label: "RRIF couple",
    fixture: "data/fixtures/golden/golden-on-rrif-couple.json",
    checks(result) {
      const first = result.years[0];

      assert(first.rrspRrifWithdrawals > 0, "RRIF couple should show registered withdrawals.");
      assert(
        first.warnings.some((warning) => warning.includes("RRIF")),
        "RRIF scenario should surface a RRIF-related warning.",
      );
    },
  },
  {
    id: "G08",
    label: "Quebec couple",
    fixture: "data/fixtures/golden/golden-qc-couple-core.json",
    checks(result) {
      const first = result.years[0];

      assert(
        first.warnings.some((warning) => warning.includes("Quebec") || warning.includes("QPP")),
        "Quebec scenario should surface Quebec or QPP-specific warnings.",
      );
    },
  },
  {
    id: "G09",
    label: "BC immigrant partial OAS",
    fixture: "data/fixtures/golden/golden-bc-immigrant-partial-oas.json",
    checks(result) {
      const age65 = byPrimaryAge(result, 65);

      assert(age65.oasIncome > 0, "Partial OAS case should still receive some OAS at 65.");
      assert(age65.oasIncome < 8907.72, "Partial OAS should remain below a full annual OAS amount.");
      assert(age65.otherPlannedIncome > 0, "Foreign pension income should appear as planned income.");
      assert(
        age65.warnings.some((warning) => warning.includes("Partial OAS")),
        "Partial OAS case should surface a partial-OAS warning.",
      );
    },
  },
  {
    id: "G10",
    label: "Rental-income retiree",
    fixture: "data/fixtures/golden/golden-on-rental-income-retiree.json",
    checks(result) {
      const age65 = byPrimaryAge(result, 65);

      assert(age65.otherPlannedIncome >= 24000, "Rental-income scenario should include rental income at retirement.");
    },
  },
];

let failures = 0;

for (const scenario of scenarios) {
  try {
    const input = readJson(scenario.fixture);
    const result = simulateRetirementPlan(input, rules);
    scenario.checks(result);
    console.log(`PASS ${scenario.id} ${scenario.label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${scenario.id} ${scenario.label}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

const taxChecks = [
  {
    id: "T01",
    label: "Ontario senior credits reduce tax",
    check() {
      const younger = estimateIncomeTax({
        taxableIncome: 60000,
        province: "ON",
        calendarYear: 2026,
        age: 64,
        eligiblePensionIncome: 0,
      });
      const senior = estimateIncomeTax({
        taxableIncome: 60000,
        province: "ON",
        calendarYear: 2026,
        age: 65,
        eligiblePensionIncome: 2000,
      });

      assert(
        senior.totalTax < younger.totalTax,
        "Ontario senior credits should reduce tax for a 65+ filer with eligible pension income.",
      );
    },
  },
  {
    id: "T02",
    label: "Pension splitting heuristic improves RRIF couple",
    check() {
      const enabledInput = readJson(
        "data/fixtures/golden/golden-on-rrif-couple.json",
      );
      const disabledInput = JSON.parse(JSON.stringify(enabledInput));
      disabledInput.household.pensionIncomeSplittingEnabled = false;

      const enabled = simulateRetirementPlan(enabledInput, rules);
      const disabled = simulateRetirementPlan(disabledInput, rules);
      const enabledBurden =
        enabled.years[0].taxes + enabled.years[0].oasRecoveryTax;
      const disabledBurden =
        disabled.years[0].taxes + disabled.years[0].oasRecoveryTax;

      assert(
        enabledBurden < disabledBurden,
        "Pension splitting heuristic should reduce combined first-year tax burden in the RRIF couple scenario.",
      );
      assert(
        enabled.years[0].warnings.some((warning) =>
          warning.includes("Pension splitting heuristic transferred"),
        ),
        "Pension splitting scenario should surface an applied split warning.",
      );
    },
  },
  {
    id: "T03",
    label: "Survivor rollover moves assets to surviving spouse",
    check() {
      const input = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      input.household.primary.profile.lifeExpectancy = 71;

      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];
      const primaryBalances = firstYear.endOfYearAccountBalances.primary;
      const partnerBalances = firstYear.endOfYearAccountBalances.partner;

      assert(partnerBalances, "Survivor rollover scenario should still have partner balances.");
      assert(
        Object.values(primaryBalances).every((value) => value === 0),
        "Deceased primary balances should be rolled out of the primary slot.",
      );
      assert(
        firstYear.otherPlannedIncome > 0,
        "Survivor scenario should include survivor continuation income when configured.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("Baseline survivor rollover"),
        ),
        "Survivor scenario should surface a rollover warning.",
      );
    },
  },
  {
    id: "T04",
    label: "Custom withdrawal order honors TFSA-first preference",
    check() {
      const input = readJson("data/fixtures/golden/golden-on-single-saver.json");
      input.household.primary.profile.currentAge = 65;
      input.household.primary.profile.retirementAge = 65;
      input.household.primary.profile.lifeExpectancy = 66;
      input.household.primary.employment.baseAnnualIncome = 0;
      input.household.primary.employment.bonusAnnualIncome = 0;
      input.household.primary.employment.annualGrowthRate = 0;
      input.household.primary.contributions.rrsp = 0;
      input.household.primary.contributions.tfsa = 0;
      input.household.primary.contributions.nonRegistered = 0;
      input.household.withdrawalOrder = "custom";
      input.household.customWithdrawalOrder = ["tfsa", "non-registered"];
      input.household.expenseProfile.desiredAfterTaxSpending = 20000;

      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.tfsaWithdrawals > 0,
        "Custom drawdown order should allow TFSA withdrawals to occur first.",
      );
      assert(
        firstYear.taxableWithdrawals === 0,
        "Custom TFSA-first drawdown should avoid taxable withdrawals when TFSA funds are sufficient.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("Custom withdrawal order is applied"),
        ),
        "Custom withdrawal order scenario should surface the custom-order warning.",
      );
    },
  },
  {
    id: "T05",
    label: "LIRA stays locked before planned conversion age",
    check() {
      const input = readJson("data/fixtures/locked-in/on-lira-pre-conversion.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.lifWithdrawals === 0,
        "Pre-conversion LIRA scenario should not produce LIF withdrawals.",
      );
      assert(
        firstYear.endOfYearAccountBalances.primary.lira > 0,
        "LIRA balance should remain intact before the planned conversion age.",
      );
      assert(
        firstYear.shortfallOrSurplus < 0,
        "Locked pre-conversion assets should still leave a modeled shortfall when no other cash source exists.",
      );
    },
  },
  {
    id: "T06",
    label: "Ontario LIF manual cap is respected",
    check() {
      const input = readJson("data/fixtures/locked-in/on-lif-manual-cap.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.lifWithdrawals <= 10000.01,
        "Ontario LIF withdrawals should stay within the manual annual maximum.",
      );
      assert(
        firstYear.lifWithdrawals > 0,
        "Ontario LIF scenario should produce some locked-in withdrawals.",
      );
    },
  },
  {
    id: "T07",
    label: "BC LIF fallback warning is surfaced",
    check() {
      const input = readJson("data/fixtures/locked-in/bc-lif-fallback.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.lifWithdrawals > 0,
        "BC LIF scenario should produce some locked-in withdrawals.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("fallback estimate"),
        ),
        "BC LIF scenario should warn when a fallback maximum is used.",
      );
    },
  },
  {
    id: "T08",
    label: "Alberta LIF fallback warning is surfaced",
    check() {
      const input = readJson("data/fixtures/locked-in/ab-lif-fallback.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.lifWithdrawals > 0,
        "Alberta LIF scenario should produce some locked-in withdrawals.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("fallback estimate"),
        ),
        "Alberta LIF scenario should warn when a fallback maximum is used.",
      );
    },
  },
  {
    id: "T09",
    label: "Quebec FRV age-55-plus path recognizes no statutory annual maximum",
    check() {
      const input = readJson("data/fixtures/locked-in/qc-frv-warning.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("no statutory annual maximum"),
        ),
        "Quebec FRV scenario should surface the 2025+ no-maximum warning for ages 55 and older.",
      );
      assert(
        firstYear.lifWithdrawals > 7000,
        "Quebec FRV scenario should allow withdrawals materially above the RRIF-style minimum when the spending need requires it.",
      );
    },
  },
  {
    id: "T10",
    label: "Taxable-account withdrawals realize capital gains when ACB is below market value",
    check() {
      const gainInput = readJson(
        "data/fixtures/taxable-account/on-taxable-acb-gain.json",
      );
      const flatAcbInput = readJson(
        "data/fixtures/taxable-account/on-taxable-acb-gain.json",
      );
      flatAcbInput.household.primary.taxableAccountTaxProfile.nonRegisteredAdjustedCostBase =
        flatAcbInput.household.primary.accounts.nonRegistered;

      const gainResult = simulateRetirementPlan(gainInput, rules);
      const flatAcbResult = simulateRetirementPlan(flatAcbInput, rules);
      const gainYear = gainResult.years[0];
      const flatYear = flatAcbResult.years[0];

      assert(
        gainYear.taxableWithdrawals > 0,
        "Taxable-account gain scenario should draw from the non-registered account.",
      );
      assert(
        gainYear.realizedCapitalGains > 0,
        "ACB-below-market scenario should realize a capital gain.",
      );
      assert(
        gainYear.taxableCapitalGains > 0,
        "ACB-below-market scenario should add taxable capital gains.",
      );
      assert(
        gainYear.taxes > flatYear.taxes,
        "Realized capital gains should increase first-year tax versus a flat-ACB scenario.",
      );
      assert(
        gainYear.endOfYearAccountBalances.primary.nonRegisteredAdjustedCostBase <
          gainInput.household.primary.taxableAccountTaxProfile.nonRegisteredAdjustedCostBase,
        "Taxable-account ACB should roll down after a partial withdrawal.",
      );
    },
  },
  {
    id: "T11",
    label: "Missing taxable-account ACB falls back to market value with a warning",
    check() {
      const input = readJson(
        "data/fixtures/taxable-account/on-taxable-missing-acb.json",
      );
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.taxableWithdrawals > 0,
        "Missing-ACB scenario should still draw from the taxable account.",
      );
      assert(
        firstYear.taxableCapitalGains === 0,
        "Without an explicit ACB, the baseline fallback should treat opening market value as book cost.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("adjusted cost base was not provided"),
        ),
        "Missing-ACB scenario should surface an adjusted-cost-base warning.",
      );
    },
  },
  {
    id: "T12",
    label: "Explicit taxable-account interest income flows into cash and tax",
    check() {
      const baseInput = readJson(
        "data/fixtures/taxable-account/on-taxable-missing-acb.json",
      );
      const interestInput = readJson(
        "data/fixtures/taxable-account/on-taxable-missing-acb.json",
      );
      interestInput.household.primary.taxableAccountTaxProfile = {
        annualInterestIncome: 30000,
      };
      interestInput.household.expenseProfile.desiredAfterTaxSpending = 30000;

      const baseResult = simulateRetirementPlan(baseInput, rules);
      const interestResult = simulateRetirementPlan(interestInput, rules);
      const baseYear = baseResult.years[0];
      const interestYear = interestResult.years[0];

      assert(
        interestYear.otherPlannedIncome >= 30000,
        "Explicit taxable-account interest income should appear in other planned income.",
      );
      assert(
        interestYear.taxes > baseYear.taxes,
        "Explicit taxable-account interest income should increase first-year tax.",
      );
      assert(
        interestYear.taxableWithdrawals < baseYear.taxableWithdrawals,
        "Explicit taxable-account interest income should reduce the need for taxable withdrawals.",
      );
      assert(
        interestYear.warnings.some((warning) =>
          warning.includes("explicit annual cash distribution"),
        ),
        "Interest-income scenario should warn about possible return double counting.",
      );
    },
  },
  {
    id: "T13",
    label: "Ontario eligible dividends are taxed more favourably than equal cash interest",
    check() {
      const baseOrdinaryIncome = 60000;
      const dividendCash = 10000;
      const interestScenario = estimateIncomeTax({
        taxableIncome: baseOrdinaryIncome + dividendCash,
        province: "ON",
        calendarYear: 2026,
        age: 65,
      });
      const nonEligibleDividendScenario = estimateIncomeTax({
        taxableIncome: baseOrdinaryIncome + dividendCash * 1.15,
        province: "ON",
        calendarYear: 2026,
        age: 65,
        nonEligibleDividendIncome: dividendCash,
      });
      const eligibleDividendScenario = estimateIncomeTax({
        taxableIncome: baseOrdinaryIncome + dividendCash * 1.38,
        province: "ON",
        calendarYear: 2026,
        age: 65,
        eligibleDividendIncome: dividendCash,
      });

      assert(
        eligibleDividendScenario.totalTax < interestScenario.totalTax,
        "Eligible dividends should be taxed more favourably than equal cash interest in Ontario.",
      );
      assert(
        nonEligibleDividendScenario.totalTax < interestScenario.totalTax,
        "Non-eligible dividends should still be taxed more favourably than equal cash interest in Ontario.",
      );
      assert(
        eligibleDividendScenario.totalTax < nonEligibleDividendScenario.totalTax,
        "Eligible dividends should stay more tax-efficient than non-eligible dividends for the same cash amount.",
      );
    },
  },
  {
    id: "T14",
    label: "Eligible dividend income reduces drawdown need and surfaces dividend warnings",
    check() {
      const baseInput = readJson(
        "data/fixtures/taxable-account/on-taxable-missing-acb.json",
      );
      const dividendInput = readJson(
        "data/fixtures/taxable-account/on-taxable-missing-acb.json",
      );
      dividendInput.household.primary.definedBenefitPension = {
        annualAmount: 25000,
        startAge: 65,
        indexationRate: 0,
      };
      dividendInput.household.primary.taxableAccountTaxProfile = {
        annualEligibleDividendIncome: 15000,
      };
      dividendInput.household.expenseProfile.desiredAfterTaxSpending = 35000;

      const baseResult = simulateRetirementPlan(baseInput, rules);
      const dividendResult = simulateRetirementPlan(dividendInput, rules);
      const baseYear = baseResult.years[0];
      const dividendYear = dividendResult.years[0];

      assert(
        dividendYear.otherPlannedIncome >= 15000,
        "Eligible dividend cash income should appear in other planned income.",
      );
      assert(
        dividendYear.taxableWithdrawals < baseYear.taxableWithdrawals,
        "Eligible dividend income should reduce the need for taxable-account withdrawals.",
      );
      assert(
        dividendYear.warnings.some((warning) =>
          warning.includes("actual cash dividend"),
        ),
        "Dividend-income scenario should remind users to enter actual cash dividends, not grossed-up slip amounts.",
      );
    },
  },
  {
    id: "T15",
    label: "Return of capital reduces ACB, market value, and can trigger a deemed capital gain",
    check() {
      const input = readJson(
        "data/fixtures/taxable-account/on-taxable-return-of-capital.json",
      );
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.otherPlannedIncome >= 5000,
        "Return of capital distribution should appear in planned cash income.",
      );
      assert(
        firstYear.taxableWithdrawals === 0,
        "Return of capital cash should reduce or eliminate the need for taxable withdrawals in this scenario.",
      );
      assert(
        firstYear.realizedCapitalGains >= 2000,
        "Return of capital above remaining ACB should trigger a deemed capital gain.",
      );
      assert(
        firstYear.taxableCapitalGains >= 1000,
        "The deemed capital gain should flow into taxable capital gains using the modeled inclusion rate.",
      );
      assert(
        firstYear.endOfYearAccountBalances.primary.nonRegisteredAdjustedCostBase === 0,
        "Return of capital should reduce the taxable-account ACB to zero once exhausted.",
      );
      assert(
        firstYear.endOfYearAccountBalances.primary.nonRegistered < 50000,
        "Return of capital should also reduce the modeled non-registered market value, not just ACB.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("deemed capital gain"),
        ),
        "Return-of-capital scenario should warn when ACB exhaustion creates a deemed capital gain.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("modeled non-registered market value"),
        ),
        "Return-of-capital scenario should warn that the modeled taxable-account balance was reduced by the ROC cash distribution.",
      );
    },
  },
  {
    id: "T16",
    label: "Foreign dividends are taxed as ordinary income without dividend credits",
    check() {
      const foreignInput = readJson(
        "data/fixtures/taxable-account/on-taxable-foreign-dividend.json",
      );
      const eligibleInput = readJson(
        "data/fixtures/taxable-account/on-taxable-foreign-dividend.json",
      );
      eligibleInput.household.primary.taxableAccountTaxProfile = {
        annualEligibleDividendIncome: 15000,
      };

      const foreignResult = simulateRetirementPlan(foreignInput, rules);
      const eligibleResult = simulateRetirementPlan(eligibleInput, rules);
      const foreignYear = foreignResult.years[0];
      const eligibleYear = eligibleResult.years[0];

      assert(
        foreignYear.otherPlannedIncome >= 15000,
        "Foreign dividend cash income should appear in other planned income.",
      );
      assert(
        foreignYear.taxes > eligibleYear.taxes,
        "Foreign dividend income should be taxed less favourably than equal eligible Canadian dividends.",
      );
      assert(
        foreignYear.warnings.some((warning) =>
          warning.includes("Foreign dividend income is being modeled"),
        ),
        "Foreign-dividend scenario should surface the baseline foreign-dividend warning.",
      );
    },
  },
  {
    id: "T17",
    label: "Federal and provincial foreign tax credits reduce tax on foreign non-business income",
    check() {
      const withoutCredit = estimateIncomeTax({
        taxableIncome: 70000,
        province: "ON",
        calendarYear: 2026,
        age: 65,
        foreignNonBusinessIncome: 10000,
      });
      const withCredit = estimateIncomeTax({
        taxableIncome: 70000,
        province: "ON",
        calendarYear: 2026,
        age: 65,
        foreignNonBusinessIncome: 10000,
        foreignNonBusinessIncomeTaxPaid: 1500,
      });

      assert(
        withCredit.totalTax < withoutCredit.totalTax,
        "Foreign tax credit should reduce total tax when foreign non-business tax has already been paid.",
      );
      assert(
        withCredit.federalForeignTaxCredit > 0,
        "Foreign tax credit amount should be positive when eligible foreign tax is provided.",
      );
      assert(
        withCredit.provincialForeignTaxCredit > 0,
        "Ontario provincial foreign tax credit should also be positive when residual foreign tax remains after the federal credit.",
      );
      assert(
        withCredit.provincialTax < withoutCredit.provincialTax,
        "Provincial foreign tax credit should reduce the modeled provincial tax payable.",
      );
      assert(
        Math.abs(
          withoutCredit.provincialTax -
            (withCredit.provincialTax + withCredit.provincialForeignTaxCredit),
        ) < 0.01,
        "Returned provincial tax should already be net of the modeled provincial foreign tax credit.",
      );
      assert(
        withCredit.warnings.some((warning) =>
          warning.includes("ON / BC / AB provincial residual-credit approximation"),
        ),
        "Foreign tax credit scenario should warn that the provincial path is still a baseline approximation.",
      );
    },
  },
  {
    id: "T18",
    label: "Foreign tax credit lowers taxes in the foreign-dividend household scenario",
    check() {
      const baseInput = readJson(
        "data/fixtures/taxable-account/on-taxable-foreign-dividend.json",
      );
      const creditedInput = readJson(
        "data/fixtures/taxable-account/on-taxable-foreign-dividend-tax-paid.json",
      );

      const baseResult = simulateRetirementPlan(baseInput, rules);
      const creditedResult = simulateRetirementPlan(creditedInput, rules);
      const baseYear = baseResult.years[0];
      const creditedYear = creditedResult.years[0];

      assert(
        creditedYear.taxes < baseYear.taxes,
        "Foreign tax credit should reduce modeled household taxes when foreign withholding tax is provided.",
      );
      assert(
        creditedYear.otherPlannedIncome === baseYear.otherPlannedIncome,
        "Foreign tax credit should change taxes, not cash income itself.",
      );
      assert(
        creditedYear.federalForeignTaxCredit > 0,
        "Household result should surface the federal foreign tax credit in the annual breakdown.",
      );
      assert(
        creditedYear.provincialForeignTaxCredit > 0,
        "Household result should surface the provincial foreign tax credit in the annual breakdown.",
      );
      assert(
        creditedYear.warnings.some((warning) =>
          warning.includes("ON / BC / AB / QC provincial residual-credit support"),
        ),
        "Credited foreign-dividend scenario should warn that the provincial foreign tax credit path is still baseline-only and partial.",
      );
    },
  },
  {
    id: "T19",
    label: "Capital losses carry forward and offset later taxable capital gains",
    check() {
      const input = readJson(
        "data/fixtures/taxable-account/on-taxable-loss-carryforward.json",
      );
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];
      const secondYear = result.years[1];

      assert(
        firstYear.netCapitalLossCarryforward > 0,
        "A capital loss in the first year should create a net capital loss carryforward.",
      );
      assert(
        secondYear.capitalLossesUsed > 0,
        "Later-year taxable capital gains should use the available capital loss carryforward.",
      );
      assert(
        secondYear.realizedCapitalGains > 0,
        "The rebound year should still realize a capital gain on withdrawal.",
      );
      assert(
        secondYear.taxableCapitalGains === 0,
        "Carryforward losses should offset the later taxable capital gain in the modeled rebound year.",
      );
      assert(
        secondYear.netCapitalLossCarryforward < firstYear.netCapitalLossCarryforward,
        "Using the capital loss carryforward should reduce the remaining carryforward balance.",
      );
    },
  },
  {
    id: "T20",
    label: "Delayed QPP at age 72 applies the official 0.7% monthly increase path",
    check() {
      const input = readJson("data/fixtures/quebec/qc-qpp-delayed-start.json");
      const result = simulateRetirementPlan(input, rules);
      const age71 = byPrimaryAge(result, 71);
      const age72 = byPrimaryAge(result, 72);

      assert(
        age71.cppQppIncome === 0,
        "QPP should remain zero before the elected Quebec start age of 72.",
      );
      assert(
        Math.abs(age72.cppQppIncome - 19056) < 0.01,
        "Delayed QPP should apply the official 0.7% monthly increase from age 65 through age 72.",
      );
      assert(
        !age72.warnings.some((warning) => warning.includes("QPP early-start reductions")),
        "A delayed-start QPP case should not surface the early-start approximation warning.",
      );
    },
  },
  {
    id: "T21",
    label: "Quebec foreign tax credit baseline reduces provincial tax",
    check() {
      const withoutCredit = estimateIncomeTax({
        taxableIncome: 70000,
        province: "QC",
        calendarYear: 2026,
        age: 65,
        foreignNonBusinessIncome: 10000,
      });
      const withCredit = estimateIncomeTax({
        taxableIncome: 70000,
        province: "QC",
        calendarYear: 2026,
        age: 65,
        foreignNonBusinessIncome: 10000,
        foreignNonBusinessIncomeTaxPaid: 1500,
      });

      assert(
        withCredit.totalTax < withoutCredit.totalTax,
        "Quebec foreign tax credit support should reduce total tax when foreign non-business tax was already paid.",
      );
      assert(
        withCredit.provincialForeignTaxCredit > 0,
        "Quebec baseline foreign tax credit path should produce a provincial foreign tax credit amount.",
      );
      assert(
        withCredit.warnings.some((warning) =>
          warning.includes("Quebec residual-credit approximation"),
        ),
        "Quebec foreign tax credit scenario should warn that the provincial path is still a baseline approximation.",
      );
    },
  },
  {
    id: "T22",
    label: "Quebec household scenario surfaces provincial foreign tax credits",
    check() {
      const qcInput = readJson(
        "data/fixtures/taxable-account/on-taxable-foreign-dividend-tax-paid.json",
      );
      qcInput.household.primary.profile.provinceAtRetirement = "QC";
      qcInput.household.primary.profile.pensionPlan = "QPP";

      const result = simulateRetirementPlan(qcInput, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.provincialForeignTaxCredit > 0,
        "Quebec household foreign-income scenario should surface a provincial foreign tax credit in annual results.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("ON / BC / AB / QC provincial residual-credit support"),
        ),
        "Quebec household foreign-income scenario should surface the updated provincial foreign tax credit warning.",
      );
    },
  },
  {
    id: "T23",
    label: "Quebec career extension credit reduces tax for age-65 workers",
    check() {
      const withoutCredit = estimateIncomeTax({
        taxableIncome: 65000,
        province: "QC",
        calendarYear: 2026,
        age: 65,
      });
      const withCredit = estimateIncomeTax({
        taxableIncome: 65000,
        province: "QC",
        calendarYear: 2026,
        age: 65,
        eligibleWorkIncome: 12500,
      });

      assert(
        Math.abs(withCredit.quebecCareerExtensionCredit - 1155) < 0.01,
        "Quebec career extension credit should follow the published max-credit and 7% reduction structure in the baseline scaffold.",
      );
      assert(
        withCredit.totalTax < withoutCredit.totalTax,
        "Quebec career extension credit should reduce modeled tax for eligible working seniors.",
      );
      assert(
        withCredit.warnings.some((warning) =>
          warning.includes("career extension credit"),
        ),
        "Quebec career extension scenario should warn that the 2025 thresholds are being reused as the 2026 scaffold anchor.",
      );
    },
  },
  {
    id: "T24",
    label: "Quebec annual results surface the career extension credit",
    check() {
      const input = readJson("data/fixtures/quebec/qc-career-extension-credit.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        Math.abs(firstYear.quebecCareerExtensionCredit - 1155) < 0.01,
        "Quebec working-senior scenario should surface the career extension credit in annual results.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("career extension credit"),
        ),
        "Quebec working-senior scenario should surface the baseline career extension warning.",
      );
    },
  },
  {
    id: "T25",
    label: "Quebec Schedule B age and retirement-income amounts reduce tax for a single retiree",
    check() {
      const input = readJson("data/fixtures/quebec/qc-age-retirement-credit.json");
      input.household.primary.profile.lifeExpectancy = 69;
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        Math.abs(firstYear.quebecTaxReliefMeasuresCredit - 146.72) < 0.01,
        "Quebec single retiree should surface the actually applied non-refundable Schedule B credit amount.",
      );
      assert(
        firstYear.taxes === 0,
        "Quebec retiree scenario should have provincial tax reduced to zero in this low-tax case.",
      );
      assert(
        Math.abs(firstYear.afterTaxIncome - 20000) < 0.01,
        "Quebec retiree after-tax income should reflect the full low-income tax relief after the applied Schedule B credit.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("Quebec Schedule B"),
        ),
        "Quebec retiree scenario should warn that the Schedule B path is still a household-level approximation.",
      );
    },
  },
  {
    id: "T26",
    label: "Quebec FRV under age 55 can use a temporary-income election baseline",
    check() {
      const input = readJson(
        "data/fixtures/locked-in/qc-frv-under-55-temporary-income.json",
      );
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        Math.abs(firstYear.lifWithdrawals - 17300) < 0.01,
        "Quebec FRV under-age-55 temporary-income scenario should cap withdrawals at the modeled 50% MGA minus estimated-income ceiling when that exceeds the prescribed-rate life-income ceiling.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("start-of-year temporary-income election approximation"),
        ),
        "Quebec FRV under-age-55 scenario should warn that the temporary-income path is using a start-of-year approximation.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("baseline proxy for the next-12-month 'other income' declaration"),
        ),
        "Quebec FRV under-age-55 scenario should warn when the declaration income uses a modeled proxy instead of a manual input.",
      );
    },
  },
  {
    id: "T27",
    label: "Quebec FRV under age 55 stays on the prescribed-rate path without a temporary-income request",
    check() {
      const input = readJson(
        "data/fixtures/locked-in/qc-frv-under-55-temporary-income.json",
      );
      input.household.primary.lockedInAccountPolicy.quebecTemporaryIncomeRequested =
        false;

      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        Math.abs(firstYear.lifWithdrawals - 12500) < 0.01,
        "Without a temporary-income request, the under-age-55 Quebec FRV should stay on the prescribed-rate life-income ceiling.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("without a temporary-income election"),
        ),
        "Quebec FRV under-age-55 no-election scenario should explain that temporary income was not modeled.",
      );
    },
  },
  {
    id: "T28",
    label: "GIS single scenario adds tax-free income and reduces TFSA drawdown",
    check() {
      const enabledInput = readJson("data/fixtures/gis/on-single-gis.json");
      const disabledInput = readJson("data/fixtures/gis/on-single-gis.json");
      disabledInput.household.gisModelingEnabled = false;

      const enabledResult = simulateRetirementPlan(enabledInput, rules);
      const disabledResult = simulateRetirementPlan(disabledInput, rules);
      const enabledYear = enabledResult.years[0];
      const disabledYear = disabledResult.years[0];

      assert(
        enabledYear.gisIncome > 0,
        "Low-income single OAS scenario should produce modeled GIS income when GIS support is enabled.",
      );
      assert(
        enabledYear.tfsaWithdrawals < disabledYear.tfsaWithdrawals,
        "Modeled GIS income should reduce the need for TFSA drawdown in the low-income single scenario.",
      );
      assert(
        enabledYear.warnings.some((warning) =>
          warning.includes("current-year income proxy"),
        ),
        "GIS single scenario should warn that the supplement path is using a current-year proxy.",
      );
    },
  },
  {
    id: "T29",
    label: "Allowance couple scenario models both GIS and Allowance cash flows",
    check() {
      const input = readJson("data/fixtures/gis/on-allowance-couple.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.gisIncome > 0,
        "Allowance household should still produce GIS for the older OAS-recipient spouse.",
      );
      assert(
        firstYear.allowanceIncome > 0,
        "Allowance household should produce Allowance income for the younger spouse.",
      );
      assert(
        firstYear.afterTaxIncome >=
          firstYear.oasIncome + firstYear.gisIncome + firstYear.allowanceIncome,
        "Allowance household after-tax income should include the modeled tax-free supplement cash flows.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("linear taper"),
        ),
        "Allowance scenario should warn that the GIS / Allowance taper is still a baseline approximation.",
      );
    },
  },
  {
    id: "T30",
    label: "Allowance for the Survivor requires an explicit flag and produces survivor income",
    check() {
      const input = readJson("data/fixtures/gis/on-allowance-survivor.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.allowanceSurvivorIncome > 0,
        "Allowance-for-the-Survivor scenario should produce survivor-allowance income when the explicit eligibility flag is supplied.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("explicit eligibility flag"),
        ),
        "Allowance-for-the-Survivor scenario should warn that widowhood eligibility is not auto-detected.",
      );
    },
  },
  {
    id: "T31",
    label: "Quebec living-alone input increases the Schedule B credit",
    check() {
      const baseInput = readJson("data/fixtures/quebec/qc-living-alone-credit.json");
      const aloneInput = readJson("data/fixtures/quebec/qc-living-alone-credit.json");
      baseInput.household.primary.profile.lifeExpectancy = 69;
      aloneInput.household.primary.profile.lifeExpectancy = 69;
      baseInput.household.primary.profile.livesAloneForTaxYear = false;

      const baseResult = simulateRetirementPlan(baseInput, rules);
      const aloneResult = simulateRetirementPlan(aloneInput, rules);
      const baseYear = baseResult.years[0];
      const aloneYear = aloneResult.years[0];

      assert(
        aloneYear.quebecTaxReliefMeasuresCredit >
          baseYear.quebecTaxReliefMeasuresCredit,
        "Supplying the Quebec living-alone input should increase the modeled Schedule B credit.",
      );
      assert(
        aloneYear.taxes < baseYear.taxes,
        "The added Quebec living-alone amount should reduce modeled Quebec tax.",
      );
      assert(
        aloneYear.warnings.some((warning) =>
          warning.includes("living-alone"),
        ),
        "Quebec living-alone scenario should warn that the living-alone amount depends on an explicit user input.",
      );
    },
  },
  {
    id: "T32",
    label: "Under-65 CPP survivor pension is added when the survivor has no own CPP retirement pension",
    check() {
      const enabledInput = readJson("data/fixtures/golden/golden-on-couple-core.json");
      const disabledInput = readJson("data/fixtures/golden/golden-on-couple-core.json");
      enabledInput.household.partner.profile.lifeExpectancy = 55;
      disabledInput.household.partner.profile.lifeExpectancy = 55;
      disabledInput.household.primary.publicBenefits.survivorBenefitEstimateMode =
        "disabled";

      const enabledResult = simulateRetirementPlan(enabledInput, rules);
      const disabledResult = simulateRetirementPlan(disabledInput, rules);
      const enabledYear = enabledResult.years[0];
      const disabledYear = disabledResult.years[0];

      assert(
        Math.abs(
          enabledYear.otherPlannedIncome - disabledYear.otherPlannedIncome - 6863.04,
        ) < 0.01,
        "Under-65 survivor scenario should add the baseline CPP flat-rate-plus-37.5% survivor pension when the surviving spouse is not yet receiving CPP retirement.",
      );
      assert(
        enabledYear.warnings.some((warning) =>
          warning.includes("CPP survivor pension"),
        ),
        "Under-65 survivor scenario should surface a CPP survivor-pension warning.",
      );
    },
  },
  {
    id: "T33",
    label: "Age-65-plus CPP survivor pension uses the combined maximum baseline cap",
    check() {
      const enabledInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      const disabledInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      enabledInput.household.primary.profile.lifeExpectancy = 71;
      disabledInput.household.primary.profile.lifeExpectancy = 71;
      disabledInput.household.partner.publicBenefits.survivorBenefitEstimateMode =
        "disabled";

      const enabledResult = simulateRetirementPlan(enabledInput, rules);
      const disabledResult = simulateRetirementPlan(disabledInput, rules);
      const enabledYear = enabledResult.years[0];
      const disabledYear = disabledResult.years[0];

      assert(
        Math.abs(
          enabledYear.otherPlannedIncome - disabledYear.otherPlannedIncome - 8058.72,
        ) < 0.01,
        "Age-65-plus survivor scenario should add the capped CPP survivor pension increment above the survivor's own CPP retirement income.",
      );
      assert(
        enabledYear.warnings.some((warning) =>
          warning.includes("combined maximum"),
        ),
        "Age-65-plus combined-benefit survivor scenario should warn that the published combined maximum is being used as a baseline cap.",
      );
    },
  },
  {
    id: "T34",
    label: "Survivor spending override changes post-death spending needs",
    check() {
      const defaultInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      const reducedInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      defaultInput.household.primary.profile.lifeExpectancy = 71;
      reducedInput.household.primary.profile.lifeExpectancy = 71;
      reducedInput.household.expenseProfile.survivorSpendingPercentOfCouple = 0.6;

      const defaultResult = simulateRetirementPlan(defaultInput, rules);
      const reducedResult = simulateRetirementPlan(reducedInput, rules);
      const defaultYear = defaultResult.years[0];
      const reducedYear = reducedResult.years[0];

      assert(
        reducedYear.spending < defaultYear.spending,
        "An explicit survivor spending override should reduce modeled survivor-year spending when the override is below the default 72% assumption.",
      );
      assert(
        defaultYear.warnings.some((warning) =>
          warning.includes("baseline 72%"),
        ),
        "Default survivor-year path should warn when it is using the baseline 72% spending assumption.",
      );
    },
  },
  {
    id: "T35",
    label: "Death year prorates working-age household income and spending",
    check() {
      const fullYearInput = readJson("data/fixtures/golden/golden-on-couple-core.json");
      const deathYearInput = readJson("data/fixtures/golden/golden-on-couple-core.json");
      fullYearInput.household.partner.profile.lifeExpectancy = 64;
      deathYearInput.household.partner.profile.lifeExpectancy = 63;

      const fullYearResult = simulateRetirementPlan(fullYearInput, rules);
      const deathYearResult = simulateRetirementPlan(deathYearInput, rules);
      const fullYear = byPrimaryAge(fullYearResult, 65);
      const deathYear = byPrimaryAge(deathYearResult, 65);

      assert(
        deathYear.beforeTaxIncome < fullYear.beforeTaxIncome,
        "Death-year handling should reduce modeled before-tax income when one spouse dies mid-year.",
      );
      assert(
        deathYear.spending < fullYear.spending,
        "Death-year handling should reduce couple spending partway toward the survivor path in the death year.",
      );
      assert(
        deathYear.warnings.some((warning) =>
          warning.includes("mid-year death heuristic"),
        ),
        "Death-year scenario should warn that the death year uses a mid-year heuristic.",
      );
    },
  },
  {
    id: "T36",
    label: "Death year prorates mandatory RRIF withdrawals for a retiree couple",
    check() {
      const fullYearInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      const deathYearInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      fullYearInput.household.primary.profile.lifeExpectancy = 73;
      deathYearInput.household.primary.profile.lifeExpectancy = 72;

      const fullYearResult = simulateRetirementPlan(fullYearInput, rules);
      const deathYearResult = simulateRetirementPlan(deathYearInput, rules);
      const fullYear = fullYearResult.years[0];
      const deathYear = deathYearResult.years[0];

      assert(
        deathYear.rrspRrifWithdrawals < fullYear.rrspRrifWithdrawals,
        "Death-year handling should reduce the modeled mandatory RRIF withdrawal when death occurs mid-year.",
      );
      assert(
        deathYear.beforeTaxIncome < fullYear.beforeTaxIncome,
        "Death-year handling should lower before-tax income for the partial final year.",
      );
      assert(
        deathYear.warnings.some((warning) =>
          warning.includes("mid-year death heuristic"),
        ),
        "Retiree death-year scenario should warn that the death year uses a mid-year heuristic.",
      );
    },
  },
  {
    id: "T37",
    label: "Death year adds a half-year survivor public pension baseline",
    check() {
      const enabledInput = readJson("data/fixtures/golden/golden-on-couple-core.json");
      const disabledInput = readJson("data/fixtures/golden/golden-on-couple-core.json");
      enabledInput.household.partner.profile.lifeExpectancy = 56;
      disabledInput.household.partner.profile.lifeExpectancy = 56;
      disabledInput.household.primary.publicBenefits.survivorBenefitEstimateMode =
        "disabled";

      const enabledResult = simulateRetirementPlan(enabledInput, rules);
      const disabledResult = simulateRetirementPlan(disabledInput, rules);
      const enabledYear = enabledResult.years[0];
      const disabledYear = disabledResult.years[0];

      assert(
        Math.abs(
          enabledYear.otherPlannedIncome - disabledYear.otherPlannedIncome - 3431.52,
        ) < 0.01,
        "Death-year survivor modeling should add roughly half of the annual under-65 CPP survivor benefit under the mid-year death heuristic.",
      );
      assert(
        enabledYear.warnings.some((warning) =>
          warning.includes("half-year amount"),
        ),
        "Death-year survivor scenario should warn that the survivor public pension is being approximated as a half-year amount.",
      );
    },
  },
  {
    id: "T38",
    label: "Age-65-plus QPP combined-benefit path stays positive but below the no-retirement maximum",
    check() {
      const enabledInput = readJson(
        "data/fixtures/quebec/qc-survivor-combined-benefit.json",
      );
      const disabledInput = readJson(
        "data/fixtures/quebec/qc-survivor-combined-benefit.json",
      );
      disabledInput.household.partner.publicBenefits.survivorBenefitEstimateMode =
        "disabled";

      const enabledResult = simulateRetirementPlan(enabledInput, rules);
      const disabledResult = simulateRetirementPlan(disabledInput, rules);
      const enabledYear = enabledResult.years[0];
      const disabledYear = disabledResult.years[0];
      const survivorIncrement =
        enabledYear.otherPlannedIncome - disabledYear.otherPlannedIncome;

      assert(
        survivorIncrement > 0,
        "Age-65-plus Quebec combined-benefit scenario should still add a positive survivor pension increment.",
      );
      assert(
        survivorIncrement < 881.48 * (1000 / 1508) * 12,
        "Age-65-plus Quebec combined-benefit scenario should stay below the no-retirement survivor maximum for the deceased contributor's entitlement ratio.",
      );
      assert(
        enabledYear.warnings.some((warning) =>
          warning.includes("combined-benefit approximation"),
        ),
        "Age-65-plus Quebec combined-benefit scenario should warn that the combined-benefit path is an approximation.",
      );
    },
  },
  {
    id: "T39",
    label: "Couple timeline reaches the youngest spouse's remaining lifetime",
    check() {
      const input = readJson("data/fixtures/golden/golden-on-couple-core.json");
      const result = simulateRetirementPlan(input, rules);
      const lastYear = result.years.at(-1);

      assert(lastYear, "Couple projection should have a last year.");
      assert(
        lastYear.primaryAge === 96,
        "Couple projection should continue until the younger spouse's remaining lifetime is exhausted, even when that pushes the primary member past their own life expectancy age.",
      );
      assert(
        lastYear.partnerAge === 94,
        "Couple projection should reach the younger spouse's modeled life expectancy age.",
      );
    },
  },
  {
    id: "T40",
    label: "Summary estate proxy reports terminal tax and Ontario estate administration cost",
    check() {
      const input = readJson("data/fixtures/golden/golden-on-single-saver.json");
      input.household.primary.profile.currentAge = 65;
      input.household.primary.profile.retirementAge = 65;
      input.household.primary.profile.lifeExpectancy = 65;
      input.household.maxProjectionAge = 65;
      input.household.primary.employment.baseAnnualIncome = 0;
      input.household.primary.employment.bonusAnnualIncome = 0;
      input.household.primary.accounts.rrsp = 250000;
      input.household.primary.accounts.rrif = 0;
      input.household.primary.accounts.tfsa = 120000;
      input.household.primary.accounts.nonRegistered = 90000;
      input.household.primary.accounts.cash = 40000;
      input.household.primary.taxableAccountTaxProfile = {
        ...(input.household.primary.taxableAccountTaxProfile ?? {}),
        nonRegisteredAdjustedCostBase: 60000,
        annualInterestIncome: 0,
        annualEligibleDividendIncome: 0,
        annualNonEligibleDividendIncome: 0,
        annualForeignDividendIncome: 0,
        annualForeignNonBusinessIncomeTaxPaid: 0,
        annualReturnOfCapitalDistribution: 0,
      };
      input.household.expenseProfile.desiredAfterTaxSpending = 0;
      input.household.expenseProfile.housing = 0;
      input.household.expenseProfile.utilities = 0;
      input.household.expenseProfile.food = 0;
      input.household.expenseProfile.transportation = 0;
      input.household.expenseProfile.healthcare = 0;
      input.household.expenseProfile.insurance = 0;
      input.household.expenseProfile.travelAndRecreation = 0;
      input.household.expenseProfile.debtPayments = 0;
      input.household.primary.contributions.rrsp = 0;
      input.household.primary.contributions.tfsa = 0;
      input.household.primary.contributions.nonRegistered = 0;
      input.household.primary.annuityIncome = [];
      input.household.primary.rentalIncome = [];
      input.household.primary.foreignPensionIncome = [];

      const result = simulateRetirementPlan(input, rules);

      assert(
        (result.summary.estimatedEstateValue ?? 0) > 0,
        "Estate proxy scenario should report a positive gross estate value.",
      );
      assert(
        (result.summary.estimatedTerminalTaxLiability ?? 0) > 0,
        "Estate proxy scenario should report positive terminal tax when registered assets remain.",
      );
      assert(
        (result.summary.estimatedProbateAndEstateAdminCost ?? 0) > 0,
        "Ontario estate proxy scenario should report a positive estate administration cost.",
      );
      assert(
        (result.summary.estimatedAfterTaxEstateValue ?? 0) <
          (result.summary.estimatedEstateValue ?? 0),
        "After-tax estate value should be below the gross estate value when terminal tax and estate administration cost apply.",
      );
    },
  },
  {
    id: "T41",
    label: "Single death year applies a final-return tax adjustment",
    check() {
      const deathYearInput = readJson("data/fixtures/golden/golden-on-single-saver.json");
      const nonDeathInput = readJson("data/fixtures/golden/golden-on-single-saver.json");

      for (const input of [deathYearInput, nonDeathInput]) {
        input.household.primary.profile.currentAge = 65;
        input.household.primary.profile.retirementAge = 65;
        input.household.maxProjectionAge = 65;
        input.household.primary.employment.baseAnnualIncome = 0;
        input.household.primary.employment.bonusAnnualIncome = 0;
        input.household.primary.accounts.rrsp = 250000;
        input.household.primary.accounts.rrif = 0;
        input.household.primary.accounts.tfsa = 0;
        input.household.primary.accounts.nonRegistered = 0;
        input.household.primary.accounts.cash = 10000;
        input.household.primary.contributions.rrsp = 0;
        input.household.primary.contributions.tfsa = 0;
        input.household.primary.contributions.nonRegistered = 0;
      }

      deathYearInput.household.primary.profile.lifeExpectancy = 65;
      nonDeathInput.household.primary.profile.lifeExpectancy = 66;

      const deathYearResult = simulateRetirementPlan(deathYearInput, rules);
      const nonDeathResult = simulateRetirementPlan(nonDeathInput, rules);
      const deathYear = deathYearResult.years[0];
      const nonDeathYear = nonDeathResult.years[0];

      assert(
        deathYear.deathYearFinalReturnTaxAdjustment > 0,
        "A single-household death year with remaining RRSP assets should report a positive death-year final-return tax adjustment.",
      );
      assert(
        deathYear.deathYearFinalReturnTaxableIncomeAdjustment > 0,
        "A single-household death year with remaining RRSP assets should add taxable income on the final return baseline.",
      );
      assert(
        deathYear.taxes + deathYear.oasRecoveryTax >
          nonDeathYear.taxes + nonDeathYear.oasRecoveryTax,
        "The death-year final-return adjustment should increase total tax burden versus an otherwise identical non-death year.",
      );
    },
  },
  {
    id: "T42",
    label: "Death year with a surviving spouse assumes baseline spousal rollover",
    check() {
      const input = readJson("data/fixtures/golden/golden-on-couple-core.json");
      input.household.partner.profile.lifeExpectancy = 56;

      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.deathYearFinalReturnTaxAdjustment === 0,
        "When a surviving spouse remains in the model, death-year final-return tax should stay at zero under the baseline spousal-rollover assumption.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("spousal rollover") ||
          warning.includes("spousal continuation"),
        ),
        "Death year with a surviving spouse should warn that remaining balances are being handled with a baseline spousal-rollover assumption.",
      );
    },
  },
  {
    id: "T43",
    label: "Direct beneficiary designations reduce probate proxy without removing terminal RRSP tax",
    check() {
      const baseInput = readJson("data/fixtures/golden/golden-on-single-saver.json");
      const bypassInput = readJson("data/fixtures/golden/golden-on-single-saver.json");

      for (const input of [baseInput, bypassInput]) {
        input.household.primary.profile.currentAge = 65;
        input.household.primary.profile.retirementAge = 65;
        input.household.primary.profile.lifeExpectancy = 65;
        input.household.maxProjectionAge = 65;
        input.household.primary.employment.baseAnnualIncome = 0;
        input.household.primary.employment.bonusAnnualIncome = 0;
        input.household.primary.accounts.rrsp = 250000;
        input.household.primary.accounts.rrif = 0;
        input.household.primary.accounts.tfsa = 120000;
        input.household.primary.accounts.nonRegistered = 90000;
        input.household.primary.accounts.cash = 40000;
        input.household.primary.taxableAccountTaxProfile = {
          ...(input.household.primary.taxableAccountTaxProfile ?? {}),
          nonRegisteredAdjustedCostBase: 60000,
        };
        input.household.expenseProfile.desiredAfterTaxSpending = 0;
        input.household.expenseProfile.housing = 0;
        input.household.expenseProfile.utilities = 0;
        input.household.expenseProfile.food = 0;
        input.household.expenseProfile.transportation = 0;
        input.household.expenseProfile.healthcare = 0;
        input.household.expenseProfile.insurance = 0;
        input.household.expenseProfile.travelAndRecreation = 0;
        input.household.expenseProfile.debtPayments = 0;
        input.household.primary.contributions.rrsp = 0;
        input.household.primary.contributions.tfsa = 0;
        input.household.primary.contributions.nonRegistered = 0;
      }

      bypassInput.household.primary.beneficiaryDesignations = {
        rrsp: "other-beneficiary",
        tfsa: "other-beneficiary",
      };

      const baseResult = simulateRetirementPlan(baseInput, rules);
      const bypassResult = simulateRetirementPlan(bypassInput, rules);

      assert(
        (bypassResult.summary.estimatedProbateAndEstateAdminCost ?? 0) <
          (baseResult.summary.estimatedProbateAndEstateAdminCost ?? 0),
        "Registered accounts marked for direct beneficiaries should reduce the probate proxy because those assets no longer pass through the estate baseline.",
      );
      assert(
        Math.abs(
          (bypassResult.summary.estimatedTerminalTaxLiability ?? 0) -
            (baseResult.summary.estimatedTerminalTaxLiability ?? 0),
        ) < 0.01,
        "A non-spouse RRSP beneficiary should still leave the terminal RRSP tax burden in place on the final return baseline.",
      );
    },
  },
  {
    id: "T44",
    label: "Other-beneficiary registered assets leave the surviving household after death",
    check() {
      const baselineInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      const designatedInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      baselineInput.household.primary.profile.lifeExpectancy = 72;
      designatedInput.household.primary.profile.lifeExpectancy = 72;
      designatedInput.household.primary.beneficiaryDesignations = {
        rrif: "other-beneficiary",
      };

      const baselineResult = simulateRetirementPlan(baselineInput, rules);
      const designatedResult = simulateRetirementPlan(designatedInput, rules);
      const baselineSurvivorYear = baselineResult.years[1];
      const designatedSurvivorYear = designatedResult.years[1];

      assert(
        designatedSurvivorYear.endOfYearAccountBalances.partner.rrif <
          baselineSurvivorYear.endOfYearAccountBalances.partner.rrif,
        "RRIF assets marked for another direct beneficiary should no longer remain inside the surviving household in later years.",
      );
      assert(
        designatedSurvivorYear.warnings.some((warning) =>
          warning.includes("outside the estate to another beneficiary"),
        ),
        "The survivor year should explain when registered assets left the modeled household because of a direct-beneficiary designation.",
      );
    },
  },
  {
    id: "T45",
    label: "Other-beneficiary registered balances trigger death-year tax even when a spouse survives",
    check() {
      const baselineInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      const designatedInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      baselineInput.household.primary.profile.lifeExpectancy = 72;
      designatedInput.household.primary.profile.lifeExpectancy = 72;
      designatedInput.household.primary.beneficiaryDesignations = {
        rrif: "other-beneficiary",
      };

      const baselineResult = simulateRetirementPlan(baselineInput, rules);
      const designatedResult = simulateRetirementPlan(designatedInput, rules);
      const baselineDeathYear = baselineResult.years[0];
      const designatedDeathYear = designatedResult.years[0];

      assert(
        designatedDeathYear.deathYearFinalReturnTaxAdjustment >
          baselineDeathYear.deathYearFinalReturnTaxAdjustment,
        "A registered account marked for another direct beneficiary should still create death-year final-return tax even when a spouse remains alive in the model.",
      );
      assert(
        designatedDeathYear.warnings.some((warning) =>
          warning.includes("not modeled as a spouse-continuation transfer"),
        ),
        "Death-year tax warning should explain that the designated registered balance did not receive spouse-continuation treatment.",
      );
    },
  },
  {
    id: "T46",
    label: "Joint ownership with surviving spouse reduces death-year probate base",
    check() {
      const baseInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      const jointInput = readJson("data/fixtures/golden/golden-on-rrif-couple.json");
      baseInput.household.primary.profile.lifeExpectancy = 72;
      jointInput.household.primary.profile.lifeExpectancy = 72;
      jointInput.household.primary.jointOwnershipProfile = {
        nonRegisteredJointWithSurvivingSpousePercent: 1,
        cashJointWithSurvivingSpousePercent: 1,
      };

      const baseResult = simulateRetirementPlan(baseInput, rules);
      const jointResult = simulateRetirementPlan(jointInput, rules);
      const baseDeathYear = baseResult.years[0];
      const jointDeathYear = jointResult.years[0];

      assert(
        (jointDeathYear.deathYearEstimatedProbateBase ?? 0) <
          (baseDeathYear.deathYearEstimatedProbateBase ?? 0),
        "Jointly held cash and non-registered assets should reduce the modeled death-year probate base when a spouse survives.",
      );
      assert(
        Math.abs(
          (jointDeathYear.deathYearProbateExcludedAssets ?? 0) -
            ((baseDeathYear.deathYearEstimatedProbateBase ?? 0) -
              (jointDeathYear.deathYearEstimatedProbateBase ?? 0)),
        ) < 0.01,
        "Full joint-ownership exclusion should remove the same amount from the death-year probate base that it reports as probate-excluded assets.",
      );
      assert(
        (jointDeathYear.deathYearEstimatedProbateCost ?? 0) <
          (baseDeathYear.deathYearEstimatedProbateCost ?? 0),
        "Reducing the probate base through joint ownership should lower the modeled death-year probate cost.",
      );
    },
  },
  {
    id: "T47",
    label: "Joint-ownership exclusion needs a surviving spouse to apply",
    check() {
      const input = readJson("data/fixtures/golden/golden-on-single-saver.json");
      input.household.primary.profile.currentAge = 65;
      input.household.primary.profile.retirementAge = 65;
      input.household.primary.profile.lifeExpectancy = 65;
      input.household.maxProjectionAge = 65;
      input.household.primary.employment.baseAnnualIncome = 0;
      input.household.primary.employment.bonusAnnualIncome = 0;
      input.household.primary.accounts.nonRegistered = 50000;
      input.household.primary.accounts.cash = 10000;
      input.household.primary.accounts.rrsp = 0;
      input.household.primary.accounts.rrif = 0;
      input.household.primary.accounts.tfsa = 0;
      input.household.primary.contributions.rrsp = 0;
      input.household.primary.contributions.tfsa = 0;
      input.household.primary.contributions.nonRegistered = 0;
      input.household.primary.jointOwnershipProfile = {
        nonRegisteredJointWithSurvivingSpousePercent: 1,
        cashJointWithSurvivingSpousePercent: 1,
      };

      const result = simulateRetirementPlan(input, rules);
      const deathYear = result.years[0];

      assert(
        (deathYear.deathYearProbateExcludedAssets ?? 0) === 0,
        "Joint-ownership exclusion should not apply when there is no surviving spouse in the modeled path.",
      );
      assert(
        (deathYear.deathYearEstimatedProbateBase ?? 0) > 0,
        "Without a surviving spouse, the terminal year should still produce a probate base for the single-household estate.",
      );
    },
  },
  {
    id: "T48",
    label: "Prior-year GIS seed can suppress the first projection year and release GIS in the next year",
    check() {
      const input = readJson("data/fixtures/gis/on-single-gis.json");
      input.household.incomeTestedBenefitsBaseIncome = {
        primaryAssessableIncome: 30000,
        combinedAssessableIncome: 30000,
        calendarYear: 2025,
      };
      input.household.maxProjectionAge = 66;

      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];
      const secondYear = result.years[1];

      assert(
        firstYear.gisIncome < secondYear.gisIncome,
        "A high prior-year GIS seed should reduce the first projection year's GIS relative to the next year after the lower current-year income has flowed through the lag.",
      );
      assert(
        secondYear.gisIncome > 0,
        "The next year should restore GIS once the lower modeled assessable income becomes the prior-year base.",
      );
      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("prior-year assessable income"),
        ),
        "Seeded GIS scenario should warn that benefits are being based on prior-year assessable income rather than the current-year proxy.",
      );
    },
  },
  {
    id: "T49",
    label: "Prior-year Allowance seed delays first-year low-income supplements for a couple",
    check() {
      const input = readJson("data/fixtures/gis/on-allowance-couple.json");
      input.household.incomeTestedBenefitsBaseIncome = {
        primaryAssessableIncome: 22000,
        partnerAssessableIncome: 18000,
        combinedAssessableIncome: 40000,
        calendarYear: 2025,
      };
      input.household.maxProjectionAge = 68;

      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];
      const secondYear = result.years[1];

      assert(
        firstYear.allowanceIncome < secondYear.allowanceIncome,
        "A high prior-year income seed should suppress the first year's Allowance relative to the next year in a low-income couple case.",
      );
      assert(
        firstYear.gisIncome < secondYear.gisIncome,
        "A high prior-year income seed should also suppress the first year's GIS relative to the next year.",
      );
    },
  },
];

for (const check of taxChecks) {
  try {
    check.check();
    console.log(`PASS ${check.id} ${check.label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${check.id} ${check.label}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures > 0) {
  console.error(`\n${failures} smoke test(s) failed.`);
  process.exit(1);
}

console.log("\nGolden and tax smoke tests passed.");

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
  );
}

function byPrimaryAge(result, age) {
  const year = result.years.find((entry) => entry.primaryAge === age);

  assert(year, `Expected projection year for primary age ${age}.`);

  return year;
}
