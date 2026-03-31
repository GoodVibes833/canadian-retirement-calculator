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
