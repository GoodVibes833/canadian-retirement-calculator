export type HouseholdType = "single" | "married" | "common-law";
export type ProvinceCode =
  | "AB"
  | "BC"
  | "MB"
  | "NB"
  | "NL"
  | "NS"
  | "NT"
  | "NU"
  | "ON"
  | "PE"
  | "QC"
  | "SK"
  | "YT";

export type PensionPlanType = "CPP" | "QPP";
export type LockedInJurisdictionCode =
  | "AB"
  | "BC"
  | "Federal"
  | "ON"
  | "QC";
export type LockedInPreIncomeAccountLabel = "CRI" | "LIRA";
export type LockedInIncomeAccountLabel = "FRV" | "LIF";
export type CppQppEstimateMode =
  | "statement-at-65"
  | "manual-at-start-age"
  | "entitlement-percent";
export type OasEstimateMode =
  | "residence-years"
  | "manual-at-start-age";
export type WithdrawalOrder =
  | "taxable-first"
  | "rrsp-rrif-first"
  | "tfsa-first"
  | "tax-aware-blended"
  | "custom";

export interface PersonProfile {
  id: string;
  currentAge: number;
  sex?: "female" | "male" | "other";
  retirementAge: number;
  lifeExpectancy: number;
  provinceAtRetirement: ProvinceCode;
  pensionPlan: PensionPlanType;
  yearsResidedInCanadaAfter18: number;
}

export interface EmploymentIncomeInput {
  baseAnnualIncome: number;
  bonusAnnualIncome?: number;
  annualGrowthRate: number;
  partTimeIncomeAfterRetirement?: ScheduledCashFlow[];
}

export interface PublicBenefitInput {
  cppQppEstimateMode: CppQppEstimateMode;
  statementMonthlyPensionAt65?: number;
  manualMonthlyPensionAtStartAge?: number;
  entitlementPercentOfMaximum?: number;
  pensionStartAge: number;
  oasEstimateMode: OasEstimateMode;
  manualOasMonthlyAtStartAge?: number;
  oasStartAge: number;
  oasEligible?: boolean;
  oasResidenceYearsOverride?: number;
  immigrationAgeToCanada?: number;
  hasSocialSecurityAgreementCountry?: boolean;
  notes?: string;
}

export interface DefinedBenefitPensionInput {
  annualAmount: number;
  startAge: number;
  indexationRate?: number;
  bridgeTo65AnnualAmount?: number;
  survivorContinuationPercent?: number;
}

export interface LockedInAccountPolicy {
  jurisdiction: LockedInJurisdictionCode;
  preIncomeAccountLabel?: LockedInPreIncomeAccountLabel;
  incomeAccountLabel?: LockedInIncomeAccountLabel;
  plannedConversionAge?: number;
  manualMinimumAnnualWithdrawal?: number;
  manualMaximumAnnualWithdrawal?: number;
  assumedPreviousYearReturnRate?: number;
  usedOneTimeFiftyPercentUnlocking?: boolean;
  notes?: string;
}

export interface InvestmentAccountBalances {
  rrsp: number;
  rrif: number;
  tfsa: number;
  nonRegistered: number;
  cash?: number;
  lira?: number;
  lif?: number;
  dcPension?: number;
}

export interface AnnualContributionPlan {
  rrsp: number;
  tfsa: number;
  nonRegistered: number;
  contributionEscalationRate: number;
  rrspRoomRemaining?: number;
  tfsaRoomRemaining?: number;
}

export interface ExpenseProfile {
  desiredAfterTaxSpending: number;
  housing: number;
  utilities: number;
  food: number;
  transportation: number;
  healthcare: number;
  insurance: number;
  travelAndRecreation: number;
  debtPayments: number;
  familySupport?: number;
  giftsAndDonations?: number;
  professionalServices?: number;
  longTermCareReserve?: number;
  legacyGoal?: number;
}

export interface ScheduledCashFlow {
  startAge: number;
  endAge?: number;
  annualAmount: number;
  inflationLinked?: boolean;
  description?: string;
}

export interface OneTimeEvent {
  age: number;
  amount: number;
  direction: "inflow" | "outflow";
  description: string;
}

export interface HouseholdMemberInput {
  profile: PersonProfile;
  employment: EmploymentIncomeInput;
  publicBenefits: PublicBenefitInput;
  definedBenefitPension?: DefinedBenefitPensionInput;
  lockedInAccountPolicy?: LockedInAccountPolicy;
  accounts: InvestmentAccountBalances;
  contributions: AnnualContributionPlan;
  annuityIncome?: ScheduledCashFlow[];
  rentalIncome?: ScheduledCashFlow[];
  foreignPensionIncome?: ScheduledCashFlow[];
}

export interface HouseholdInput {
  householdType: HouseholdType;
  primary: HouseholdMemberInput;
  partner?: HouseholdMemberInput;
  inflationRate: number;
  preRetirementReturnRate: number;
  postRetirementReturnRate: number;
  annualFeeRate?: number;
  taxMode: "nominal" | "real";
  withdrawalOrder: WithdrawalOrder;
  pensionIncomeSplittingEnabled: boolean;
  oasClawbackAwareMode: boolean;
  gisModelingEnabled: boolean;
  expenseProfile: ExpenseProfile;
  oneTimeEvents: OneTimeEvent[];
  customWithdrawalOrder?: string[];
  projectionStartYear: number;
  maxProjectionAge: number;
}

export interface SimulationInput {
  household: HouseholdInput;
}
