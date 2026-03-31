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
    label: "Quebec FRV stays on warning-heavy partial support",
    check() {
      const input = readJson("data/fixtures/locked-in/qc-frv-warning.json");
      const result = simulateRetirementPlan(input, rules);
      const firstYear = result.years[0];

      assert(
        firstYear.warnings.some((warning) =>
          warning.includes("Quebec FRV maximum withdrawal"),
        ),
        "Quebec FRV scenario should surface the partial-support maximum warning.",
      );
      assert(
        firstYear.lifWithdrawals > 0,
        "Quebec FRV scenario should still allow baseline minimum-style withdrawals.",
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
        creditedYear.warnings.some((warning) =>
          warning.includes("ON / BC / AB provincial residual-credit support"),
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
