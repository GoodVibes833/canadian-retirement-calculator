export interface RuleSource {
  label: string;
  url: string;
  accessedOn: string;
}

export interface AgeBound {
  min: number;
  max: number;
}

export interface CppRuleSet {
  startAge: AgeBound;
  reductionPerMonthBefore65: number;
  increasePerMonthAfter65: number;
  maxMonthlyRetirementAt65: number;
  ybe: number;
  ympe: number;
  yampe: number;
  employeeContributionRateBase: number;
  employeeContributionRateSecondAdditional: number;
  employeeMaximumContributionBase: number;
  employeeMaximumContributionSecondAdditional: number;
  annualAdjustmentInPay: number;
}

export interface QppRuleSet {
  startAge: AgeBound;
  reductionPerMonthBefore65Min: number;
  reductionPerMonthBefore65Max: number;
  increasePerMonthAfter65: number;
  maxMonthlyRetirementAt65: number;
  notes: string[];
}

export interface OasMonthlyMaximum {
  ageBand: "65-74" | "75+";
  amount: number;
}

export interface OasRecoveryPeriod {
  periodLabel: string;
  incomeYear: number;
  lowerThreshold: number;
  upperThresholdAge65To74: number;
  upperThresholdAge75Plus: number;
}

export interface GisMaximum {
  householdCase:
    | "single-oas"
    | "spouse-no-oas"
    | "spouse-oas"
    | "spouse-allowance";
  monthlyMaximum: number;
  incomeCutoff: number;
  topUpCutoff: number;
}

export interface OasRuleSet {
  startAge: AgeBound;
  increasePerMonthAfter65: number;
  fullResidenceYearsAfter18: number;
  monthlyMaximums: OasMonthlyMaximum[];
  recoveryPeriods: OasRecoveryPeriod[];
  gisMaximums: GisMaximum[];
  allowanceMaximumMonthly: number;
  allowanceSurvivorMaximumMonthly: number;
}

export interface RrifRuleSet {
  formulaAtOrBelow70: string;
  allOtherRrifFactorsByAge: Record<string, number>;
}

export interface RegisteredAccountLimits {
  tfsaAnnualLimit: number;
  rrspAnnualLimit: number;
}

export interface TaxableAccountRuleSet {
  capitalGainsInclusionRate: number;
  notes: string[];
}

export type LockedInJurisdictionRuleCode =
  | "AB"
  | "BC"
  | "Federal"
  | "ON"
  | "QC";

export interface LockedInJurisdictionRuleSet {
  earliestConversionAge: number;
  preIncomeAccountLabel: string;
  incomeAccountLabel: string;
  usesRrifMinimumRule: boolean;
  noMaximumWithdrawalAge?: number;
  underNoMaximumAgePrescribedRate?: number;
  temporaryIncomeMaximumAnnual?: number;
  temporaryIncomeEstimatedIncomeOffsetRate?: number;
  fallbackLongTermRate?: number;
  applySixPercentFloor?: boolean;
  annuityCertainEndAge?: number;
  notes: string[];
}

export interface LockedInRuleSet {
  jurisdictions: Partial<
    Record<LockedInJurisdictionRuleCode, LockedInJurisdictionRuleSet>
  >;
}

export interface CanadaRuleSet {
  jurisdiction: "CA";
  effectiveFrom: string;
  sources: RuleSource[];
  cpp: CppRuleSet;
  qpp: QppRuleSet;
  oas: OasRuleSet;
  rrif: RrifRuleSet;
  lockedIn: LockedInRuleSet;
  registeredAccounts: RegisteredAccountLimits;
  taxableAccounts: TaxableAccountRuleSet;
}
