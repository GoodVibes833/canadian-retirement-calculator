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
  dividendCredit?: {
    eligibleTaxableRate?: number;
    nonEligibleTaxableRate?: number;
    eligibleActualRate?: number;
    nonEligibleActualRate?: number;
  };
}

export interface TaxEstimateInput {
  taxableIncome: number;
  province: ProvinceCode;
  calendarYear: number;
  age?: number;
  eligibleWorkIncome?: number;
  eligiblePensionIncome?: number;
  eligibleDividendIncome?: number;
  nonEligibleDividendIncome?: number;
  foreignNonBusinessIncome?: number;
  foreignNonBusinessIncomeTaxPaid?: number;
}

export interface TaxEstimateResult {
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  marginalRate: number;
  federalForeignTaxCredit: number;
  provincialForeignTaxCredit: number;
  quebecCareerExtensionCredit: number;
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
const ELIGIBLE_DIVIDEND_GROSS_UP_RATE = 0.38;
const NON_ELIGIBLE_DIVIDEND_GROSS_UP_RATE = 0.15;
const FEDERAL_ELIGIBLE_DIVIDEND_TAX_CREDIT_RATE = 0.150198;
const FEDERAL_NON_ELIGIBLE_DIVIDEND_TAX_CREDIT_RATE = 0.090301;

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
    dividendCredit: {
      eligibleTaxableRate: 0.1,
      nonEligibleTaxableRate: 0.029863,
    },
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
    dividendCredit: {
      eligibleTaxableRate: 0.12,
      nonEligibleTaxableRate: 0.0196,
    },
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
    dividendCredit: {
      eligibleTaxableRate: 0.0812,
      nonEligibleTaxableRate: 0.0218,
    },
  },
  QC: {
    brackets: QUEBEC_2026,
    creditRate: 0.14,
    basicPersonalAmount: 18952,
    dividendCredit: {
      eligibleActualRate: 0.16146,
      nonEligibleActualRate: 0.03933,
    },
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
// - Federal dividend gross-up and credit:
//   https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/calculating-deductions/how-to-calculate/federal-provincial-territorial-tax/2025.html
// - Ontario dividend tax credit worksheet:
//   https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d/5006-d-25e.txt
// - Alberta dividend tax credit worksheet:
//   https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5009-d/5009-d-25e.txt
// - British Columbia dividend tax credit worksheet:
//   https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5010-d/5010-d-25e.txt
// - Quebec dividend tax credit:
//   https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/how-to-complete-your-income-tax-return/line-by-line-help/400-to-447-income-tax-and-contributions/line-415/
// - Quebec career extension credit:
//   https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/how-to-complete-your-income-tax-return/line-by-line-help/350-to-398-1-non-refundable-tax-credits/line-391/
//   https://www.revenuquebec.ca/en/citizens/tax-credits/tax-credit-for-career-extension/
// - Federal foreign tax credit guidance:
//   https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40500-federal-foreign-tax-credit.html
// - Ontario 2025 package, line 82 provincial foreign tax credit:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html
// - British Columbia 2025 package, line 71 provincial foreign tax credit:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/british-columbia/5010-pc.html
// - Alberta 2025 package, line 69 provincial foreign tax credit:
//   https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/alberta/5009-pc.html
// - Quebec line 409 foreign tax credit:
//   https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/how-to-complete-your-income-tax-return/line-by-line-help/400-to-447-income-tax-and-contributions/line-409/

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

  if (
    (input.eligibleDividendIncome ?? 0) > 0 ||
    (input.nonEligibleDividendIncome ?? 0) > 0
  ) {
    warnings.push(
      "Dividend gross-up and provincial credit percentages currently use the latest published 2025 return worksheets and line-help sources as the 2026 scaffold anchor.",
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
    federalForeignTaxCredit: internal.federalForeignTaxCredit,
    provincialForeignTaxCredit: internal.provincialForeignTaxCredit,
    quebecCareerExtensionCredit: internal.quebecCareerExtensionCredit,
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
  const federalCredits = calculateFederalCredits(input);
  let federalTaxBeforeForeignTaxCredit = Math.max(0, federalBasicTax - federalCredits);

  if (input.province === "QC") {
    federalTaxBeforeForeignTaxCredit *= 1 - 0.165;
  }

  const federalForeignTaxCredit = calculateFederalForeignTaxCredit(
    input,
    federalTaxBeforeForeignTaxCredit,
  );
  const federalTax = Math.max(
    0,
    federalTaxBeforeForeignTaxCredit - federalForeignTaxCredit,
  );

  const provincialTaxResult = calculateProvincialTax(input);
  warnings.push(...provincialTaxResult.warnings);

  const provincialForeignTaxCredit = calculateProvincialForeignTaxCredit(
    input,
    provincialTaxResult.provincialTaxBeforeForeignTaxCredit,
    federalForeignTaxCredit,
  );
  const provincialTax = Math.max(
    0,
    provincialTaxResult.provincialTaxBeforeForeignTaxCredit -
      provincialForeignTaxCredit,
  );

  if ((input.foreignNonBusinessIncomeTaxPaid ?? 0) > 0) {
    warnings.push(
      input.province === "QC"
        ? "Foreign tax credit currently uses a baseline federal approximation plus a Quebec residual-credit approximation for foreign non-business income. Exact TP-772-V detail, treaty-specific handling, and multi-country cases are not yet modeled."
        : "Foreign tax credit currently uses a baseline federal approximation plus an ON / BC / AB provincial residual-credit approximation for foreign non-business income. Treaty-specific and multi-country detail are not yet modeled.",
    );
  }

  if (
    (input.foreignNonBusinessIncomeTaxPaid ?? 0) > 0 &&
    Math.max(0, input.foreignNonBusinessIncome ?? 0) <= 0
  ) {
    warnings.push(
      "Foreign tax paid was provided without modeled foreign non-business income, so no foreign tax credit was applied.",
    );
  }

  if (input.province === "QC") {
    warnings.push(
      "Quebec provincial tax currently applies the indexed basic personal amount and a baseline career extension credit, but Schedule B relief measures, senior-specific detail, and form-level Quebec calculations remain partial in the scaffold.",
    );
  }

  return {
    federalTax,
    federalForeignTaxCredit,
    provincialForeignTaxCredit,
    quebecCareerExtensionCredit: provincialTaxResult.quebecCareerExtensionCredit,
    provincialTax,
    totalTax: federalTax + provincialTax,
    warnings,
  };
}

function calculateFederalCredits(
  input: TaxEstimateInput,
): number {
  const taxableIncome = Math.max(0, input.taxableIncome);
  const basicPersonalAmount = resolveFederalBasicPersonalAmount(taxableIncome);
  const ageAmount =
    input.age !== undefined && input.age >= 65
      ? resolveReducedClaimAmount(FEDERAL_AGE_AMOUNT_2026, taxableIncome)
      : 0;
  const pensionIncomeAmount = Math.min(
    FEDERAL_PENSION_INCOME_AMOUNT_MAX_2026,
    Math.max(0, input.eligiblePensionIncome ?? 0),
  );
  const dividendCredits =
    resolveEligibleDividendTaxableAmount(input.eligibleDividendIncome) *
      FEDERAL_ELIGIBLE_DIVIDEND_TAX_CREDIT_RATE +
    resolveNonEligibleDividendTaxableAmount(input.nonEligibleDividendIncome) *
      FEDERAL_NON_ELIGIBLE_DIVIDEND_TAX_CREDIT_RATE;

  return (
    (basicPersonalAmount + ageAmount + pensionIncomeAmount) *
      FEDERAL_CREDIT_RATE_2026 +
    dividendCredits
  );
}

function calculateProvincialTax(
  input: TaxEstimateInput,
): {
  provincialTaxBeforeForeignTaxCredit: number;
  quebecCareerExtensionCredit: number;
  warnings: string[];
} {
  const config = PROVINCIAL_TAX_CONFIG_2026[input.province];

  if (!config) {
    return {
      provincialTaxBeforeForeignTaxCredit: 0,
      quebecCareerExtensionCredit: 0,
      warnings: [
        `Province ${input.province} is not yet explicitly modeled in the tax scaffold. Federal tax only is being used.`,
      ],
    };
  }

  const taxableIncome = Math.max(0, input.taxableIncome);
  const baseTax = applyProgressiveTax(taxableIncome, config.brackets);
  const warnings: string[] = [];
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
      config.creditRate +
    calculateProvincialDividendCredit(input, config);
  let provincialTax = Math.max(0, baseTax - credits);

  if (input.province === "ON") {
    provincialTax += estimateOntarioSurtax(provincialTax);
    provincialTax -= estimateOntarioTaxReduction(
      provincialTax,
      config.ontarioReductionBase ?? 0,
    );
    provincialTax += estimateOntarioHealthPremium(taxableIncome);
  }

  const quebecCareerExtensionCredit = calculateQuebecCareerExtensionCredit(input);

  if (quebecCareerExtensionCredit > 0) {
    provincialTax = Math.max(0, provincialTax - quebecCareerExtensionCredit);
    warnings.push(
      "Quebec career extension credit currently uses the published 2025 thresholds as the 2026 scaffold anchor and uses modeled taxable income as a proxy for net income.",
    );
  }

  return {
    provincialTaxBeforeForeignTaxCredit: Math.max(0, provincialTax),
    quebecCareerExtensionCredit,
    warnings,
  };
}

function calculateProvincialDividendCredit(
  input: TaxEstimateInput,
  config: ProvincialTaxConfig,
): number {
  const dividendCredit = config.dividendCredit;

  if (!dividendCredit) {
    return 0;
  }

  return (
    resolveEligibleDividendTaxableAmount(input.eligibleDividendIncome) *
      (dividendCredit.eligibleTaxableRate ?? 0) +
    resolveNonEligibleDividendTaxableAmount(input.nonEligibleDividendIncome) *
      (dividendCredit.nonEligibleTaxableRate ?? 0) +
    Math.max(0, input.eligibleDividendIncome ?? 0) *
      (dividendCredit.eligibleActualRate ?? 0) +
    Math.max(0, input.nonEligibleDividendIncome ?? 0) *
      (dividendCredit.nonEligibleActualRate ?? 0)
  );
}

function calculateFederalForeignTaxCredit(
  input: TaxEstimateInput,
  federalTaxBeforeForeignTaxCredit: number,
): number {
  const foreignIncome = Math.max(0, input.foreignNonBusinessIncome ?? 0);
  const foreignTaxPaid = Math.max(0, input.foreignNonBusinessIncomeTaxPaid ?? 0);
  const taxableIncome = Math.max(0, input.taxableIncome);

  if (
    foreignIncome <= 0 ||
    foreignTaxPaid <= 0 ||
    taxableIncome <= 0 ||
    federalTaxBeforeForeignTaxCredit <= 0
  ) {
    return 0;
  }

  const maximumIncomeShare = Math.min(1, foreignIncome / taxableIncome);
  const maximumCredit = federalTaxBeforeForeignTaxCredit * maximumIncomeShare;

  return Math.min(foreignTaxPaid, maximumCredit);
}

function calculateProvincialForeignTaxCredit(
  input: TaxEstimateInput,
  provincialTaxBeforeForeignTaxCredit: number,
  federalForeignTaxCredit: number,
): number {
  // The CRA provincial package pages direct ON / BC / AB filers to Form T2036 when
  // federal FTC on non-business income does not fully absorb the foreign tax paid.
  // Until the exact T2036 worksheet math is table-driven here, use a bounded residual
  // approximation: remaining foreign tax after federal FTC, capped by the province-tax
  // share attributable to the modeled foreign non-business income.
  const foreignIncome = Math.max(0, input.foreignNonBusinessIncome ?? 0);
  const foreignTaxPaid = Math.max(0, input.foreignNonBusinessIncomeTaxPaid ?? 0);
  const taxableIncome = Math.max(0, input.taxableIncome);

  if (
    foreignIncome <= 0 ||
    foreignTaxPaid <= 0 ||
    taxableIncome <= 0 ||
    provincialTaxBeforeForeignTaxCredit <= 0
  ) {
    return 0;
  }

  const residualForeignTax = Math.max(0, foreignTaxPaid - federalForeignTaxCredit);
  const foreignIncomeShare = Math.min(1, foreignIncome / taxableIncome);
  const maximumCredit =
    input.province === "QC"
      ? Math.min(
          residualForeignTax,
          provincialTaxBeforeForeignTaxCredit * foreignIncomeShare,
        )
      : provincialTaxBeforeForeignTaxCredit * foreignIncomeShare;

  return Math.min(residualForeignTax, maximumCredit);
}

function calculateQuebecCareerExtensionCredit(
  input: TaxEstimateInput,
): number {
  if (input.province !== "QC" || (input.age ?? 0) < 65) {
    return 0;
  }

  const taxableIncome = Math.max(0, input.taxableIncome);
  const eligibleWorkIncome = Math.max(0, input.eligibleWorkIncome ?? 0);
  const excludedWorkIncome = 7500;
  const maximumEligibleWorkIncome = 12500;
  const creditRate = 0.35;
  const maximumCredit = 1750;
  const reductionThreshold = 56500;
  const reductionRate = 0.07;

  if (eligibleWorkIncome <= excludedWorkIncome || taxableIncome >= 81500) {
    return 0;
  }

  const baseCredit =
    Math.min(maximumEligibleWorkIncome, eligibleWorkIncome) - excludedWorkIncome;
  const reducedCredit =
    baseCredit * creditRate -
    Math.max(0, taxableIncome - reductionThreshold) * reductionRate;

  return Math.min(maximumCredit, Math.max(0, reducedCredit));
}

function resolveEligibleDividendTaxableAmount(
  eligibleDividendIncome: number | undefined,
): number {
  return Math.max(0, eligibleDividendIncome ?? 0) * (1 + ELIGIBLE_DIVIDEND_GROSS_UP_RATE);
}

function resolveNonEligibleDividendTaxableAmount(
  nonEligibleDividendIncome: number | undefined,
): number {
  return (
    Math.max(0, nonEligibleDividendIncome ?? 0) *
    (1 + NON_ELIGIBLE_DIVIDEND_GROSS_UP_RATE)
  );
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
