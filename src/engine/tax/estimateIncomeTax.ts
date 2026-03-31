import type { ProvinceCode } from "../../domain/types.js";

interface TaxBracket {
  upTo: number | null;
  rate: number;
}

interface AgeAmountRule {
  maxClaimAmount: number;
  threshold: number;
  reductionRate: number;
}

interface ProvincialTaxConfig {
  brackets: TaxBracket[];
  creditRate: number;
  basicPersonalAmount: number;
  ageAmountRule?: AgeAmountRule;
  pensionIncomeAmountMax?: number;
  ontarioReductionBase?: number;
}

export interface TaxEstimateInput {
  taxableIncome: number;
  province: ProvinceCode;
  calendarYear: number;
  age?: number;
  eligiblePensionIncome?: number;
}

export interface TaxEstimateResult {
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  marginalRate: number;
  warnings: string[];
}

const FEDERAL_2026: TaxBracket[] = [
  { upTo: 58523, rate: 0.14 },
  { upTo: 117045, rate: 0.205 },
  { upTo: 181440, rate: 0.26 },
  { upTo: 258482, rate: 0.29 },
  { upTo: null, rate: 0.33 },
];

const ONTARIO_2026: TaxBracket[] = [
  { upTo: 53891, rate: 0.0505 },
  { upTo: 107785, rate: 0.0915 },
  { upTo: 150000, rate: 0.1116 },
  { upTo: 220000, rate: 0.1216 },
  { upTo: null, rate: 0.1316 },
];

const BRITISH_COLUMBIA_2026: TaxBracket[] = [
  { upTo: 50363, rate: 0.0506 },
  { upTo: 100728, rate: 0.077 },
  { upTo: 115648, rate: 0.105 },
  { upTo: 140430, rate: 0.1229 },
  { upTo: 190405, rate: 0.147 },
  { upTo: 265545, rate: 0.168 },
  { upTo: null, rate: 0.205 },
];

const ALBERTA_2026: TaxBracket[] = [
  { upTo: 61200, rate: 0.08 },
  { upTo: 154259, rate: 0.1 },
  { upTo: 185111, rate: 0.12 },
  { upTo: 246813, rate: 0.13 },
  { upTo: 370220, rate: 0.14 },
  { upTo: null, rate: 0.15 },
];

const QUEBEC_2026: TaxBracket[] = [
  { upTo: 54345, rate: 0.14 },
  { upTo: 108680, rate: 0.19 },
  { upTo: 132245, rate: 0.24 },
  { upTo: null, rate: 0.2575 },
];

const FEDERAL_CREDIT_RATE_2026 = 0.14;
const FEDERAL_BPA_MAX_2026 = 16452;
const FEDERAL_BPA_MIN_2026 = 14829;
const FEDERAL_BPA_PHASEOUT_THRESHOLD_2026 = 181440;
const FEDERAL_BPA_PHASEOUT_RANGE_2026 = 77042;
const FEDERAL_AGE_AMOUNT_2026: AgeAmountRule = {
  maxClaimAmount: 9208,
  threshold: 46432,
  reductionRate: 0.15,
};
const FEDERAL_PENSION_INCOME_AMOUNT_MAX_2026 = 2000;

const PROVINCIAL_TAX_CONFIG_2026: Partial<Record<ProvinceCode, ProvincialTaxConfig>> = {
  ON: {
    brackets: ONTARIO_2026,
    creditRate: 0.0505,
    basicPersonalAmount: 12989,
    ageAmountRule: {
      maxClaimAmount: 6342,
      threshold: 47210,
      reductionRate: 0.15,
    },
    pensionIncomeAmountMax: 1796,
    ontarioReductionBase: 300,
  },
  BC: {
    brackets: BRITISH_COLUMBIA_2026,
    creditRate: 0.0506,
    basicPersonalAmount: 13216,
    ageAmountRule: {
      maxClaimAmount: 5927,
      threshold: 44119,
      reductionRate: 0.15,
    },
    pensionIncomeAmountMax: 1000,
  },
  AB: {
    brackets: ALBERTA_2026,
    creditRate: 0.08,
    basicPersonalAmount: 22769,
    ageAmountRule: {
      maxClaimAmount: 6345,
      threshold: 47234,
      reductionRate: 0.15,
    },
    pensionIncomeAmountMax: 1753,
  },
  QC: {
    brackets: QUEBEC_2026,
    creditRate: 0.14,
    basicPersonalAmount: 18952,
  },
};

// Official anchors used for these 2026 scaffold tables:
// - Federal and Ontario payroll tables:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032on-jan/t4032on-january-general-information.html
// - Federal TD1 and worksheet:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1.html
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1-ws.html
// - Alberta:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1ab.html
// - British Columbia:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1bc.html
// - Ontario:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1on.html
// - Quebec:
//   https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/
//   https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/trousse-employeur/principaux-changements-pour-2026-trousse-employeur/
// - Quebec abatement:
//   https://www.canada.ca/en/department-finance/programs/federal-transfers/quebec-abatement.html

export function estimateIncomeTax(
  input: TaxEstimateInput,
): TaxEstimateResult {
  const taxableIncome = Math.max(0, input.taxableIncome);
  const internal = estimateIncomeTaxInternal(input);
  const warnings = [...internal.warnings];

  if (input.calendarYear !== 2026) {
    warnings.unshift(
      "Tax estimate currently reuses 2026 tax tables for all projection years.",
    );
  }

  const marginalRate =
    estimateMarginalTax(
      {
        ...input,
        taxableIncome: taxableIncome + 1000,
      },
      false,
    ) / 1000;

  return {
    federalTax: internal.federalTax,
    provincialTax: internal.provincialTax,
    totalTax: internal.totalTax,
    marginalRate,
    warnings,
  };
}

function estimateMarginalTax(
  input: TaxEstimateInput,
  includeWarnings: boolean,
): number {
  const base = calculateTotalTax(input, includeWarnings);
  const prior = calculateTotalTax(
    {
      ...input,
      taxableIncome: Math.max(0, input.taxableIncome - 1000),
    },
    includeWarnings,
  );

  return base - prior;
}

function calculateTotalTax(
  input: TaxEstimateInput,
  includeWarnings: boolean,
): number {
  const result = estimateIncomeTaxInternal(input);

  if (includeWarnings) {
    void result.warnings;
  }

  return result.totalTax;
}

function estimateIncomeTaxInternal(
  input: TaxEstimateInput,
): Omit<TaxEstimateResult, "marginalRate"> {
  const taxableIncome = Math.max(0, input.taxableIncome);
  const warnings: string[] = [];
  const federalBasicTax = applyProgressiveTax(taxableIncome, FEDERAL_2026);
  const federalCredits = calculateFederalCredits(
    taxableIncome,
    input.age,
    input.eligiblePensionIncome,
  );
  let federalTax = Math.max(0, federalBasicTax - federalCredits);

  if (input.province === "QC") {
    federalTax *= 1 - 0.165;
  }

  const provincialTaxResult = calculateProvincialTax(input);
  warnings.push(...provincialTaxResult.warnings);

  if (input.province === "QC") {
    warnings.push(
      "Quebec provincial tax currently applies the indexed basic personal amount, but senior-specific Quebec credits remain partial in the scaffold.",
    );
  }

  return {
    federalTax,
    provincialTax: provincialTaxResult.provincialTax,
    totalTax: federalTax + provincialTaxResult.provincialTax,
    warnings,
  };
}

function calculateFederalCredits(
  taxableIncome: number,
  age: number | undefined,
  eligiblePensionIncome: number | undefined,
): number {
  const basicPersonalAmount = resolveFederalBasicPersonalAmount(taxableIncome);
  const ageAmount =
    age !== undefined && age >= 65
      ? resolveReducedClaimAmount(FEDERAL_AGE_AMOUNT_2026, taxableIncome)
      : 0;
  const pensionIncomeAmount = Math.min(
    FEDERAL_PENSION_INCOME_AMOUNT_MAX_2026,
    Math.max(0, eligiblePensionIncome ?? 0),
  );

  return (
    (basicPersonalAmount + ageAmount + pensionIncomeAmount) *
    FEDERAL_CREDIT_RATE_2026
  );
}

function calculateProvincialTax(
  input: TaxEstimateInput,
): { provincialTax: number; warnings: string[] } {
  const config = PROVINCIAL_TAX_CONFIG_2026[input.province];

  if (!config) {
    return {
      provincialTax: 0,
      warnings: [
        `Province ${input.province} is not yet explicitly modeled in the tax scaffold. Federal tax only is being used.`,
      ],
    };
  }

  const taxableIncome = Math.max(0, input.taxableIncome);
  const baseTax = applyProgressiveTax(taxableIncome, config.brackets);
  const ageAmount =
    input.age !== undefined && input.age >= 65 && config.ageAmountRule
      ? resolveReducedClaimAmount(config.ageAmountRule, taxableIncome)
      : 0;
  const pensionIncomeAmount = Math.min(
    config.pensionIncomeAmountMax ?? 0,
    Math.max(0, input.eligiblePensionIncome ?? 0),
  );
  const credits =
    (config.basicPersonalAmount + ageAmount + pensionIncomeAmount) *
    config.creditRate;
  let provincialTax = Math.max(0, baseTax - credits);

  if (input.province === "ON") {
    provincialTax += estimateOntarioSurtax(provincialTax);
    provincialTax -= estimateOntarioTaxReduction(
      provincialTax,
      config.ontarioReductionBase ?? 0,
    );
    provincialTax += estimateOntarioHealthPremium(taxableIncome);
  }

  return {
    provincialTax: Math.max(0, provincialTax),
    warnings: [],
  };
}

function resolveFederalBasicPersonalAmount(taxableIncome: number): number {
  if (taxableIncome <= FEDERAL_BPA_PHASEOUT_THRESHOLD_2026) {
    return FEDERAL_BPA_MAX_2026;
  }

  const excessIncome =
    taxableIncome - FEDERAL_BPA_PHASEOUT_THRESHOLD_2026;

  if (excessIncome >= FEDERAL_BPA_PHASEOUT_RANGE_2026) {
    return FEDERAL_BPA_MIN_2026;
  }

  const remainingPhaseout =
    FEDERAL_BPA_PHASEOUT_RANGE_2026 - excessIncome;
  const variablePortion =
    FEDERAL_BPA_MAX_2026 - FEDERAL_BPA_MIN_2026;

  return (
    FEDERAL_BPA_MIN_2026 +
    (remainingPhaseout / FEDERAL_BPA_PHASEOUT_RANGE_2026) * variablePortion
  );
}

function resolveReducedClaimAmount(
  rule: AgeAmountRule,
  taxableIncome: number,
): number {
  if (taxableIncome <= rule.threshold) {
    return rule.maxClaimAmount;
  }

  return Math.max(
    0,
    rule.maxClaimAmount - (taxableIncome - rule.threshold) * rule.reductionRate,
  );
}

function applyProgressiveTax(
  taxableIncome: number,
  brackets: TaxBracket[],
): number {
  let tax = 0;
  let previousUpperBound = 0;

  for (const bracket of brackets) {
    const upperBound = bracket.upTo ?? taxableIncome;
    const incomeInBracket = Math.max(
      0,
      Math.min(taxableIncome, upperBound) - previousUpperBound,
    );

    tax += incomeInBracket * bracket.rate;
    previousUpperBound = upperBound;

    if (taxableIncome <= upperBound) {
      break;
    }
  }

  return tax;
}

function estimateOntarioSurtax(ontarioBaseTax: number): number {
  if (ontarioBaseTax <= 5818) {
    return 0;
  }

  if (ontarioBaseTax <= 7446) {
    return (ontarioBaseTax - 5818) * 0.2;
  }

  return (7446 - 5818) * 0.2 + (ontarioBaseTax - 7446) * 0.36;
}

function estimateOntarioTaxReduction(
  ontarioTaxBeforeReduction: number,
  reductionBase: number,
): number {
  if (reductionBase <= 0 || ontarioTaxBeforeReduction <= 0) {
    return 0;
  }

  const reduction = reductionBase * 2 - ontarioTaxBeforeReduction;

  return Math.max(
    0,
    Math.min(ontarioTaxBeforeReduction, reduction),
  );
}

function estimateOntarioHealthPremium(taxableIncome: number): number {
  if (taxableIncome <= 20000) {
    return 0;
  }

  if (taxableIncome <= 36000) {
    return Math.min(300, (taxableIncome - 20000) * 0.06);
  }

  if (taxableIncome <= 48000) {
    return Math.min(450, 300 + (taxableIncome - 36000) * 0.06);
  }

  if (taxableIncome <= 72000) {
    return Math.min(600, 450 + (taxableIncome - 48000) * 0.25);
  }

  if (taxableIncome <= 200000) {
    return Math.min(750, 600 + (taxableIncome - 72000) * 0.0025);
  }

  return Math.min(900, 750 + (taxableIncome - 200000) * 0.0025);
}
