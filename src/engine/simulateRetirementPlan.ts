import type {
  BeneficiaryDesignationType,
  HouseholdMemberInput,
  ProvinceCode,
  SimulationInput,
  WithdrawalOrder,
} from "../domain/types.js";
import type {
  ProjectionYear,
  SimulationResult,
  SimulationSummary,
} from "../domain/results.js";
import type { CanadaRuleSet } from "../rules/types.js";
import { estimateIncomeTax } from "./tax/estimateIncomeTax.js";

type MemberSlot = "primary" | "partner";
type RegisteredAccountKey = "rrsp" | "rrif" | "tfsa" | "lira" | "lif" | "dcPension";
type WithdrawableSource =
  | "cash"
  | "lif"
  | "nonRegistered"
  | "tfsa"
  | "rrif"
  | "rrsp";

interface NormalizedContext {
  input: SimulationInput;
  rules: CanadaRuleSet;
}

interface PeriodState {
  calendarYear: number;
  primaryAge: number;
  partnerAge?: number;
  retirementActive: boolean;
}

interface AccountLedger {
  rrsp: number;
  rrif: number;
  tfsa: number;
  nonRegistered: number;
  nonRegisteredCostBase: number;
  cash: number;
  lira: number;
  lif: number;
  dcPension: number;
}

interface HouseholdLedger {
  primary: AccountLedger;
  partner?: AccountLedger;
}

interface TaxAttributeLedger {
  netCapitalLossCarryforward: number;
}

interface HouseholdTaxAttributeLedger {
  primary: TaxAttributeLedger;
  partner?: TaxAttributeLedger;
}

interface MemberFrame {
  slot: MemberSlot;
  member: HouseholdMemberInput;
  age: number;
  province: ProvinceCode;
  isAlive: boolean;
  deathOccursThisYear: boolean;
  yearFraction: number;
  isRetired: boolean;
  employmentIncome: number;
  rrspContribution: number;
  tfsaContribution: number;
  nonRegisteredContribution: number;
  cppQppIncome: number;
  oasIncome: number;
  dbPensionIncome: number;
  annuityIncome: number;
  rentalIncome: number;
  foreignPensionIncome: number;
  taxableInterestIncome: number;
  eligibleDividendIncome: number;
  nonEligibleDividendIncome: number;
  foreignDividendIncome: number;
  foreignNonBusinessIncomeTaxPaid: number;
  returnOfCapitalDistribution: number;
  deemedCapitalGainFromReturnOfCapital: number;
  taxableCapitalGainFromReturnOfCapital: number;
  otherPlannedIncome: number;
}

interface MemberTaxState {
  eligibleWorkIncome: number;
  ordinaryTaxableIncome: number;
  grossTaxableCapitalGains: number;
  allowableCapitalLossesCurrentYear: number;
  openingNetCapitalLossCarryforward: number;
  netCapitalLossCarryforwardUsed: number;
  closingNetCapitalLossCarryforward: number;
  taxableIncome: number;
  taxes: number;
  oasRecoveryTax: number;
  federalForeignTaxCredit: number;
  provincialForeignTaxCredit: number;
  quebecCareerExtensionCredit: number;
  quebecTaxReliefMeasuresCredit: number;
  marginalRate: number;
  province: ProvinceCode;
  oasIncome: number;
  age: number;
  livesAloneForTaxYear: boolean;
  eligiblePensionIncome: number;
  pensionIncomeSplitIn: number;
  pensionIncomeSplitOut: number;
  eligibleDividendIncome: number;
  nonEligibleDividendIncome: number;
  foreignNonBusinessIncome: number;
  foreignNonBusinessIncomeTaxPaid: number;
  realizedCapitalGains: number;
  taxableCapitalGains: number;
  warnings: string[];
}

interface HouseholdCashFlowEvents {
  inflows: number;
  outflows: number;
  descriptions: string[];
}

interface DrawdownResult {
  rrspRrifWithdrawals: number;
  lifWithdrawals: number;
  tfsaWithdrawals: number;
  taxableWithdrawals: number;
  realizedCapitalGains: number;
  taxableCapitalGains: number;
  cashWithdrawals: number;
  netFromWithdrawals: number;
  remainingGap: number;
  warnings: string[];
}

interface IncomeTestedBenefitProjection {
  gisAnnual: number;
  allowanceAnnual: number;
  allowanceSurvivorAnnual: number;
  totalAnnual: number;
  warnings: string[];
}

interface AnnualizedOasBenefitValues {
  monthlyMaximums: CanadaRuleSet["oas"]["monthlyMaximums"];
  gisMaximums: CanadaRuleSet["oas"]["gisMaximums"];
  allowanceMaximumMonthly: number;
  allowanceIncomeCutoff: number;
  allowanceSurvivorMaximumMonthly: number;
  allowanceSurvivorIncomeCutoff: number;
  usedQuarterlyBenefitPeriods: boolean;
  usedFallbackLatestValues: boolean;
}

interface IncomeTestedBenefitAssessableIncomeState {
  calendarYear: number;
  primaryAssessableIncome: number;
  partnerAssessableIncome?: number;
  combinedAssessableIncome: number;
  seededFromInput: boolean;
}

interface SingleYearProjection {
  output: ProjectionYear;
  nextBalances: HouseholdLedger;
  nextTaxAttributes: HouseholdTaxAttributeLedger;
  nextIncomeTestedBenefitAssessableIncomeState: IncomeTestedBenefitAssessableIncomeState;
}

interface TerminalEstateEstimate {
  grossEstateValue: number;
  afterTaxEstateValue: number;
  terminalTaxLiability: number;
  probateOrEstateAdminCost?: number;
  estateProcedureLabel?: string;
  warnings: string[];
}

interface DeathYearFinalReturnAdjustment {
  taxAdjustment: number;
  oasRecoveryTaxAdjustment: number;
  taxableIncomeAdjustment: number;
  warnings: string[];
}

interface DeathYearProbateSnapshot {
  probateBaseValue: number;
  probateExcludedAssets: number;
  probateCost?: number;
  estateProcedureLabel?: string;
  warnings: string[];
}

interface MandatoryMinimumWithdrawalResult {
  rrifBySlot: Partial<Record<MemberSlot, number>>;
  lifBySlot: Partial<Record<MemberSlot, number>>;
  rrifTotal: number;
  lifTotal: number;
  total: number;
}

interface LockedInAnnualLimitState {
  jurisdiction: string;
  incomeAccountLabel: string;
  openingLifBalance: number;
  minimumWithdrawal: number;
  maximumWithdrawal: number;
  withdrawnSoFar: number;
}

interface PensionSplitCandidateResult {
  states: Partial<Record<MemberSlot, MemberTaxState>>;
  totalTaxBurden: number;
  transferAmount: number;
  transferFrom?: MemberSlot;
  transferTo?: MemberSlot;
}

interface TaxableWithdrawalBreakdown {
  costBaseReduction: number;
  realizedCapitalGain: number;
  taxableCapitalGain: number;
  allowableCapitalLoss: number;
}

export function simulateRetirementPlan(
  input: SimulationInput,
  rules: CanadaRuleSet,
): SimulationResult {
  const context = normalizeContext(input, rules);
  const timeline = buildAnnualTimeline(context);
  let balances = initializeHouseholdLedger(context.input);
  let taxAttributes = initializeHouseholdTaxAttributeLedger(context.input);
  let incomeTestedBenefitAssessableIncomeState =
    initializeIncomeTestedBenefitAssessableIncomeState(context.input);
  const years: ProjectionYear[] = [];

  for (const period of timeline) {
    const projectedYear = projectSingleYear(
      context,
      period,
      balances,
      taxAttributes,
      incomeTestedBenefitAssessableIncomeState,
    );
    years.push(projectedYear.output);
    balances = projectedYear.nextBalances;
    taxAttributes = projectedYear.nextTaxAttributes;
    incomeTestedBenefitAssessableIncomeState =
      projectedYear.nextIncomeTestedBenefitAssessableIncomeState;
  }

  const summary = summarizeProjection(context, years, balances, taxAttributes);

  return {
    summary,
    years,
    assumptionsUsed: buildAssumptionList(context),
  };
}

function normalizeContext(
  input: SimulationInput,
  rules: CanadaRuleSet,
): NormalizedContext {
  validateRetirementAges(input, rules);

  return {
    input,
    rules,
  };
}

function validateRetirementAges(
  input: SimulationInput,
  rules: CanadaRuleSet,
): void {
  for (const entry of getMemberEntries(input)) {
    const { member } = entry;
    const pensionPlan = member.profile.pensionPlan;
    const benefitInput = member.publicBenefits;

    if (
      pensionPlan === "CPP" &&
      (benefitInput.pensionStartAge < rules.cpp.startAge.min ||
        benefitInput.pensionStartAge > rules.cpp.startAge.max)
    ) {
      throw new Error(
        `CPP start age must be between ${rules.cpp.startAge.min} and ${rules.cpp.startAge.max}.`,
      );
    }

    if (
      pensionPlan === "QPP" &&
      (benefitInput.pensionStartAge < rules.qpp.startAge.min ||
        benefitInput.pensionStartAge > rules.qpp.startAge.max)
    ) {
      throw new Error(
        `QPP start age must be between ${rules.qpp.startAge.min} and ${rules.qpp.startAge.max}.`,
      );
    }

    if (
      benefitInput.oasStartAge < rules.oas.startAge.min ||
      benefitInput.oasStartAge > rules.oas.startAge.max
    ) {
      throw new Error(
        `OAS start age must be between ${rules.oas.startAge.min} and ${rules.oas.startAge.max}.`,
      );
    }
  }
}

function buildAnnualTimeline(context: NormalizedContext): PeriodState[] {
  const years: PeriodState[] = [];
  const { household } = context.input;
  const projectionCapOffset = Math.max(
    0,
    household.maxProjectionAge - household.primary.profile.currentAge,
  );
  const memberLifeExpectancyOffsets = getMemberEntries(context.input).map(
    ({ member }) => Math.max(0, member.profile.lifeExpectancy - member.profile.currentAge),
  );
  const finalOffset = Math.min(
    projectionCapOffset,
    Math.max(...memberLifeExpectancyOffsets),
  );
  const length = Math.max(
    0,
    finalOffset + 1,
  );

  for (let offset = 0; offset < length; offset += 1) {
    const primaryAge = household.primary.profile.currentAge + offset;
    const partnerAge = household.partner
      ? household.partner.profile.currentAge + offset
      : undefined;
    const retirementActive = getMemberEntries(context.input).some(({ slot, member }) => {
      const age = slot === "primary" ? primaryAge : partnerAge;
      return age !== undefined && age >= member.profile.retirementAge;
    });

    years.push({
      calendarYear: household.projectionStartYear + offset,
      primaryAge,
      partnerAge,
      retirementActive,
    });
  }

  return years;
}

function projectSingleYear(
  context: NormalizedContext,
  period: PeriodState,
  openingBalances: HouseholdLedger,
  openingTaxAttributes: HouseholdTaxAttributeLedger,
  incomeTestedBenefitAssessableIncomeState: IncomeTestedBenefitAssessableIncomeState | undefined,
): SingleYearProjection {
  let balances = cloneHouseholdLedger(openingBalances);
  const taxAttributes = cloneHouseholdTaxAttributeLedger(openingTaxAttributes);
  const warnings: string[] = [];
  const memberFrames = buildMemberFrames(context, period);
  applyDeathYearSurvivorBenefitAdjustments(context, memberFrames, warnings);
  applySurvivorAdjustments(context, memberFrames, balances, warnings);
  applyAnnualTaxableAccountDistributions(
    context,
    memberFrames,
    balances,
    warnings,
  );
  applyLockedInConversions(context, memberFrames, balances, warnings);
  applyMandatoryConversions(context, period, balances, warnings);
  const lockedInAnnualLimits = buildLockedInAnnualLimits(
    context,
    memberFrames,
    balances,
    warnings,
  );
  const mandatoryMinimumWithdrawals = applyMandatoryMinimumWithdrawals(
    context,
    memberFrames,
    balances,
    lockedInAnnualLimits,
    warnings,
  );
  let memberTaxState = buildBaseTaxState(
    context,
    period,
    memberFrames,
    mandatoryMinimumWithdrawals,
    taxAttributes,
  );

  warnings.push(...collectTaxWarnings(memberTaxState));

  const baseSpending = estimateSpending(context, period, memberFrames);
  const oneTimeCashFlow = getOneTimeCashFlow(context, period);
  const spending = baseSpending + oneTimeCashFlow.outflows;
  const totalContributions = applyContributions(memberFrames, balances);
  const baseCashIncome =
    sumMemberFrames(memberFrames, (frame) => frame.employmentIncome) +
    sumMemberFrames(memberFrames, (frame) => frame.cppQppIncome) +
    sumMemberFrames(memberFrames, (frame) => frame.oasIncome) +
    sumMemberFrames(memberFrames, (frame) => frame.dbPensionIncome) +
    sumMemberFrames(memberFrames, (frame) => frame.otherPlannedIncome) +
    mandatoryMinimumWithdrawals.total +
    oneTimeCashFlow.inflows;
  const baseTaxAndRecovery =
    sumMemberTaxState(memberTaxState, (state) => state.taxes) +
    sumMemberTaxState(memberTaxState, (state) => state.oasRecoveryTax);
  const baseAfterTaxCash = baseCashIncome - baseTaxAndRecovery;
  const requiredCash = spending + totalContributions;
  const drawdownResolution = resolveDrawdownAndIncomeTestedBenefits(
    context,
    period,
    memberFrames,
    balances,
    memberTaxState,
    lockedInAnnualLimits,
    incomeTestedBenefitAssessableIncomeState,
    baseAfterTaxCash,
    requiredCash,
  );
  balances = drawdownResolution.balances;
  memberTaxState = drawdownResolution.memberTaxState;
  const drawdown = drawdownResolution.drawdown;
  const incomeTestedBenefits = drawdownResolution.incomeTestedBenefits;

  const quebecTaxReliefMeasuresCreditApplied = applyQuebecTaxReliefMeasures(
    context,
    memberTaxState,
    warnings,
  );

  warnings.push(...collectTaxWarnings(memberTaxState));
  warnings.push(
    ...drawdown.warnings,
    ...incomeTestedBenefits.warnings,
    ...oneTimeCashFlow.descriptions,
  );

  let beforeTaxIncome =
    sumMemberFrames(memberFrames, (frame) => frame.employmentIncome) +
    sumMemberFrames(memberFrames, (frame) => frame.cppQppIncome) +
    sumMemberFrames(memberFrames, (frame) => frame.oasIncome) +
    incomeTestedBenefits.totalAnnual +
    sumMemberFrames(memberFrames, (frame) => frame.dbPensionIncome) +
    sumMemberFrames(memberFrames, (frame) => frame.otherPlannedIncome) +
    mandatoryMinimumWithdrawals.total +
    drawdown.rrspRrifWithdrawals +
    drawdown.lifWithdrawals +
    sumMemberTaxState(memberTaxState, (state) => state.taxableCapitalGains);
  let taxes = sumMemberTaxState(memberTaxState, (state) => state.taxes);
  let oasRecoveryTax = sumMemberTaxState(
    memberTaxState,
    (state) => state.oasRecoveryTax,
  );
  const deathYearFinalReturnAdjustment = estimateDeathYearFinalReturnAdjustment(
    context,
    period,
    memberFrames,
    memberTaxState,
    taxAttributes,
    balances,
  );
  beforeTaxIncome +=
    deathYearFinalReturnAdjustment.taxableIncomeAdjustment;
  taxes += deathYearFinalReturnAdjustment.taxAdjustment;
  oasRecoveryTax += deathYearFinalReturnAdjustment.oasRecoveryTaxAdjustment;
  warnings.push(...deathYearFinalReturnAdjustment.warnings);
  const totalDeathYearFinalReturnTaxAdjustment =
    deathYearFinalReturnAdjustment.taxAdjustment +
    deathYearFinalReturnAdjustment.oasRecoveryTaxAdjustment;
  const afterTaxIncome =
    baseAfterTaxCash +
    incomeTestedBenefits.totalAnnual +
    drawdown.netFromWithdrawals +
    quebecTaxReliefMeasuresCreditApplied -
    totalDeathYearFinalReturnTaxAdjustment;
  const shortfallOrSurplus = afterTaxIncome - requiredCash;

  if (shortfallOrSurplus > 0) {
    const cashReserveSlot = resolveHouseholdCashReserveSlot(memberFrames);
    getAccountLedgerBySlot(balances, cashReserveSlot).cash += shortfallOrSurplus;
  }

  const deathYearProbateSnapshot = estimateDeathYearProbateSnapshot(
    context,
    period,
    memberFrames,
    balances,
  );
  warnings.push(...deathYearProbateSnapshot.warnings);

  applyAnnualGrowth(context, memberFrames, balances);

  const yearWarnings = Array.from(
    new Set([
      ...warnings,
      ...buildYearWarnings(
        context,
        period,
        memberFrames,
        shortfallOrSurplus,
        drawdown.remainingGap,
      ),
    ]),
  );

  return {
    output: {
      calendarYear: period.calendarYear,
      primaryAge: period.primaryAge,
      partnerAge: period.partnerAge,
      employmentIncome: roundCurrency(
        sumMemberFrames(memberFrames, (frame) => frame.employmentIncome),
      ),
      beforeTaxIncome: roundCurrency(beforeTaxIncome),
      afterTaxIncome: roundCurrency(afterTaxIncome),
      spending: roundCurrency(spending),
      totalContributions: roundCurrency(totalContributions),
      oneTimeNetCashFlow: roundCurrency(
        oneTimeCashFlow.inflows - oneTimeCashFlow.outflows,
      ),
      taxes: roundCurrency(taxes),
      oasRecoveryTax: roundCurrency(oasRecoveryTax),
      deathYearFinalReturnTaxAdjustment: roundCurrency(
        totalDeathYearFinalReturnTaxAdjustment,
      ),
      deathYearFinalReturnTaxableIncomeAdjustment: roundCurrency(
        deathYearFinalReturnAdjustment.taxableIncomeAdjustment,
      ),
      deathYearEstimatedProbateBase:
        deathYearProbateSnapshot.probateBaseValue > 0 ||
        deathYearProbateSnapshot.probateExcludedAssets > 0
          ? roundCurrency(deathYearProbateSnapshot.probateBaseValue)
          : undefined,
      deathYearProbateExcludedAssets:
        deathYearProbateSnapshot.probateBaseValue > 0 ||
        deathYearProbateSnapshot.probateExcludedAssets > 0
          ? roundCurrency(deathYearProbateSnapshot.probateExcludedAssets)
          : undefined,
      deathYearEstimatedProbateCost:
        deathYearProbateSnapshot.probateCost === undefined
          ? undefined
          : roundCurrency(deathYearProbateSnapshot.probateCost),
      deathYearEstateProcedure: deathYearProbateSnapshot.estateProcedureLabel,
      federalForeignTaxCredit: roundCurrency(
        sumMemberTaxState(memberTaxState, (state) => state.federalForeignTaxCredit),
      ),
      provincialForeignTaxCredit: roundCurrency(
        sumMemberTaxState(
          memberTaxState,
          (state) => state.provincialForeignTaxCredit,
        ),
      ),
      quebecCareerExtensionCredit: roundCurrency(
        sumMemberTaxState(
          memberTaxState,
          (state) => state.quebecCareerExtensionCredit,
        ),
      ),
      quebecTaxReliefMeasuresCredit: roundCurrency(
        sumMemberTaxState(
          memberTaxState,
          (state) => state.quebecTaxReliefMeasuresCredit,
        ),
      ),
      cppQppIncome: roundCurrency(
        sumMemberFrames(memberFrames, (frame) => frame.cppQppIncome),
      ),
      oasIncome: roundCurrency(sumMemberFrames(memberFrames, (frame) => frame.oasIncome)),
      gisIncome: roundCurrency(incomeTestedBenefits.gisAnnual),
      allowanceIncome: roundCurrency(incomeTestedBenefits.allowanceAnnual),
      allowanceSurvivorIncome: roundCurrency(
        incomeTestedBenefits.allowanceSurvivorAnnual,
      ),
      dbPensionIncome: roundCurrency(
        sumMemberFrames(memberFrames, (frame) => frame.dbPensionIncome),
      ),
      otherPlannedIncome: roundCurrency(
        sumMemberFrames(memberFrames, (frame) => frame.otherPlannedIncome),
      ),
      rrspRrifWithdrawals: roundCurrency(
        mandatoryMinimumWithdrawals.rrifTotal + drawdown.rrspRrifWithdrawals,
      ),
      lifWithdrawals: roundCurrency(
        mandatoryMinimumWithdrawals.lifTotal + drawdown.lifWithdrawals,
      ),
      tfsaWithdrawals: roundCurrency(drawdown.tfsaWithdrawals),
      taxableWithdrawals: roundCurrency(drawdown.taxableWithdrawals),
      realizedCapitalGains: roundCurrency(
        sumMemberTaxState(memberTaxState, (state) => state.realizedCapitalGains),
      ),
      taxableCapitalGains: roundCurrency(
        sumMemberTaxState(memberTaxState, (state) => state.taxableCapitalGains),
      ),
      capitalLossesUsed: roundCurrency(
        sumMemberTaxState(
          memberTaxState,
          (state) => state.netCapitalLossCarryforwardUsed,
        ),
      ),
      netCapitalLossCarryforward: roundCurrency(
        sumMemberTaxState(
          memberTaxState,
          (state) => state.closingNetCapitalLossCarryforward,
        ),
      ),
      cashWithdrawals: roundCurrency(drawdown.cashWithdrawals),
      endOfYearAccountBalances: {
        primary: roundAccountRecord(balances.primary),
        partner: balances.partner ? roundAccountRecord(balances.partner) : undefined,
      },
      shortfallOrSurplus: roundCurrency(shortfallOrSurplus),
      warnings: yearWarnings,
    },
    nextBalances: balances,
    nextTaxAttributes: buildNextHouseholdTaxAttributeLedger(
      memberTaxState,
      openingTaxAttributes,
    ),
    nextIncomeTestedBenefitAssessableIncomeState:
      buildNextIncomeTestedBenefitAssessableIncomeState(
        period,
        memberFrames,
        memberTaxState,
      ),
  };
}

function initializeHouseholdLedger(input: SimulationInput): HouseholdLedger {
  return {
    primary: toAccountLedger(input.household.primary),
    partner: input.household.partner ? toAccountLedger(input.household.partner) : undefined,
  };
}

function initializeHouseholdTaxAttributeLedger(
  input: SimulationInput,
): HouseholdTaxAttributeLedger {
  return {
    primary: {
      netCapitalLossCarryforward:
        input.household.primary.taxableAccountTaxProfile
          ?.initialNetCapitalLossCarryforward ?? 0,
    },
    partner: input.household.partner
      ? {
          netCapitalLossCarryforward:
            input.household.partner.taxableAccountTaxProfile
              ?.initialNetCapitalLossCarryforward ?? 0,
        }
      : undefined,
  };
}

function initializeIncomeTestedBenefitAssessableIncomeState(
  input: SimulationInput,
): IncomeTestedBenefitAssessableIncomeState | undefined {
  const baseIncome = input.household.incomeTestedBenefitsBaseIncome;

  if (
    baseIncome?.primaryAssessableIncome === undefined &&
    baseIncome?.partnerAssessableIncome === undefined &&
    baseIncome?.combinedAssessableIncome === undefined
  ) {
    return undefined;
  }

  const primaryAssessableIncome = Math.max(
    0,
    baseIncome?.primaryAssessableIncome ?? 0,
  );
  const partnerAssessableIncome = input.household.partner
    ? Math.max(0, baseIncome?.partnerAssessableIncome ?? 0)
    : undefined;
  const combinedAssessableIncome = Math.max(
    0,
    baseIncome?.combinedAssessableIncome ??
      (primaryAssessableIncome + (partnerAssessableIncome ?? 0)),
  );

  return {
    calendarYear: baseIncome?.calendarYear ?? input.household.projectionStartYear - 1,
    primaryAssessableIncome,
    partnerAssessableIncome,
    combinedAssessableIncome,
    seededFromInput: true,
  };
}

function resolveMemberYearFraction(
  member: HouseholdMemberInput,
  age: number,
  enableDeathYearProration: boolean,
): number {
  if (age > member.profile.lifeExpectancy) {
    return 0;
  }

  if (enableDeathYearProration && age === member.profile.lifeExpectancy) {
    return 0.5;
  }

  return 1;
}

function buildMemberFrames(
  context: NormalizedContext,
  period: PeriodState,
): MemberFrame[] {
  const yearsFromStart =
    period.calendarYear - context.input.household.projectionStartYear;

  return getMemberEntries(context.input).map(({ slot, member }) => {
    const age = slot === "primary" ? period.primaryAge : period.partnerAge ?? 0;
    const yearFraction = resolveMemberYearFraction(
      member,
      age,
      context.input.household.householdType !== "single",
    );
    const isAlive = yearFraction > 0;
    const deathOccursThisYear = yearFraction > 0 && yearFraction < 1;
    const isRetired = age >= member.profile.retirementAge;
    const employmentIncome =
      estimateEmploymentIncome(member, age, yearsFromStart) * yearFraction;
    const annuityIncome =
      estimateScheduledCashFlowTotal(member.annuityIncome, age) * yearFraction;
    const rentalIncome =
      estimateScheduledCashFlowTotal(member.rentalIncome, age) * yearFraction;
    const foreignPensionIncome =
      estimateScheduledCashFlowTotal(member.foreignPensionIncome, age) * yearFraction;
    const taxableInterestIncome =
      (member.taxableAccountTaxProfile?.annualInterestIncome ?? 0) * yearFraction;
    const eligibleDividendIncome =
      (member.taxableAccountTaxProfile?.annualEligibleDividendIncome ?? 0) *
      yearFraction;
    const nonEligibleDividendIncome =
      (member.taxableAccountTaxProfile?.annualNonEligibleDividendIncome ?? 0) *
      yearFraction;
    const foreignDividendIncome =
      (member.taxableAccountTaxProfile?.annualForeignDividendIncome ?? 0) *
      yearFraction;
    const foreignNonBusinessIncomeTaxPaid =
      (member.taxableAccountTaxProfile?.annualForeignNonBusinessIncomeTaxPaid ?? 0) *
      yearFraction;
    const returnOfCapitalDistribution =
      (member.taxableAccountTaxProfile?.annualReturnOfCapitalDistribution ?? 0) *
      yearFraction;

    return {
      slot,
      member,
      age,
      province: member.profile.provinceAtRetirement,
      isAlive,
      deathOccursThisYear,
      yearFraction,
      isRetired,
      employmentIncome,
      rrspContribution: estimateContribution(
        member.contributions.rrsp,
        member.contributions.contributionEscalationRate,
        yearsFromStart,
        isAlive && !isRetired,
      ) * yearFraction,
      tfsaContribution: estimateContribution(
        member.contributions.tfsa,
        member.contributions.contributionEscalationRate,
        yearsFromStart,
        isAlive && !isRetired,
      ) * yearFraction,
      nonRegisteredContribution: estimateContribution(
        member.contributions.nonRegistered,
        member.contributions.contributionEscalationRate,
        yearsFromStart,
        isAlive && !isRetired,
      ) * yearFraction,
      cppQppIncome: estimateCppOrQppIncome(context, member, age, isAlive) * yearFraction,
      oasIncome:
        estimateOasIncome(context, member, age, isAlive, period.calendarYear) *
        yearFraction,
      dbPensionIncome: estimateDbPensionIncome(member, age, isAlive) * yearFraction,
      annuityIncome,
      rentalIncome,
      foreignPensionIncome,
      taxableInterestIncome,
      eligibleDividendIncome,
      nonEligibleDividendIncome,
      foreignDividendIncome,
      foreignNonBusinessIncomeTaxPaid,
      returnOfCapitalDistribution,
      deemedCapitalGainFromReturnOfCapital: 0,
      taxableCapitalGainFromReturnOfCapital: 0,
      otherPlannedIncome: estimateOtherPlannedIncome(member, age, isAlive) * yearFraction,
    };
  });
}

function applySurvivorAdjustments(
  context: NormalizedContext,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
  warnings: string[],
): void {
  const livingFrames = memberFrames.filter((frame) => frame.isAlive);
  const deceasedFrames = memberFrames.filter((frame) => !frame.isAlive);

  if (livingFrames.length !== 1 || deceasedFrames.length !== 1) {
    return;
  }

  const survivor = livingFrames[0];
  const deceased = deceasedFrames[0];
  const deceasedAccount = getAccountLedgerBySlot(balances, deceased.slot);
  const survivorAccount = getAccountLedgerBySlot(balances, survivor.slot);
  let transferredBalance = 0;
  let transferredEstateDesignatedRegisteredBalance = 0;
  let transferredSpousalDesignatedRegisteredBalance = 0;
  let removedForOtherBeneficiariesBalance = 0;

  for (const accountKey of [
    "rrsp",
    "rrif",
    "tfsa",
    "lira",
    "lif",
    "dcPension",
  ] as const) {
    const balance = deceasedAccount[accountKey];

    if (balance <= 0.01) {
      continue;
    }

    const designation = resolveBeneficiaryDesignation(
      deceased.member,
      accountKey,
      true,
      warnings,
    );

    if (designation === "other-beneficiary") {
      deceasedAccount[accountKey] = 0;
      removedForOtherBeneficiariesBalance += balance;
      warnings.push(
        `${labelForSlot(
          deceased.slot,
        )}'s ${accountKey} balance of ${roundCurrency(
          balance,
        )} was removed from the surviving household because it is marked for another direct beneficiary outside the estate.`,
      );
      continue;
    }

    survivorAccount[accountKey] += balance;
    deceasedAccount[accountKey] = 0;
    transferredBalance += balance;

    if (designation === "spouse") {
      transferredSpousalDesignatedRegisteredBalance += balance;
    } else {
      transferredEstateDesignatedRegisteredBalance += balance;
    }
  }

  const estateRoutedNonRegisteredAndCash =
    deceasedAccount.nonRegistered + deceasedAccount.cash;

  if (deceasedAccount.nonRegistered > 0.01 || deceasedAccount.cash > 0.01) {
    survivorAccount.nonRegistered += deceasedAccount.nonRegistered;
    survivorAccount.nonRegisteredCostBase += deceasedAccount.nonRegisteredCostBase;
    survivorAccount.cash += deceasedAccount.cash;
    transferredBalance += deceasedAccount.nonRegistered + deceasedAccount.cash;
    deceasedAccount.nonRegistered = 0;
    deceasedAccount.nonRegisteredCostBase = 0;
    deceasedAccount.cash = 0;
  }

  if (transferredBalance > 0.01) {
    warnings.push(
      `Baseline survivor rollover moved ${roundCurrency(
        transferredBalance,
      )} of modeled assets from ${labelForSlot(
        deceased.slot,
      ).toLowerCase()} to ${labelForSlot(survivor.slot).toLowerCase()}.`,
    );
  }

  if (transferredSpousalDesignatedRegisteredBalance > 0.01) {
    warnings.push(
      `Registered assets designated directly to the spouse were continued inside the surviving household for ${roundCurrency(
        transferredSpousalDesignatedRegisteredBalance,
      )}.`,
    );
  }

  if (
    transferredEstateDesignatedRegisteredBalance > 0.01 ||
    estateRoutedNonRegisteredAndCash > 0.01
  ) {
    warnings.push(
      "Assets still marked to the estate are currently routed to the surviving spouse as a baseline will/intestacy assumption. More exact estate-beneficiary flow remains a separate roadmap item.",
    );
  }

  if (removedForOtherBeneficiariesBalance > 0.01) {
    warnings.push(
      `Direct-beneficiary designations removed ${roundCurrency(
        removedForOtherBeneficiariesBalance,
      )} from the surviving household because those assets were assumed to pass outside the estate to another beneficiary.`,
    );
  }

  const survivorContinuationIncome = estimateDbSurvivorContinuationIncome(
    deceased.member,
    deceased.age,
  );

  if (survivorContinuationIncome > 0) {
    survivor.otherPlannedIncome += survivorContinuationIncome;
    warnings.push(
      `Defined benefit survivor continuation of ${roundCurrency(
        survivorContinuationIncome,
      )} was applied for ${labelForSlot(survivor.slot).toLowerCase()}.`,
    );
  }

  const survivorPublicPensionIncome = estimatePublicPensionSurvivorIncome(
    context,
    survivor,
    deceased,
    warnings,
  );

  if (survivorPublicPensionIncome > 0) {
    survivor.otherPlannedIncome += survivorPublicPensionIncome;
  }
}

function applyDeathYearSurvivorBenefitAdjustments(
  context: NormalizedContext,
  memberFrames: MemberFrame[],
  warnings: string[],
): void {
  const deathYearFrames = memberFrames.filter((frame) => frame.deathOccursThisYear);

  if (deathYearFrames.length !== 1 || memberFrames.length < 2) {
    return;
  }

  const deceased = deathYearFrames[0];
  const survivor = memberFrames.find(
    (frame) => frame.slot !== deceased.slot && frame.isAlive,
  );

  if (!survivor) {
    return;
  }

  const deathYearSurvivorIncome = estimatePublicPensionSurvivorIncome(
    context,
    survivor,
    deceased,
    warnings,
    0.5,
    "death year",
  );

  if (deathYearSurvivorIncome > 0) {
    survivor.otherPlannedIncome += deathYearSurvivorIncome;
    warnings.push(
      "Death-year survivor public pension is being approximated as a half-year amount because survivor benefits are assumed to start in the month after death under the mid-year death heuristic.",
    );
  }
}

function applyAnnualTaxableAccountDistributions(
  context: NormalizedContext,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
  warnings: string[],
): void {
  for (const frame of memberFrames) {
    if (!frame.isAlive) {
      continue;
    }

    const returnOfCapitalDistribution = Math.max(
      0,
      frame.returnOfCapitalDistribution,
    );

    if (returnOfCapitalDistribution <= 0) {
      continue;
    }

    const account = getAccountLedgerBySlot(balances, frame.slot);
    const marketValueReduction = Math.min(
      account.nonRegistered,
      returnOfCapitalDistribution,
    );
    const openingCostBase = account.nonRegisteredCostBase;
    const costBaseReduction = Math.min(
      openingCostBase,
      returnOfCapitalDistribution,
    );
    const deemedCapitalGain = Math.max(
      0,
      returnOfCapitalDistribution - openingCostBase,
    );

    account.nonRegistered = Math.max(
      0,
      account.nonRegistered - marketValueReduction,
    );
    account.nonRegisteredCostBase = Math.max(
      0,
      openingCostBase - costBaseReduction,
    );
    frame.deemedCapitalGainFromReturnOfCapital = deemedCapitalGain;
    frame.taxableCapitalGainFromReturnOfCapital =
      deemedCapitalGain * context.rules.taxableAccounts.capitalGainsInclusionRate;

    if (costBaseReduction > 0) {
      warnings.push(
        `Return of capital reduced ${labelForSlot(
          frame.slot,
        ).toLowerCase()}'s non-registered adjusted cost base by ${roundCurrency(
          costBaseReduction,
        )}.`,
      );
    }

    if (marketValueReduction > 0) {
      warnings.push(
        `Return of capital also reduced ${labelForSlot(
          frame.slot,
        ).toLowerCase()}'s modeled non-registered market value by ${roundCurrency(
          marketValueReduction,
        )}.`,
      );
    }

    if (marketValueReduction < returnOfCapitalDistribution) {
      warnings.push(
        "Return-of-capital cash entered for the year exceeded the modeled opening non-registered market value. Review the account balance or distribution input for consistency.",
      );
    }

    if (deemedCapitalGain > 0) {
      warnings.push(
        `Return of capital exceeded the remaining adjusted cost base, so ${roundCurrency(
          deemedCapitalGain,
        )} was treated as a deemed capital gain for ${labelForSlot(
          frame.slot,
        ).toLowerCase()}.`,
      );
    }
  }
}

function applyMandatoryConversions(
  context: NormalizedContext,
  period: PeriodState,
  balances: HouseholdLedger,
  warnings: string[],
): void {
  for (const entry of getMemberEntries(context.input)) {
    const age = entry.slot === "primary" ? period.primaryAge : period.partnerAge;
    if (age === undefined) {
      continue;
    }

    const account = getAccountLedgerBySlot(balances, entry.slot);

    if (age === 71 && account.rrsp > 0) {
      warnings.push(
        "RRSP to RRIF conversion is required by the end of age 71 for any remaining RRSP assets.",
      );
    }

    if (age >= 72 && account.rrsp > 0) {
      account.rrif += account.rrsp;
      account.rrsp = 0;
      warnings.push(
        "RRSP assets were treated as converted to RRIF once the modeled age was 72 or older.",
      );
    }
  }
}

function applyLockedInConversions(
  context: NormalizedContext,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
  warnings: string[],
): void {
  for (const frame of memberFrames) {
    if (!frame.isAlive) {
      continue;
    }

    const account = getAccountLedgerBySlot(balances, frame.slot);
    if (account.lira <= 0) {
      continue;
    }

    const policy = resolveLockedInAccountPolicy(frame.member);
    const jurisdictionRule =
      policy &&
      context.rules.lockedIn.jurisdictions[policy.jurisdiction];

    const plannedConversionAge = Math.max(
      policy?.plannedConversionAge ?? frame.member.profile.retirementAge,
      jurisdictionRule?.earliestConversionAge ?? 0,
    );

    if (frame.age < plannedConversionAge) {
      continue;
    }

    account.lif += account.lira;
    account.lira = 0;
    warnings.push(
      `${getLockedInIncomeAccountLabel(policy)} conversion was applied once the modeled age reached ${plannedConversionAge}.`,
    );
  }
}

function buildLockedInAnnualLimits(
  context: NormalizedContext,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
  warnings: string[],
): Partial<Record<MemberSlot, LockedInAnnualLimitState>> {
  const limits: Partial<Record<MemberSlot, LockedInAnnualLimitState>> = {};
  const assumedReturnRate =
    context.input.household.postRetirementReturnRate -
    (context.input.household.annualFeeRate ?? 0);

  for (const frame of memberFrames) {
    if (!frame.isAlive) {
      continue;
    }

    const account = getAccountLedgerBySlot(balances, frame.slot);
    if (account.lif <= 0) {
      continue;
    }

    const policy = resolveLockedInAccountPolicy(frame.member);
    const inferredPolicy = !frame.member.lockedInAccountPolicy;
    const jurisdictionRule =
      policy &&
      context.rules.lockedIn.jurisdictions[policy.jurisdiction];
    const incomeAccountLabel = getLockedInIncomeAccountLabel(policy);
    const minimumWithdrawal = Math.min(
      account.lif,
      Math.max(
        0,
        policy?.manualMinimumAnnualWithdrawal ??
          account.lif * getRrifMinimumFactor(context.rules, frame.age),
      ),
    );
    let maximumWithdrawal =
      policy?.manualMaximumAnnualWithdrawal ??
      inferLockedInMaximumWithdrawal(
        account.lif,
        frame.age,
        jurisdictionRule,
        policy?.assumedPreviousYearReturnRate ?? assumedReturnRate,
      );

    if (policy?.jurisdiction === "QC" && policy.manualMaximumAnnualWithdrawal === undefined) {
      maximumWithdrawal = buildQuebecFrvMaximumWithdrawal(
        frame,
        account.lif,
        minimumWithdrawal,
        policy!,
        jurisdictionRule,
        warnings,
      );
    }

    if (maximumWithdrawal < minimumWithdrawal) {
      maximumWithdrawal = minimumWithdrawal;
      warnings.push(
        `${incomeAccountLabel} maximum withdrawal was raised to the modeled minimum because the provided cap was lower than the minimum withdrawal.`,
      );
    }

    if (inferredPolicy) {
      warnings.push(
        `Locked-in jurisdiction was inferred as ${policy?.jurisdiction ?? frame.province}. Add a lockedInAccountPolicy input for auditability.`,
      );
    }

    if (policy?.manualMaximumAnnualWithdrawal === undefined) {
      warnings.push(
        `${incomeAccountLabel} maximum withdrawal is using a rules-based fallback estimate. Replace it with the institution-calculated annual maximum when available.`,
      );
    }

    limits[frame.slot] = {
      jurisdiction: policy?.jurisdiction ?? frame.province,
      incomeAccountLabel,
      openingLifBalance: account.lif,
      minimumWithdrawal,
      maximumWithdrawal,
      withdrawnSoFar: 0,
    };
  }

  return limits;
}

function buildQuebecFrvMaximumWithdrawal(
  frame: MemberFrame,
  openingLifBalance: number,
  minimumWithdrawal: number,
  policy: NonNullable<HouseholdMemberInput["lockedInAccountPolicy"]>,
  jurisdictionRule:
    | CanadaRuleSet["lockedIn"]["jurisdictions"][keyof CanadaRuleSet["lockedIn"]["jurisdictions"]]
    | undefined,
  warnings: string[],
): number {
  if (
    jurisdictionRule?.noMaximumWithdrawalAge !== undefined &&
    frame.age >= jurisdictionRule.noMaximumWithdrawalAge
  ) {
    warnings.push(
      "Quebec FRV withdrawals are being modeled under the 2025+ rule set with no statutory annual maximum at age 55 or older. Temporary-income and institution-specific processing are still not separately modeled.",
    );
    return openingLifBalance;
  }

  const prescribedRate = Math.max(
    0,
    jurisdictionRule?.underNoMaximumAgePrescribedRate ?? 0,
  );
  const prescribedRateMaximum = Math.min(
    openingLifBalance,
    openingLifBalance * prescribedRate,
  );

  if (policy?.quebecTemporaryIncomeRequested !== true) {
    warnings.push(
      "Quebec FRV under-age-55 maximum is being modeled without a temporary-income election. Enable the quebecTemporaryIncomeRequested input if the user plans to request annual temporary income.",
    );
    return Math.max(minimumWithdrawal, prescribedRateMaximum);
  }

  if (policy.quebecTemporaryIncomeOptionOffered === false) {
    warnings.push(
      "Quebec FRV temporary income was requested, but the policy input says this contract does not offer the temporary-income option. Only baseline life-income limits were modeled.",
    );
    return Math.max(minimumWithdrawal, prescribedRateMaximum);
  }

  if (policy.quebecTemporaryIncomeNoOtherFrvConfirmed === false) {
    warnings.push(
      "Quebec FRV temporary income was requested, but another FRV was also indicated. The official declaration requires no other FRV, so only baseline life-income limits were modeled.",
    );
    return Math.max(minimumWithdrawal, prescribedRateMaximum);
  }

  if (jurisdictionRule?.temporaryIncomeMaximumAnnual === undefined) {
    warnings.push(
      "Quebec FRV temporary-income base amounts were unavailable in the current rule set. Manual annual maximum input is strongly recommended for younger Quebec cases.",
    );
    return Math.max(minimumWithdrawal, prescribedRateMaximum);
  }

  const estimatedOtherIncome =
    policy.quebecTemporaryIncomeEstimatedOtherIncome ??
    estimateQuebecTemporaryIncomeOtherIncomeProxy(frame);
  const temporaryIncomeOffsetRate =
    jurisdictionRule.temporaryIncomeEstimatedIncomeOffsetRate ?? 1;
  const temporaryIncomeMaximum = Math.max(
    0,
    jurisdictionRule.temporaryIncomeMaximumAnnual -
      estimatedOtherIncome * temporaryIncomeOffsetRate,
  );
  const totalMaximum = Math.max(prescribedRateMaximum, temporaryIncomeMaximum);

  if (policy.quebecTemporaryIncomeEstimatedOtherIncome === undefined) {
    warnings.push(
      "Quebec FRV temporary income used a baseline proxy for the next-12-month 'other income' declaration. Employment, public pensions, DB pension, annuity, rental, foreign pension, and recurring taxable-account cash flows were included, but registered-plan withdrawals, social assistance, disability income, and institution-specific adjustments still need user review.",
    );
  }

  if (
    policy.quebecTemporaryIncomeOptionOffered === undefined ||
    policy.quebecTemporaryIncomeNoOtherFrvConfirmed === undefined
  ) {
    warnings.push(
      "Quebec FRV temporary income is assuming the contract offers the option and that no other FRV exists for the declaration year unless the user states otherwise.",
    );
  }

  warnings.push(
    `Quebec FRV under-age-55 maximum uses a start-of-year temporary-income election approximation. Estimated other income was ${roundCurrency(
      estimatedOtherIncome,
    )}, the temporary-income ceiling was ${roundCurrency(
      temporaryIncomeMaximum,
    )}, and the prescribed-rate life-income ceiling was ${roundCurrency(
      prescribedRateMaximum,
    )}.`,
  );

  return Math.min(openingLifBalance, Math.max(minimumWithdrawal, totalMaximum));
}

function applyMandatoryMinimumWithdrawals(
  context: NormalizedContext,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
  lockedInAnnualLimits: Partial<Record<MemberSlot, LockedInAnnualLimitState>>,
  warnings: string[],
): MandatoryMinimumWithdrawalResult {
  let totalMandatoryWithdrawal = 0;
  let totalRrifWithdrawal = 0;
  let totalLifWithdrawal = 0;
  const rrifBySlot: Partial<Record<MemberSlot, number>> = {};
  const lifBySlot: Partial<Record<MemberSlot, number>> = {};

  for (const frame of memberFrames) {
    if (!frame.isAlive) {
      continue;
    }

    const account = getAccountLedgerBySlot(balances, frame.slot);
    const deathYearProrationFactor = frame.deathOccursThisYear ? 0.5 : 1;

    if (frame.age >= 71 && account.rrif > 0) {
      const factor = getRrifMinimumFactor(context.rules, frame.age);
      const minimumWithdrawal = Math.min(
        account.rrif,
        account.rrif * factor * deathYearProrationFactor,
      );

      if (minimumWithdrawal > 0) {
        account.rrif -= minimumWithdrawal;
        totalMandatoryWithdrawal += minimumWithdrawal;
        totalRrifWithdrawal += minimumWithdrawal;
        rrifBySlot[frame.slot] = (rrifBySlot[frame.slot] ?? 0) + minimumWithdrawal;
        warnings.push(
          "RRIF minimum withdrawal was applied for an eligible household member.",
        );
      }
    }

    const lockedInLimit = lockedInAnnualLimits[frame.slot];
    if (!lockedInLimit || account.lif <= 0) {
      continue;
    }

    const lifMinimumWithdrawal = Math.min(
      account.lif,
      lockedInLimit.minimumWithdrawal * deathYearProrationFactor,
      lockedInLimit.maximumWithdrawal,
    );

    if (lifMinimumWithdrawal > 0) {
      account.lif -= lifMinimumWithdrawal;
      lockedInLimit.withdrawnSoFar += lifMinimumWithdrawal;
      totalMandatoryWithdrawal += lifMinimumWithdrawal;
      totalLifWithdrawal += lifMinimumWithdrawal;
      lifBySlot[frame.slot] = (lifBySlot[frame.slot] ?? 0) + lifMinimumWithdrawal;
      warnings.push(
        `${lockedInLimit.incomeAccountLabel} minimum withdrawal was applied for an eligible household member.`,
      );
    }
  }

  return {
    rrifBySlot,
    lifBySlot,
    rrifTotal: totalRrifWithdrawal,
    lifTotal: totalLifWithdrawal,
    total: totalMandatoryWithdrawal,
  };
}

function buildBaseTaxState(
  context: NormalizedContext,
  period: PeriodState,
  memberFrames: MemberFrame[],
  mandatoryMinimumWithdrawals: MandatoryMinimumWithdrawalResult,
  taxAttributes: HouseholdTaxAttributeLedger,
): Partial<Record<MemberSlot, MemberTaxState>> {
  const state: Partial<Record<MemberSlot, MemberTaxState>> = {};

  for (const frame of memberFrames) {
    const rrifShare = mandatoryMinimumWithdrawals.rrifBySlot[frame.slot] ?? 0;
    const lifShare = mandatoryMinimumWithdrawals.lifBySlot[frame.slot] ?? 0;
    const ordinaryTaxableIncome = Math.max(
      0,
      frame.employmentIncome +
        frame.cppQppIncome +
        frame.oasIncome +
        frame.dbPensionIncome +
        resolveBaseOrdinaryPlannedIncome(frame) +
        resolveTaxableDividendIncome(frame) +
        frame.taxableCapitalGainFromReturnOfCapital +
        lifShare +
        rrifShare -
        frame.rrspContribution,
    );

    state[frame.slot] = {
      eligibleWorkIncome: Math.max(0, frame.employmentIncome),
      ordinaryTaxableIncome,
      grossTaxableCapitalGains: frame.taxableCapitalGainFromReturnOfCapital,
      allowableCapitalLossesCurrentYear: 0,
      openingNetCapitalLossCarryforward:
        getTaxAttributeLedgerBySlot(taxAttributes, frame.slot)
          .netCapitalLossCarryforward,
      netCapitalLossCarryforwardUsed: 0,
      closingNetCapitalLossCarryforward:
        getTaxAttributeLedgerBySlot(taxAttributes, frame.slot)
          .netCapitalLossCarryforward,
      taxableIncome: ordinaryTaxableIncome,
      taxes: 0,
      oasRecoveryTax: 0,
      federalForeignTaxCredit: 0,
      provincialForeignTaxCredit: 0,
      quebecCareerExtensionCredit: 0,
      quebecTaxReliefMeasuresCredit: 0,
      marginalRate: 0,
      province: frame.province,
      oasIncome: frame.oasIncome,
      age: frame.age,
      livesAloneForTaxYear: frame.member.profile.livesAloneForTaxYear === true,
      eligiblePensionIncome: estimateEligiblePensionIncome(
        frame,
        rrifShare,
        lifShare,
      ),
      pensionIncomeSplitIn: 0,
      pensionIncomeSplitOut: 0,
      eligibleDividendIncome: frame.eligibleDividendIncome,
      nonEligibleDividendIncome: frame.nonEligibleDividendIncome,
      foreignNonBusinessIncome:
        frame.foreignDividendIncome + frame.foreignPensionIncome,
      foreignNonBusinessIncomeTaxPaid: frame.foreignNonBusinessIncomeTaxPaid,
      realizedCapitalGains: frame.deemedCapitalGainFromReturnOfCapital,
      taxableCapitalGains: frame.taxableCapitalGainFromReturnOfCapital,
      warnings: [],
    };
  }

  const optimizedState = applyPensionIncomeSplittingHeuristic(
    context,
    period.calendarYear,
    state,
  );

  return finalizeMemberTaxState(context, period.calendarYear, optimizedState);
}

function resolveDrawdownAndIncomeTestedBenefits(
  context: NormalizedContext,
  period: PeriodState,
  memberFrames: MemberFrame[],
  baseBalances: HouseholdLedger,
  baseTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  lockedInAnnualLimits: Partial<Record<MemberSlot, LockedInAnnualLimitState>>,
  incomeTestedBenefitAssessableIncomeState: IncomeTestedBenefitAssessableIncomeState | undefined,
  baseAfterTaxCash: number,
  requiredCash: number,
): {
  balances: HouseholdLedger;
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>;
  drawdown: DrawdownResult;
  incomeTestedBenefits: IncomeTestedBenefitProjection;
} {
  let finalBalances = cloneHouseholdLedger(baseBalances);
  let finalTaxState = cloneMemberTaxState(baseTaxState);
  let finalDrawdown = createEmptyDrawdownResult();
  let finalBenefitProjection = createEmptyIncomeTestedBenefitProjection();
  let estimatedBenefitCash = 0;

  const hasPriorYearAssessableIncome =
    incomeTestedBenefitAssessableIncomeState !== undefined;

  if (context.input.household.gisModelingEnabled && hasPriorYearAssessableIncome) {
    finalBenefitProjection = estimateIncomeTestedBenefits(
      context,
      period.calendarYear,
      memberFrames,
      baseTaxState,
      incomeTestedBenefitAssessableIncomeState,
      false,
    );
    estimatedBenefitCash = finalBenefitProjection.totalAnnual;
    const workingBalances = cloneHouseholdLedger(baseBalances);
    const workingTaxState = cloneMemberTaxState(baseTaxState);
    const workingLockedInAnnualLimits = cloneLockedInAnnualLimits(lockedInAnnualLimits);
    const gap = Math.max(0, requiredCash - (baseAfterTaxCash + estimatedBenefitCash));
    finalDrawdown = executeDrawdown(
      context,
      period,
      memberFrames,
      workingBalances,
      workingTaxState,
      workingLockedInAnnualLimits,
      gap,
    );
    finalBalances = workingBalances;
    finalTaxState = workingTaxState;
  } else {
    let fallbackEstimatedBenefitCash = 0;
    const iterationCount = context.input.household.gisModelingEnabled ? 2 : 1;

    for (let iteration = 0; iteration < iterationCount; iteration += 1) {
      const workingBalances = cloneHouseholdLedger(baseBalances);
      const workingTaxState = cloneMemberTaxState(baseTaxState);
      const workingLockedInAnnualLimits = cloneLockedInAnnualLimits(
        lockedInAnnualLimits,
      );
      const gap = Math.max(
        0,
        requiredCash - (baseAfterTaxCash + fallbackEstimatedBenefitCash),
      );
      const drawdown = executeDrawdown(
        context,
        period,
        memberFrames,
        workingBalances,
        workingTaxState,
        workingLockedInAnnualLimits,
        gap,
      );
      const incomeTestedBenefits = context.input.household.gisModelingEnabled
        ? estimateIncomeTestedBenefits(
            context,
            period.calendarYear,
            memberFrames,
            workingTaxState,
            undefined,
            true,
          )
        : createEmptyIncomeTestedBenefitProjection();

      finalBalances = workingBalances;
      finalTaxState = workingTaxState;
      finalDrawdown = drawdown;
      finalBenefitProjection = incomeTestedBenefits;

      if (
        !context.input.household.gisModelingEnabled ||
        Math.abs(incomeTestedBenefits.totalAnnual - fallbackEstimatedBenefitCash) < 1
      ) {
        break;
      }

      fallbackEstimatedBenefitCash = incomeTestedBenefits.totalAnnual;
    }
  }

  return {
    balances: finalBalances,
    memberTaxState: finalTaxState,
    drawdown: finalDrawdown,
    incomeTestedBenefits: finalBenefitProjection,
  };
}

function estimateIncomeTestedBenefits(
  context: NormalizedContext,
  calendarYear: number,
  memberFrames: MemberFrame[],
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  priorYearAssessableIncomeState: IncomeTestedBenefitAssessableIncomeState | undefined,
  usingCurrentYearFallback: boolean,
): IncomeTestedBenefitProjection {
  const annualizedOasBenefits = resolveAnnualizedOasBenefitValues(
    context.rules,
    calendarYear,
  );
  const warnings = [
    "GIS / Allowance baseline still uses a linear taper and does not fully replicate Service Canada's top-up or monthly reassessment mechanics.",
    "GIS / Allowance baseline applies the work-income exemption to modeled employment income only and does not yet capture every line-23600 adjustment.",
  ];
  if (annualizedOasBenefits.usedQuarterlyBenefitPeriods) {
    warnings.unshift(
      `GIS / Allowance for ${calendarYear} is annualizing the published quarterly OAS tables across the calendar year rather than using a single flat monthly maximum.`,
    );
  }
  if (annualizedOasBenefits.usedFallbackLatestValues) {
    warnings.push(
      `Some later quarters in ${calendarYear} were not yet loaded in the rules data, so GIS / Allowance annualization fell back to the latest published quarter for those months.`,
    );
  }
  if (usingCurrentYearFallback) {
    warnings.unshift(
      "GIS / Allowance first-year baseline is using a current-year income proxy because no prior-year assessable-income seed was supplied. Add household.incomeTestedBenefitsBaseIncome when you want the first projection year to reflect the actual prior tax year.",
    );
  } else {
    const sourceYear = priorYearAssessableIncomeState?.calendarYear;
    warnings.unshift(
      `GIS / Allowance baseline is using prior-year assessable income from ${sourceYear ?? "the prior calendar year"}, which is closer to Service Canada's normal July-to-June payment logic.`,
    );
    if (priorYearAssessableIncomeState?.seededFromInput) {
      warnings.push(
        "The first projection year is using a user-supplied prior-year GIS / Allowance income seed rather than inferring that value from the current simulation year.",
      );
    }
  }
  const livingFrames = memberFrames.filter((frame) => frame.isAlive);

  if (livingFrames.length === 0) {
    return createEmptyIncomeTestedBenefitProjection();
  }

  const assessableIncomeBySlot: Partial<Record<MemberSlot, number>> = {};

  for (const frame of livingFrames) {
    const state = memberTaxState[frame.slot];

    if (!state) {
      continue;
    }

    assessableIncomeBySlot[frame.slot] = usingCurrentYearFallback
      ? resolveIncomeTestedBenefitAssessableIncome(frame, state)
      : resolvePriorYearAssessableIncomeBySlot(
          frame.slot,
          priorYearAssessableIncomeState,
        );
  }

  const oasRecipients = livingFrames.filter(
    (frame) => frame.age >= 65 && frame.oasIncome > 0,
  );
  let gisAnnual = 0;
  let allowanceAnnual = 0;
  let allowanceSurvivorAnnual = 0;

  if (livingFrames.length === 1) {
    const frame = livingFrames[0];
    const assessableIncome = assessableIncomeBySlot[frame.slot] ?? 0;

    if (frame.age >= 65 && frame.oasIncome > 0) {
      const singleRule = findAnnualizedGisRule(
        annualizedOasBenefits,
        "single-oas",
      );
      gisAnnual = estimateLinearIncomeTestedBenefitAnnual(
        (singleRule?.monthlyMaximum ?? 0) * 12,
        singleRule?.incomeCutoff ?? 0,
        assessableIncome,
      );
    } else if (
      frame.age >= 60 &&
      frame.age <= 64 &&
      frame.member.publicBenefits.allowanceSurvivorEligible
    ) {
      allowanceSurvivorAnnual = estimateLinearIncomeTestedBenefitAnnual(
        annualizedOasBenefits.allowanceSurvivorMaximumMonthly * 12,
        annualizedOasBenefits.allowanceSurvivorIncomeCutoff,
        assessableIncome,
      );
      warnings.push(
        "Allowance for the Survivor requires an explicit eligibility flag and is not inferred automatically from widowhood timing in the current scaffold.",
      );
    }
  } else {
    const combinedAssessableIncome = usingCurrentYearFallback
      ? livingFrames.reduce(
          (sum, frame) => sum + (assessableIncomeBySlot[frame.slot] ?? 0),
          0,
        )
      : resolvePriorYearCombinedAssessableIncome(
          priorYearAssessableIncomeState,
          livingFrames,
        );
    const partnerWithoutOas = livingFrames.find(
      (frame) => !(frame.age >= 65 && frame.oasIncome > 0),
    );
    const spouseAllowanceEligible = livingFrames.find(
      (frame) => frame.age >= 60 && frame.age <= 64,
    );

    if (oasRecipients.length >= 2) {
      const coupleRule = findAnnualizedGisRule(
        annualizedOasBenefits,
        "spouse-oas",
      );
      const annualPerRecipient = estimateLinearIncomeTestedBenefitAnnual(
        (coupleRule?.monthlyMaximum ?? 0) * 12,
        coupleRule?.incomeCutoff ?? 0,
        combinedAssessableIncome,
      );
      gisAnnual = annualPerRecipient * oasRecipients.length;
    } else if (oasRecipients.length === 1 && spouseAllowanceEligible) {
      const olderSpouseRule = findAnnualizedGisRule(
        annualizedOasBenefits,
        "spouse-allowance",
      );
      gisAnnual = estimateLinearIncomeTestedBenefitAnnual(
        (olderSpouseRule?.monthlyMaximum ?? 0) * 12,
        olderSpouseRule?.incomeCutoff ?? 0,
        combinedAssessableIncome,
      );
      allowanceAnnual = estimateLinearIncomeTestedBenefitAnnual(
        annualizedOasBenefits.allowanceMaximumMonthly * 12,
        annualizedOasBenefits.allowanceIncomeCutoff,
        combinedAssessableIncome,
      );
    } else if (oasRecipients.length === 1 && partnerWithoutOas) {
      const spouseNoOasRule = findAnnualizedGisRule(
        annualizedOasBenefits,
        "spouse-no-oas",
      );
      gisAnnual = estimateLinearIncomeTestedBenefitAnnual(
        (spouseNoOasRule?.monthlyMaximum ?? 0) * 12,
        spouseNoOasRule?.incomeCutoff ?? 0,
        combinedAssessableIncome,
      );
    }
  }

  return {
    gisAnnual: roundCurrency(gisAnnual),
    allowanceAnnual: roundCurrency(allowanceAnnual),
    allowanceSurvivorAnnual: roundCurrency(allowanceSurvivorAnnual),
    totalAnnual: roundCurrency(gisAnnual + allowanceAnnual + allowanceSurvivorAnnual),
    warnings,
  };
}

function buildNextIncomeTestedBenefitAssessableIncomeState(
  period: PeriodState,
  memberFrames: MemberFrame[],
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
): IncomeTestedBenefitAssessableIncomeState {
  const primaryFrame = memberFrames.find((frame) => frame.slot === "primary");
  const partnerFrame = memberFrames.find((frame) => frame.slot === "partner");
  const primaryAssessableIncome =
    primaryFrame && memberTaxState.primary
      ? resolveIncomeTestedBenefitAssessableIncome(
          primaryFrame,
          memberTaxState.primary,
        )
      : 0;
  const partnerAssessableIncome =
    partnerFrame && memberTaxState.partner
      ? resolveIncomeTestedBenefitAssessableIncome(
          partnerFrame,
          memberTaxState.partner,
        )
      : undefined;

  return {
    calendarYear: period.calendarYear,
    primaryAssessableIncome,
    partnerAssessableIncome,
    combinedAssessableIncome:
      primaryAssessableIncome + (partnerAssessableIncome ?? 0),
    seededFromInput: false,
  };
}

function resolvePriorYearAssessableIncomeBySlot(
  slot: MemberSlot,
  priorYearAssessableIncomeState: IncomeTestedBenefitAssessableIncomeState | undefined,
): number {
  if (!priorYearAssessableIncomeState) {
    return 0;
  }

  return slot === "primary"
    ? priorYearAssessableIncomeState.primaryAssessableIncome
    : priorYearAssessableIncomeState.partnerAssessableIncome ?? 0;
}

function resolvePriorYearCombinedAssessableIncome(
  priorYearAssessableIncomeState: IncomeTestedBenefitAssessableIncomeState | undefined,
  _livingFrames: MemberFrame[],
): number {
  if (!priorYearAssessableIncomeState) {
    return 0;
  }

  return priorYearAssessableIncomeState.combinedAssessableIncome;
}

function resolveIncomeTestedBenefitAssessableIncome(
  frame: MemberFrame,
  memberState: MemberTaxState,
): number {
  const taxableIncomeProxy = Math.max(
    0,
    memberState.taxableIncome - memberState.oasIncome,
  );
  const workIncomeExemption = calculateIncomeTestedBenefitWorkExemption(
    frame.employmentIncome,
  );

  return Math.max(0, taxableIncomeProxy - workIncomeExemption);
}

function calculateIncomeTestedBenefitWorkExemption(
  employmentIncome: number,
): number {
  const firstBand = Math.min(Math.max(0, employmentIncome), 5000);
  const secondBand = Math.min(Math.max(0, employmentIncome - 5000), 10000);

  return firstBand + secondBand * 0.5;
}

function estimateLinearIncomeTestedBenefitAnnual(
  maximumAnnual: number,
  incomeCutoff: number,
  assessableIncome: number,
): number {
  if (maximumAnnual <= 0 || incomeCutoff <= 0) {
    return 0;
  }

  return Math.max(0, maximumAnnual * (1 - clampRate(assessableIncome / incomeCutoff)));
}

function findAnnualizedGisRule(
  annualizedOasBenefits: AnnualizedOasBenefitValues,
  householdCase: "single-oas" | "spouse-no-oas" | "spouse-oas" | "spouse-allowance",
) {
  return annualizedOasBenefits.gisMaximums.find(
    (item) => item.householdCase === householdCase,
  );
}

function resolveAnnualizedOasBenefitValues(
  rules: CanadaRuleSet,
  calendarYear: number,
): AnnualizedOasBenefitValues {
  const quarterlyPeriods = rules.oas.quarterlyBenefitPeriods ?? [];

  if (quarterlyPeriods.length === 0) {
    return {
      monthlyMaximums: rules.oas.monthlyMaximums,
      gisMaximums: rules.oas.gisMaximums,
      allowanceMaximumMonthly: rules.oas.allowanceMaximumMonthly,
      allowanceIncomeCutoff: rules.oas.allowanceIncomeCutoff,
      allowanceSurvivorMaximumMonthly: rules.oas.allowanceSurvivorMaximumMonthly,
      allowanceSurvivorIncomeCutoff: rules.oas.allowanceSurvivorIncomeCutoff,
      usedQuarterlyBenefitPeriods: false,
      usedFallbackLatestValues: false,
    };
  }

  let usedFallbackLatestValues = false;
  const ageBands = ["65-74", "75+"] as const;
  const householdCases = [
    "single-oas",
    "spouse-no-oas",
    "spouse-oas",
    "spouse-allowance",
  ] as const;

  const monthlyMaximums = ageBands.map((ageBand) => ({
    ageBand,
    amount: averageAcrossCalendarMonths(calendarYear, (month) => {
      const resolvedPeriod = resolveOasQuarterlyPeriodForMonth(
        rules,
        calendarYear,
        month,
      );
      usedFallbackLatestValues ||= resolvedPeriod.usedFallbackLatestValues;
      return (
        resolvedPeriod.values.monthlyMaximums.find((item) => item.ageBand === ageBand)
          ?.amount ?? 0
      );
    }),
  }));

  const gisMaximums = householdCases.map((householdCase) => {
    let topUpCutoff = 0;
    const monthlyMaximum = averageAcrossCalendarMonths(calendarYear, (month) => {
      const resolvedPeriod = resolveOasQuarterlyPeriodForMonth(
        rules,
        calendarYear,
        month,
      );
      usedFallbackLatestValues ||= resolvedPeriod.usedFallbackLatestValues;
      const rule = resolvedPeriod.values.gisMaximums.find(
        (item) => item.householdCase === householdCase,
      );
      if (rule) {
        topUpCutoff = rule.topUpCutoff;
      }
      return rule?.monthlyMaximum ?? 0;
    });
    const incomeCutoff = averageAcrossCalendarMonths(calendarYear, (month) => {
      const resolvedPeriod = resolveOasQuarterlyPeriodForMonth(
        rules,
        calendarYear,
        month,
      );
      usedFallbackLatestValues ||= resolvedPeriod.usedFallbackLatestValues;
      return (
        resolvedPeriod.values.gisMaximums.find(
          (item) => item.householdCase === householdCase,
        )?.incomeCutoff ?? 0
      );
    });

    return {
      householdCase,
      monthlyMaximum,
      incomeCutoff,
      topUpCutoff,
    };
  });

  const allowanceMaximumMonthly = averageAcrossCalendarMonths(
    calendarYear,
    (month) => {
      const resolvedPeriod = resolveOasQuarterlyPeriodForMonth(
        rules,
        calendarYear,
        month,
      );
      usedFallbackLatestValues ||= resolvedPeriod.usedFallbackLatestValues;
      return resolvedPeriod.values.allowanceMaximumMonthly;
    },
  );
  const allowanceIncomeCutoff = averageAcrossCalendarMonths(
    calendarYear,
    (month) => {
      const resolvedPeriod = resolveOasQuarterlyPeriodForMonth(
        rules,
        calendarYear,
        month,
      );
      usedFallbackLatestValues ||= resolvedPeriod.usedFallbackLatestValues;
      return resolvedPeriod.values.allowanceIncomeCutoff;
    },
  );
  const allowanceSurvivorMaximumMonthly = averageAcrossCalendarMonths(
    calendarYear,
    (month) => {
      const resolvedPeriod = resolveOasQuarterlyPeriodForMonth(
        rules,
        calendarYear,
        month,
      );
      usedFallbackLatestValues ||= resolvedPeriod.usedFallbackLatestValues;
      return resolvedPeriod.values.allowanceSurvivorMaximumMonthly;
    },
  );
  const allowanceSurvivorIncomeCutoff = averageAcrossCalendarMonths(
    calendarYear,
    (month) => {
      const resolvedPeriod = resolveOasQuarterlyPeriodForMonth(
        rules,
        calendarYear,
        month,
      );
      usedFallbackLatestValues ||= resolvedPeriod.usedFallbackLatestValues;
      return resolvedPeriod.values.allowanceSurvivorIncomeCutoff;
    },
  );

  return {
    monthlyMaximums,
    gisMaximums,
    allowanceMaximumMonthly,
    allowanceIncomeCutoff,
    allowanceSurvivorMaximumMonthly,
    allowanceSurvivorIncomeCutoff,
    usedQuarterlyBenefitPeriods: true,
    usedFallbackLatestValues,
  };
}

function averageAcrossCalendarMonths(
  calendarYear: number,
  valueForMonth: (month: number) => number,
): number {
  let total = 0;

  for (let month = 1; month <= 12; month += 1) {
    total += valueForMonth(month);
  }

  return total / 12;
}

function resolveOasQuarterlyPeriodForMonth(
  rules: CanadaRuleSet,
  calendarYear: number,
  month: number,
): {
  values: Pick<
    CanadaRuleSet["oas"],
    | "monthlyMaximums"
    | "gisMaximums"
    | "allowanceMaximumMonthly"
    | "allowanceIncomeCutoff"
    | "allowanceSurvivorMaximumMonthly"
    | "allowanceSurvivorIncomeCutoff"
  >;
  usedFallbackLatestValues: boolean;
} {
  const isoMonth = `${calendarYear}-${String(month).padStart(2, "0")}-01`;
  const quarterlyPeriod = rules.oas.quarterlyBenefitPeriods?.find(
    (period) => period.startDate <= isoMonth && period.endDate >= isoMonth,
  );

  if (quarterlyPeriod) {
    return {
      values: quarterlyPeriod,
      usedFallbackLatestValues: false,
    };
  }

  return {
    values: {
      monthlyMaximums: rules.oas.monthlyMaximums,
      gisMaximums: rules.oas.gisMaximums,
      allowanceMaximumMonthly: rules.oas.allowanceMaximumMonthly,
      allowanceIncomeCutoff: rules.oas.allowanceIncomeCutoff,
      allowanceSurvivorMaximumMonthly: rules.oas.allowanceSurvivorMaximumMonthly,
      allowanceSurvivorIncomeCutoff: rules.oas.allowanceSurvivorIncomeCutoff,
    },
    usedFallbackLatestValues: true,
  };
}

function estimateEligiblePensionIncome(
  frame: MemberFrame,
  mandatoryRrifWithdrawal: number,
  mandatoryLifWithdrawal: number,
): number {
  let eligiblePensionIncome = frame.dbPensionIncome;

  if (frame.age >= 65) {
    eligiblePensionIncome +=
      frame.annuityIncome + mandatoryRrifWithdrawal + mandatoryLifWithdrawal;
  }

  return Math.max(0, eligiblePensionIncome);
}

function finalizeMemberTaxState(
  context: NormalizedContext,
  calendarYear: number,
  state: Partial<Record<MemberSlot, MemberTaxState>>,
): Partial<Record<MemberSlot, MemberTaxState>> {
  const finalizedState = cloneMemberTaxState(state);

  for (const slot of ["primary", "partner"] as const) {
    const memberState = finalizedState[slot];
    if (!memberState) {
      continue;
    }

    refreshMemberTaxState(context, calendarYear, memberState);
  }

  return finalizedState;
}

function applyQuebecTaxReliefMeasures(
  context: NormalizedContext,
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  warnings: string[],
): number {
  const qcEntries = (Object.entries(memberTaxState) as Array<
    [MemberSlot, MemberTaxState | undefined]
  >).filter(([, state]) => state?.province === "QC");

  if (qcEntries.length === 0) {
    return 0;
  }

  const creditRate = 0.14;
  const familyIncomeReductionThreshold = 42090;
  const familyIncomeReductionRate = 0.1875;
  const quebecAgeAmount = 3906;
  const quebecLivingAloneAmount = 2128;
  const quebecRetirementIncomeAmountMax = 3470;

  const familyIncomeProxy = qcEntries.reduce(
    (sum, [, state]) => sum + Math.max(0, state?.taxableIncome ?? 0),
    0,
  );
  const claimBaseBySlot: Partial<Record<MemberSlot, number>> = {};
  let totalClaimBase = 0;

  for (const [slot, state] of qcEntries) {
    if (!state) {
      continue;
    }

    const ageClaimAmount = state.age >= 65 ? quebecAgeAmount : 0;
    const livingAloneClaimAmount = state.livesAloneForTaxYear
      ? quebecLivingAloneAmount
      : 0;
    const retirementIncomeClaimAmount = Math.min(
      quebecRetirementIncomeAmountMax,
      Math.max(0, state.eligiblePensionIncome) * 1.25,
    );
    const claimBase =
      ageClaimAmount + livingAloneClaimAmount + retirementIncomeClaimAmount;

    claimBaseBySlot[slot] = claimBase;
    totalClaimBase += claimBase;
  }

  if (totalClaimBase <= 0) {
    return 0;
  }

  const familyReduction = Math.max(
    0,
    familyIncomeProxy - familyIncomeReductionThreshold,
  );
  const pooledClaimAmount = Math.max(
    0,
    totalClaimBase - familyReduction * familyIncomeReductionRate,
  );

  if (pooledClaimAmount <= 0) {
    return 0;
  }

  let totalCreditApplied = 0;

  for (const [slot, state] of qcEntries) {
    if (!state) {
      continue;
    }

    const claimBase = claimBaseBySlot[slot] ?? 0;

    if (claimBase <= 0) {
      continue;
    }

    const allocatedClaimAmount = pooledClaimAmount * (claimBase / totalClaimBase);
    const creditAmount = allocatedClaimAmount * creditRate;
    const appliedCreditAmount = Math.min(creditAmount, state.taxes);

    state.quebecTaxReliefMeasuresCredit = appliedCreditAmount;
    state.taxes = Math.max(0, state.taxes - appliedCreditAmount);
    totalCreditApplied += appliedCreditAmount;
  }

  warnings.push(
    "Quebec Schedule B age, living-alone, and retirement-income amounts are now modeled with a household-level 2025 schedule approximation when the explicit livesAloneForTaxYear input is supplied. Taxable income is still used as a proxy for line 275 family income.",
  );

  return totalCreditApplied;
}

function refreshMemberTaxState(
  context: NormalizedContext,
  calendarYear: number,
  memberState: MemberTaxState,
): void {
  const currentYearNetCapitalLoss = Math.max(
    0,
    memberState.allowableCapitalLossesCurrentYear -
      memberState.grossTaxableCapitalGains,
  );
  const remainingTaxableCapitalGainsAfterCurrentLosses = Math.max(
    0,
    memberState.grossTaxableCapitalGains -
      memberState.allowableCapitalLossesCurrentYear,
  );
  const netCapitalLossCarryforwardUsed = Math.min(
    memberState.openingNetCapitalLossCarryforward,
    remainingTaxableCapitalGainsAfterCurrentLosses,
  );
  const taxableCapitalGains = Math.max(
    0,
    remainingTaxableCapitalGainsAfterCurrentLosses -
      netCapitalLossCarryforwardUsed,
  );
  const closingNetCapitalLossCarryforward =
    memberState.openingNetCapitalLossCarryforward -
    netCapitalLossCarryforwardUsed +
    currentYearNetCapitalLoss;

  memberState.netCapitalLossCarryforwardUsed = netCapitalLossCarryforwardUsed;
  memberState.closingNetCapitalLossCarryforward =
    closingNetCapitalLossCarryforward;
  memberState.taxableCapitalGains = taxableCapitalGains;
  memberState.taxableIncome =
    memberState.ordinaryTaxableIncome + taxableCapitalGains;

  const taxEstimate = estimateIncomeTax({
    taxableIncome: memberState.taxableIncome,
    province: memberState.province,
    calendarYear,
    age: memberState.age,
    eligibleWorkIncome: memberState.eligibleWorkIncome,
    eligiblePensionIncome: memberState.eligiblePensionIncome,
    eligibleDividendIncome: memberState.eligibleDividendIncome,
    nonEligibleDividendIncome: memberState.nonEligibleDividendIncome,
    foreignNonBusinessIncome: memberState.foreignNonBusinessIncome,
    foreignNonBusinessIncomeTaxPaid: memberState.foreignNonBusinessIncomeTaxPaid,
  });

  memberState.taxes = taxEstimate.totalTax;
  memberState.federalForeignTaxCredit = taxEstimate.federalForeignTaxCredit;
  memberState.provincialForeignTaxCredit = taxEstimate.provincialForeignTaxCredit;
  memberState.quebecCareerExtensionCredit = taxEstimate.quebecCareerExtensionCredit;
  memberState.marginalRate = clampRate(taxEstimate.marginalRate);
  memberState.oasRecoveryTax = estimateOasRecoveryTax(
    context,
    calendarYear,
    memberState.taxableIncome,
    memberState.oasIncome,
  );
  memberState.warnings.push(...taxEstimate.warnings);
}

function applyPensionIncomeSplittingHeuristic(
  context: NormalizedContext,
  calendarYear: number,
  baseState: Partial<Record<MemberSlot, MemberTaxState>>,
): Partial<Record<MemberSlot, MemberTaxState>> {
  if (
    !context.input.household.pensionIncomeSplittingEnabled ||
    context.input.household.householdType === "single"
  ) {
    return baseState;
  }

  const primary = baseState.primary;
  const partner = baseState.partner;

  if (!primary || !partner) {
    return baseState;
  }

  let bestCandidate = evaluatePensionSplitCandidate(
    context,
    calendarYear,
    baseState,
  );
  const directions: Array<[MemberSlot, MemberSlot]> = [
    ["primary", "partner"],
    ["partner", "primary"],
  ];

  for (const [transferFrom, transferTo] of directions) {
    const donor = baseState[transferFrom];
    const receiver = baseState[transferTo];

    if (!donor || !receiver) {
      continue;
    }

    const maximumTransfer = Math.min(
      donor.eligiblePensionIncome * 0.5,
      donor.taxableIncome,
    );

    if (maximumTransfer <= 0) {
      continue;
    }

    for (const transferAmount of buildPensionSplitCandidateAmounts(
      maximumTransfer,
      donor,
      receiver,
    )) {
      const candidate = evaluatePensionSplitCandidate(
        context,
        calendarYear,
        baseState,
        transferFrom,
        transferTo,
        transferAmount,
      );

      if (candidate.totalTaxBurden < bestCandidate.totalTaxBurden - 1) {
        bestCandidate = candidate;
      }
    }
  }

  return bestCandidate.states;
}

function buildPensionSplitCandidateAmounts(
  maximumTransfer: number,
  donor: MemberTaxState,
  receiver: MemberTaxState,
): number[] {
  const amounts = new Set<number>();
  const stepSize = Math.max(500, Math.ceil(maximumTransfer / 24 / 100) * 100);
  const equalizingTransfer =
    (donor.taxableIncome - receiver.taxableIncome) / 2;

  for (let amount = stepSize; amount < maximumTransfer; amount += stepSize) {
    amounts.add(roundCurrency(amount));
  }

  if (equalizingTransfer > 0 && equalizingTransfer < maximumTransfer) {
    amounts.add(roundCurrency(equalizingTransfer));
  }

  amounts.add(roundCurrency(maximumTransfer));

  return [...amounts]
    .filter((amount) => amount > 0)
    .sort((left, right) => left - right);
}

function evaluatePensionSplitCandidate(
  context: NormalizedContext,
  calendarYear: number,
  baseState: Partial<Record<MemberSlot, MemberTaxState>>,
  transferFrom?: MemberSlot,
  transferTo?: MemberSlot,
  transferAmount = 0,
): PensionSplitCandidateResult {
  const candidateState = cloneMemberTaxState(baseState);

  if (transferFrom && transferTo && transferAmount > 0) {
    const donor = candidateState[transferFrom];
    const receiver = candidateState[transferTo];

    if (donor && receiver) {
      donor.ordinaryTaxableIncome = Math.max(
        0,
        donor.ordinaryTaxableIncome - transferAmount,
      );
      donor.eligiblePensionIncome = Math.max(
        0,
        donor.eligiblePensionIncome - transferAmount,
      );
      donor.pensionIncomeSplitOut = transferAmount;
      receiver.ordinaryTaxableIncome += transferAmount;
      receiver.eligiblePensionIncome += transferAmount;
      receiver.pensionIncomeSplitIn = transferAmount;
    }
  }

  const finalizedState = finalizeMemberTaxState(
    context,
    calendarYear,
    candidateState,
  );

  if (transferFrom && transferTo && transferAmount > 0) {
    const splitMessage = `Pension splitting heuristic transferred ${roundCurrency(
      transferAmount,
    )} of eligible pension income from ${labelForSlot(
      transferFrom,
    ).toLowerCase()} to ${labelForSlot(transferTo).toLowerCase()} for this year.`;

    finalizedState[transferFrom]?.warnings.push(splitMessage);
    finalizedState[transferTo]?.warnings.push(splitMessage);
  }

  return {
    states: finalizedState,
    totalTaxBurden: sumMemberTaxState(
      finalizedState,
      (memberState) => memberState.taxes + memberState.oasRecoveryTax,
    ),
    transferAmount,
    transferFrom,
    transferTo,
  };
}

function cloneMemberTaxState(
  state: Partial<Record<MemberSlot, MemberTaxState>>,
): Partial<Record<MemberSlot, MemberTaxState>> {
  return {
    primary: state.primary
      ? {
          ...state.primary,
          warnings: [...state.primary.warnings],
        }
      : undefined,
    partner: state.partner
      ? {
          ...state.partner,
          warnings: [...state.partner.warnings],
        }
      : undefined,
  };
}

function cloneLockedInAnnualLimits(
  limits: Partial<Record<MemberSlot, LockedInAnnualLimitState>>,
): Partial<Record<MemberSlot, LockedInAnnualLimitState>> {
  return {
    primary: limits.primary ? { ...limits.primary } : undefined,
    partner: limits.partner ? { ...limits.partner } : undefined,
  };
}

function cloneSingleMemberTaxState(state: MemberTaxState): MemberTaxState {
  return {
    ...state,
    warnings: [...state.warnings],
  };
}

function createEmptyDrawdownResult(): DrawdownResult {
  return {
    rrspRrifWithdrawals: 0,
    lifWithdrawals: 0,
    tfsaWithdrawals: 0,
    taxableWithdrawals: 0,
    realizedCapitalGains: 0,
    taxableCapitalGains: 0,
    cashWithdrawals: 0,
    netFromWithdrawals: 0,
    remainingGap: 0,
    warnings: [],
  };
}

function createEmptyIncomeTestedBenefitProjection(): IncomeTestedBenefitProjection {
  return {
    gisAnnual: 0,
    allowanceAnnual: 0,
    allowanceSurvivorAnnual: 0,
    totalAnnual: 0,
    warnings: [],
  };
}

function executeDrawdown(
  context: NormalizedContext,
  period: PeriodState,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  lockedInAnnualLimits: Partial<Record<MemberSlot, LockedInAnnualLimitState>>,
  startingGap: number,
): DrawdownResult {
  let remainingGap = startingGap;
  let rrspRrifWithdrawals = 0;
  let lifWithdrawals = 0;
  let tfsaWithdrawals = 0;
  let taxableWithdrawals = 0;
  let realizedCapitalGains = 0;
  let taxableCapitalGains = 0;
  let cashWithdrawals = 0;
  let netFromWithdrawals = 0;
  const warnings: string[] = [];

  const steps = buildWithdrawalSteps(
    context.input.household.withdrawalOrder,
    memberFrames,
    memberTaxState,
    context.input.household.customWithdrawalOrder,
  );

  for (const step of steps) {
    if (remainingGap <= 0.01) {
      break;
    }

    const account = getAccountLedgerBySlot(balances, step.slot);

    switch (step.source) {
      case "cash": {
        const amount = Math.min(account.cash, remainingGap);
        if (amount <= 0) {
          continue;
        }

        account.cash -= amount;
        cashWithdrawals += amount;
        netFromWithdrawals += amount;
        remainingGap -= amount;
        break;
      }
      case "nonRegistered": {
        if (account.nonRegistered <= 0) {
          continue;
        }

        const taxState = memberTaxState[step.slot];
        if (!taxState) {
          continue;
        }

        const grossWithdrawal = solveNonRegisteredWithdrawalForNetGap(
          context,
          period.calendarYear,
          taxState,
          remainingGap,
          account.nonRegistered,
          account.nonRegisteredCostBase,
        );

        if (grossWithdrawal <= 0) {
          continue;
        }

        const breakdown = calculateTaxableWithdrawalBreakdown(
          grossWithdrawal,
          account.nonRegistered,
          account.nonRegisteredCostBase,
          context.rules.taxableAccounts.capitalGainsInclusionRate,
        );
        const previousTax = taxState.taxes;
        const previousRecovery = taxState.oasRecoveryTax;

        account.nonRegistered -= grossWithdrawal;
        account.nonRegisteredCostBase = Math.max(
          0,
          account.nonRegisteredCostBase - breakdown.costBaseReduction,
        );

        if (account.nonRegistered <= 0.01) {
          account.nonRegistered = 0;
          account.nonRegisteredCostBase = 0;
        }

        taxableWithdrawals += grossWithdrawal;
        realizedCapitalGains += Math.max(0, breakdown.realizedCapitalGain);
        taxableCapitalGains += Math.max(
          0,
          breakdown.taxableCapitalGain - breakdown.allowableCapitalLoss,
        );
        taxState.realizedCapitalGains += Math.max(0, breakdown.realizedCapitalGain);
        taxState.grossTaxableCapitalGains += breakdown.taxableCapitalGain;
        taxState.allowableCapitalLossesCurrentYear += breakdown.allowableCapitalLoss;
        refreshMemberTaxState(context, period.calendarYear, taxState);

        const netWithdrawal =
          grossWithdrawal -
          (taxState.taxes - previousTax) -
          (taxState.oasRecoveryTax - previousRecovery);

        netFromWithdrawals += netWithdrawal;
        remainingGap -= netWithdrawal;
        break;
      }
      case "tfsa": {
        const amount = Math.min(account.tfsa, remainingGap);
        if (amount <= 0) {
          continue;
        }

        account.tfsa -= amount;
        tfsaWithdrawals += amount;
        netFromWithdrawals += amount;
        remainingGap -= amount;
        break;
      }
      case "lif": {
        const availableBalance = account.lif;
        const lockedInLimit = lockedInAnnualLimits[step.slot];
        if (availableBalance <= 0 || !lockedInLimit) {
          continue;
        }

        const remainingMaximumRoom = Math.max(
          0,
          lockedInLimit.maximumWithdrawal - lockedInLimit.withdrawnSoFar,
        );
        if (remainingMaximumRoom <= 0) {
          warnings.push(
            `${lockedInLimit.incomeAccountLabel} maximum withdrawal limit was reached for ${period.calendarYear}.`,
          );
          continue;
        }

        const taxState = memberTaxState[step.slot];
        if (!taxState) {
          continue;
        }

        const grossWithdrawal = solveRegisteredWithdrawalForNetGap(
          context,
          period.calendarYear,
          taxState,
          remainingGap,
          Math.min(availableBalance, remainingMaximumRoom),
          taxState.age >= 65,
        );

        if (grossWithdrawal <= 0) {
          continue;
        }

        const previousTax = taxState.taxes;
        const previousRecovery = taxState.oasRecoveryTax;
        account.lif -= grossWithdrawal;
        lifWithdrawals += grossWithdrawal;
        lockedInLimit.withdrawnSoFar += grossWithdrawal;
        taxState.ordinaryTaxableIncome += grossWithdrawal;

        if (taxState.age >= 65) {
          taxState.eligiblePensionIncome += grossWithdrawal;
        }

        refreshMemberTaxState(context, period.calendarYear, taxState);

        const netWithdrawal =
          grossWithdrawal -
          (taxState.taxes - previousTax) -
          (taxState.oasRecoveryTax - previousRecovery);

        netFromWithdrawals += netWithdrawal;
        remainingGap -= netWithdrawal;
        break;
      }
      case "rrif":
      case "rrsp": {
        const availableBalance = account[step.source];
        if (availableBalance <= 0) {
          continue;
        }

        const taxState = memberTaxState[step.slot];
        if (!taxState) {
          continue;
        }

        const grossWithdrawal = solveRegisteredWithdrawalForNetGap(
          context,
          period.calendarYear,
          taxState,
          remainingGap,
          availableBalance,
          step.source === "rrif" && taxState.age >= 65,
        );

        if (grossWithdrawal <= 0) {
          continue;
        }

        const previousTax = taxState.taxes;
        const previousRecovery = taxState.oasRecoveryTax;
        const nextEligiblePensionIncome =
          step.source === "rrif" && taxState.age >= 65
            ? taxState.eligiblePensionIncome + grossWithdrawal
            : taxState.eligiblePensionIncome;
        account[step.source] -= grossWithdrawal;
        rrspRrifWithdrawals += grossWithdrawal;
        taxState.ordinaryTaxableIncome += grossWithdrawal;
        taxState.eligiblePensionIncome = nextEligiblePensionIncome;
        refreshMemberTaxState(context, period.calendarYear, taxState);

        const netWithdrawal =
          grossWithdrawal -
          (taxState.taxes - previousTax) -
          (taxState.oasRecoveryTax - previousRecovery);

        netFromWithdrawals += netWithdrawal;
        remainingGap -= netWithdrawal;
        break;
      }
      default:
        warnings.push(`Unknown withdrawal source ${step.source} ignored.`);
    }
  }

  if (remainingGap > 0.01) {
    warnings.push(
      `Projected assets were not sufficient to fully cover the cash need in ${period.calendarYear}.`,
    );
  }

  return {
    rrspRrifWithdrawals,
    lifWithdrawals,
    tfsaWithdrawals,
    taxableWithdrawals,
    realizedCapitalGains,
    taxableCapitalGains,
    cashWithdrawals,
    netFromWithdrawals,
    remainingGap,
    warnings,
  };
}

function buildWithdrawalSteps(
  withdrawalOrder: WithdrawalOrder,
  memberFrames: MemberFrame[],
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  customWithdrawalOrder?: string[],
): Array<{ slot: MemberSlot; source: WithdrawableSource }> {
  const slots = memberFrames.map((frame) => frame.slot);
  const cashFirst = slots.map((slot) => ({ slot, source: "cash" as const }));
  const taxableFirst = slots.map((slot) => ({
    slot,
    source: "nonRegistered" as const,
  }));
  const tfsaFirst = slots.map((slot) => ({ slot, source: "tfsa" as const }));
  const registeredSortedSlots = [...slots].sort((left, right) => {
    const leftRate = memberTaxState[left]?.marginalRate ?? 0;
    const rightRate = memberTaxState[right]?.marginalRate ?? 0;
    return leftRate - rightRate;
  });
  const registeredFirst = registeredSortedSlots.flatMap((slot) => [
    { slot, source: "lif" as const },
    { slot, source: "rrif" as const },
    { slot, source: "rrsp" as const },
  ]);

  switch (withdrawalOrder) {
    case "taxable-first":
      return [...cashFirst, ...taxableFirst, ...registeredFirst, ...tfsaFirst];
    case "rrsp-rrif-first":
      return [...cashFirst, ...registeredFirst, ...taxableFirst, ...tfsaFirst];
    case "tfsa-first":
      return [...cashFirst, ...tfsaFirst, ...taxableFirst, ...registeredFirst];
    case "custom":
      return buildCustomWithdrawalSteps(
        customWithdrawalOrder,
        memberFrames,
        memberTaxState,
        [...cashFirst, ...taxableFirst, ...registeredFirst, ...tfsaFirst],
      );
    case "tax-aware-blended":
    default:
      return [...cashFirst, ...taxableFirst, ...registeredFirst, ...tfsaFirst];
  }
}

function buildCustomWithdrawalSteps(
  customWithdrawalOrder: string[] | undefined,
  memberFrames: MemberFrame[],
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  fallbackSteps: Array<{ slot: MemberSlot; source: WithdrawableSource }>,
): Array<{ slot: MemberSlot; source: WithdrawableSource }> {
  if (!customWithdrawalOrder || customWithdrawalOrder.length === 0) {
    return fallbackSteps;
  }

  const slotPriority = memberFrames.map((frame) => frame.slot);
  const registeredSlotPriority = [...slotPriority].sort((left, right) => {
    const leftRate = memberTaxState[left]?.marginalRate ?? 0;
    const rightRate = memberTaxState[right]?.marginalRate ?? 0;
    return leftRate - rightRate;
  });
  const selected = new Set<string>();
  const orderedSteps: Array<{ slot: MemberSlot; source: WithdrawableSource }> = [];

  for (const token of customWithdrawalOrder) {
    for (const step of resolveCustomWithdrawalToken(
      token,
      slotPriority,
      registeredSlotPriority,
    )) {
      const key = `${step.slot}:${step.source}`;
      if (selected.has(key)) {
        continue;
      }

      selected.add(key);
      orderedSteps.push(step);
    }
  }

  for (const step of fallbackSteps) {
    const key = `${step.slot}:${step.source}`;
    if (selected.has(key)) {
      continue;
    }

    selected.add(key);
    orderedSteps.push(step);
  }

  return orderedSteps;
}

function resolveCustomWithdrawalToken(
  token: string,
  slotPriority: MemberSlot[],
  registeredSlotPriority: MemberSlot[],
): Array<{ slot: MemberSlot; source: WithdrawableSource }> {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) {
    return [];
  }

  const [slotToken, sourceToken] = normalizedToken.includes(":")
    ? (normalizedToken.split(":", 2) as [string, string])
    : [undefined, normalizedToken];
  const slotScope = resolveCustomWithdrawalSlots(
    slotToken,
    slotPriority,
    registeredSlotPriority,
  );
  const sources = resolveCustomWithdrawalSources(sourceToken);

  return slotScope.flatMap((slot) =>
    sources.map((source) => ({ slot, source })),
  );
}

function resolveCustomWithdrawalSlots(
  slotToken: string | undefined,
  slotPriority: MemberSlot[],
  registeredSlotPriority: MemberSlot[],
): MemberSlot[] {
  switch (slotToken) {
    case "primary":
      return slotPriority.includes("primary") ? ["primary"] : [];
    case "partner":
      return slotPriority.includes("partner") ? ["partner"] : [];
    case "registered":
      return registeredSlotPriority;
    case undefined:
      return slotPriority;
    default:
      return [];
  }
}

function resolveCustomWithdrawalSources(
  sourceToken: string,
): WithdrawableSource[] {
  switch (sourceToken) {
    case "cash":
      return ["cash"];
    case "taxable":
    case "nonregistered":
    case "non-registered":
      return ["nonRegistered"];
    case "tfsa":
      return ["tfsa"];
    case "lif":
      return ["lif"];
    case "rrif":
      return ["rrif"];
    case "rrsp":
      return ["rrsp"];
    case "registered":
    case "rrif-rrsp":
      return ["lif", "rrif", "rrsp"];
    default:
      return [];
  }
}

function applyContributions(
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
): number {
  let total = 0;

  for (const frame of memberFrames) {
    const account = getAccountLedgerBySlot(balances, frame.slot);

    account.rrsp += frame.rrspContribution;
    account.tfsa += frame.tfsaContribution;
    account.nonRegistered += frame.nonRegisteredContribution;
    account.nonRegisteredCostBase += frame.nonRegisteredContribution;

    total +=
      frame.rrspContribution + frame.tfsaContribution + frame.nonRegisteredContribution;
  }

  return total;
}

function applyAnnualGrowth(
  context: NormalizedContext,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
): void {
  const feeRate = context.input.household.annualFeeRate ?? 0;

  for (const frame of memberFrames) {
    const account = getAccountLedgerBySlot(balances, frame.slot);
    const grossRate = frame.isRetired
      ? context.input.household.postRetirementReturnRate
      : context.input.household.preRetirementReturnRate;
    const netRate = Math.max(-0.5, grossRate - feeRate);

    account.rrsp *= 1 + netRate;
    account.rrif *= 1 + netRate;
    account.tfsa *= 1 + netRate;
    account.nonRegistered *= 1 + netRate;
    account.lira *= 1 + netRate;
    account.lif *= 1 + netRate;
    account.dcPension *= 1 + netRate;
  }
}

function estimateEmploymentIncome(
  member: HouseholdMemberInput,
  age: number,
  yearsFromStart: number,
): number {
  if (age > member.profile.lifeExpectancy) {
    return 0;
  }

  const fullTimeIncome =
    age < member.profile.retirementAge
      ? (member.employment.baseAnnualIncome +
          (member.employment.bonusAnnualIncome ?? 0)) *
        Math.pow(1 + member.employment.annualGrowthRate, yearsFromStart)
      : 0;
  const partTimeIncome = estimateScheduledCashFlowTotal(
    member.employment.partTimeIncomeAfterRetirement,
    age,
  );

  return fullTimeIncome + partTimeIncome;
}

function estimateContribution(
  baseAmount: number,
  escalationRate: number,
  yearsFromStart: number,
  enabled: boolean,
): number {
  if (!enabled || baseAmount <= 0) {
    return 0;
  }

  return baseAmount * Math.pow(1 + escalationRate, yearsFromStart);
}

function estimateCppOrQppIncome(
  context: NormalizedContext,
  member: HouseholdMemberInput,
  age: number,
  isAlive: boolean,
): number {
  const benefits = member.publicBenefits;

  if (!isAlive || age < benefits.pensionStartAge) {
    return 0;
  }

  return resolveCppOrQppAnnualIncome(context, member);
}

function estimateOasIncome(
  context: NormalizedContext,
  member: HouseholdMemberInput,
  age: number,
  isAlive: boolean,
  calendarYear: number,
): number {
  const benefits = member.publicBenefits;

  if (!isAlive || age < benefits.oasStartAge || benefits.oasEligible === false) {
    return 0;
  }

  if (
    benefits.oasEstimateMode === "manual-at-start-age" &&
    benefits.manualOasMonthlyAtStartAge !== undefined
  ) {
    return benefits.manualOasMonthlyAtStartAge * 12;
  }

  const annualizedOasBenefits = resolveAnnualizedOasBenefitValues(
    context.rules,
    calendarYear,
  );
  const maximum =
    age >= 75
      ? annualizedOasBenefits.monthlyMaximums.find((item) => item.ageBand === "75+")
      : annualizedOasBenefits.monthlyMaximums.find(
          (item) => item.ageBand === "65-74",
        );

  if (!maximum) {
    return 0;
  }

  const residenceYears =
    benefits.oasResidenceYearsOverride ??
    member.profile.yearsResidedInCanadaAfter18;

  if (residenceYears <= 0) {
    return 0;
  }

  const residenceRatio = Math.min(
    1,
    residenceYears / context.rules.oas.fullResidenceYearsAfter18,
  );
  const delayedMonthlyAmount = applyOasStartAgeAdjustment(
    maximum.amount * residenceRatio,
    benefits.oasStartAge,
    context.rules,
  );

  return delayedMonthlyAmount * 12;
}

function estimateDbPensionIncome(
  member: HouseholdMemberInput,
  age: number,
  isAlive: boolean,
): number {
  const pension = member.definedBenefitPension;
  if (!isAlive || !pension || age < pension.startAge) {
    return 0;
  }

  const indexedAmount = estimateIndexedDbPensionBaseAmount(member, age);
  const bridgeAmount =
    age < 65 ? pension.bridgeTo65AnnualAmount ?? 0 : 0;

  return indexedAmount + bridgeAmount;
}

function estimateIndexedDbPensionBaseAmount(
  member: HouseholdMemberInput,
  age: number,
): number {
  const pension = member.definedBenefitPension;
  if (!pension || age < pension.startAge) {
    return 0;
  }

  const yearsReceiving = Math.max(0, age - pension.startAge);

  return (
    pension.annualAmount *
    Math.pow(1 + (pension.indexationRate ?? 0), yearsReceiving)
  );
}

function estimateDbSurvivorContinuationIncome(
  member: HouseholdMemberInput,
  age: number,
): number {
  const survivorContinuationPercent =
    member.definedBenefitPension?.survivorContinuationPercent ?? 0;

  if (survivorContinuationPercent <= 0) {
    return 0;
  }

  return (
    estimateIndexedDbPensionBaseAmount(member, age) * survivorContinuationPercent
  );
}

function estimatePublicPensionSurvivorIncome(
  context: NormalizedContext,
  survivor: MemberFrame,
  deceased: MemberFrame,
  warnings: string[],
  prorationFactor = 1,
  phaseLabel = "survivor year",
): number {
  const survivorBenefitMode =
    survivor.member.publicBenefits.survivorBenefitEstimateMode ?? "automatic";

  if (survivorBenefitMode === "disabled") {
    return 0;
  }

  if (
    survivorBenefitMode === "manual-annual" &&
    survivor.member.publicBenefits.manualAnnualSurvivorBenefit !== undefined
  ) {
    warnings.push(
      `${labelForSlot(
        survivor.slot,
      )} ${phaseLabel} calculations are using a manual annual CPP/QPP survivor benefit override.`,
    );
    return (
      Math.max(0, survivor.member.publicBenefits.manualAnnualSurvivorBenefit) *
      prorationFactor
    );
  }

  if (survivor.member.profile.pensionPlan === "QPP") {
    return estimateQppSurvivorIncome(
      context,
      survivor,
      deceased,
      warnings,
      prorationFactor,
      phaseLabel,
    );
  }

  return estimateCppSurvivorIncome(
    context,
    survivor,
    deceased,
    warnings,
    prorationFactor,
    phaseLabel,
  );
}

function estimateCppSurvivorIncome(
  context: NormalizedContext,
  survivor: MemberFrame,
  deceased: MemberFrame,
  warnings: string[],
  prorationFactor: number,
  phaseLabel: string,
): number {
  const deceasedMonthlyAmountAt65 = resolveMonthlyBenefitAt65(
    context,
    deceased.member,
  );

  if (deceasedMonthlyAmountAt65 <= 0) {
    return 0;
  }

  const survivorOwnMonthlyRetirement = survivor.cppQppIncome / 12;
  let monthlySurvivorBenefit = 0;

  if (survivor.age >= 65) {
    const standaloneMonthlySurvivorBenefit = Math.min(
      context.rules.cpp.survivorMaximumMonthlyAge65Plus,
      deceasedMonthlyAmountAt65 * 0.6,
    );

    if (survivorOwnMonthlyRetirement > 0) {
      monthlySurvivorBenefit = Math.max(
        0,
        Math.min(
          standaloneMonthlySurvivorBenefit,
          context.rules.cpp.combinedRetirementSurvivorMaximumMonthlyAt65 -
            survivorOwnMonthlyRetirement,
        ),
      );
      warnings.push(
        "CPP survivor pension for a survivor already receiving CPP retirement was combined using the published age-65 combined maximum as a baseline cap. Exact Service Canada combined-benefit math and enhancement detail remain partial.",
      );
    } else {
      monthlySurvivorBenefit = standaloneMonthlySurvivorBenefit;
    }
  } else {
    const standaloneMonthlySurvivorBenefit = Math.min(
      context.rules.cpp.survivorMaximumMonthlyUnder65,
      context.rules.cpp.survivorUnder65FlatRateMonthly +
        deceasedMonthlyAmountAt65 * 0.375,
    );

    if (survivorOwnMonthlyRetirement > 0) {
      const survivorMaximumRetirementForCurrentStartAge =
        applyCppStartAgeAdjustment(
          context.rules.cpp.maxMonthlyRetirementAt65,
          survivor.member.publicBenefits.pensionStartAge,
          context.rules,
        );
      monthlySurvivorBenefit = Math.max(
        0,
        Math.min(
          standaloneMonthlySurvivorBenefit,
          survivorMaximumRetirementForCurrentStartAge -
            survivorOwnMonthlyRetirement,
        ),
      );
      warnings.push(
        "CPP survivor pension under age 65 for a survivor already receiving CPP retirement is using a baseline combined-benefit cap at the modeled maximum retirement pension for the survivor's current start age. Service Canada notes that combined benefits are adjusted for survivor age and other benefits received, so enhancement and exact combined-benefit math remain partial.",
      );
    } else {
      monthlySurvivorBenefit = standaloneMonthlySurvivorBenefit;
    }
  }

  if (monthlySurvivorBenefit <= 0) {
    return 0;
  }

  warnings.push(
    `CPP survivor pension of ${roundCurrency(
      monthlySurvivorBenefit * 12 * prorationFactor,
    )} was added for ${labelForSlot(survivor.slot).toLowerCase()} in the ${phaseLabel} after ${labelForSlot(
      deceased.slot,
    ).toLowerCase()}'s modeled death.`,
  );

  return monthlySurvivorBenefit * 12 * prorationFactor;
}

function estimateQppSurvivorIncome(
  context: NormalizedContext,
  survivor: MemberFrame,
  deceased: MemberFrame,
  warnings: string[],
  prorationFactor: number,
  phaseLabel: string,
): number {
  const deceasedMonthlyAmountAt65 = resolveMonthlyBenefitAt65(
    context,
    deceased.member,
  );

  if (deceasedMonthlyAmountAt65 <= 0) {
    return 0;
  }

  const survivorOwnMonthlyRetirement = survivor.cppQppIncome / 12;

  const entitlementRatio = clampRate(
    deceasedMonthlyAmountAt65 / context.rules.qpp.maxMonthlyRetirementAt65,
  );
  let monthlyCap = context.rules.qpp.survivorMaximumMonthlyAge65PlusNoRetirement;

  if (survivor.age < 45) {
    if (survivor.member.publicBenefits.survivorIsDisabled) {
      monthlyCap = context.rules.qpp.survivorMaximumMonthlyUnder45Disabled;
    } else if (survivor.member.publicBenefits.survivorHasDependentChildren) {
      monthlyCap = context.rules.qpp.survivorMaximumMonthlyUnder45WithChildren;
    } else {
      monthlyCap = context.rules.qpp.survivorMaximumMonthlyUnder45NoChildren;
      warnings.push(
        "QPP survivor pension for a survivor under age 45 defaulted to the no-children / not-disabled maximum because no dependent-child or disability flag was supplied.",
      );
    }
  } else if (survivor.age < 65) {
    monthlyCap = context.rules.qpp.survivorMaximumMonthly45To64;
  }

  let monthlyBenefit = monthlyCap * entitlementRatio;

  if (survivorOwnMonthlyRetirement > 0) {
    const survivorMaximumRetirementForCurrentStartAge = applyQppStartAgeAdjustment(
      context.rules.qpp.maxMonthlyRetirementAt65,
      survivor.member.publicBenefits.pensionStartAge,
      context.rules,
    );
    const reductionRatio =
      survivorMaximumRetirementForCurrentStartAge > 0
        ? clampRate(
            survivorOwnMonthlyRetirement /
              survivorMaximumRetirementForCurrentStartAge,
          )
        : 1;

    monthlyBenefit *= 1 - reductionRatio;
    warnings.push(
      survivor.age >= 65
        ? "QPP survivor pension for a survivor already receiving QPP retirement is using a baseline combined-benefit approximation. Retraite Quebec states the survivor portion may be reduced to zero when the survivor is already receiving the maximum retirement pension for that start age, so the scaffold linearly reduces the no-retirement survivor maximum by the survivor's current-retirement-to-maximum ratio."
        : "QPP survivor pension under age 65 for a survivor already receiving QPP retirement is using a baseline combined-benefit approximation. Retraite Quebec states that combined pensions are subject to a legal maximum and may be reduced below the sum of the individual pensions, so the scaffold linearly reduces the no-retirement survivor maximum by the survivor's current-retirement-to-maximum ratio.",
    );
  }

  const annualBenefit = monthlyBenefit * 12;

  warnings.push(
    `QPP survivor pension of ${roundCurrency(
      annualBenefit * prorationFactor,
    )} was added for ${labelForSlot(survivor.slot).toLowerCase()} in the ${phaseLabel} after ${labelForSlot(
      deceased.slot,
    ).toLowerCase()}'s modeled death. This path scales the published 2026 survivor maximum by the deceased contributor's modeled entitlement proportion and still needs Retraite Quebec combined-benefit detail.`,
  );

  return annualBenefit * prorationFactor;
}

function estimateOtherPlannedIncome(
  member: HouseholdMemberInput,
  age: number,
  isAlive: boolean,
): number {
  if (!isAlive) {
    return 0;
  }

  return (
    estimateScheduledCashFlowTotal(member.annuityIncome, age) +
    estimateScheduledCashFlowTotal(member.rentalIncome, age) +
    estimateScheduledCashFlowTotal(member.foreignPensionIncome, age) +
    (member.taxableAccountTaxProfile?.annualInterestIncome ?? 0) +
    (member.taxableAccountTaxProfile?.annualEligibleDividendIncome ?? 0) +
    (member.taxableAccountTaxProfile?.annualNonEligibleDividendIncome ?? 0) +
    (member.taxableAccountTaxProfile?.annualForeignDividendIncome ?? 0) +
    (member.taxableAccountTaxProfile?.annualReturnOfCapitalDistribution ?? 0)
  );
}

function resolveBaseOrdinaryPlannedIncome(frame: MemberFrame): number {
  return Math.max(
    0,
    frame.otherPlannedIncome -
      frame.eligibleDividendIncome -
      frame.nonEligibleDividendIncome -
      frame.returnOfCapitalDistribution,
  );
}

function resolveTaxableDividendIncome(frame: MemberFrame): number {
  return (
    frame.eligibleDividendIncome * 1.38 +
    frame.nonEligibleDividendIncome * 1.15
  );
}

function estimateSpending(
  context: NormalizedContext,
  period: PeriodState,
  memberFrames: MemberFrame[],
): number {
  if (!period.retirementActive) {
    return 0;
  }

  const { expenseProfile, inflationRate } = context.input.household;
  const inflationYears =
    period.calendarYear - context.input.household.projectionStartYear;
  let spending =
    expenseProfile.desiredAfterTaxSpending *
    Math.pow(1 + inflationRate, inflationYears);
  const livingMembers = memberFrames.filter((frame) => frame.isAlive).length;
  const deathYearCount = memberFrames.filter(
    (frame) => frame.deathOccursThisYear,
  ).length;
  const survivorSpendingPercent = clampRate(
    expenseProfile.survivorSpendingPercentOfCouple ?? 0.72,
  );

  if (livingMembers === 0) {
    return 0;
  }

  if (context.input.household.householdType !== "single" && livingMembers === 1) {
    spending *= survivorSpendingPercent;
  } else if (
    context.input.household.householdType !== "single" &&
    deathYearCount === 1
  ) {
    spending *= (1 + survivorSpendingPercent) / 2;
  } else if (
    context.input.household.householdType !== "single" &&
    deathYearCount >= 2
  ) {
    spending *= 0.5;
  }

  return spending;
}

function getOneTimeCashFlow(
  context: NormalizedContext,
  period: PeriodState,
): HouseholdCashFlowEvents {
  let inflows = 0;
  let outflows = 0;
  const descriptions: string[] = [];

  for (const event of context.input.household.oneTimeEvents) {
    if (event.age !== period.primaryAge) {
      continue;
    }

    if (event.direction === "inflow") {
      inflows += event.amount;
    } else {
      outflows += event.amount;
    }

    descriptions.push(
      `One-time ${event.direction} applied: ${event.description}.`,
    );
  }

  return {
    inflows,
    outflows,
    descriptions,
  };
}

function estimateOasRecoveryTax(
  context: NormalizedContext,
  calendarYear: number,
  taxableIncome: number,
  oasIncome: number,
): number {
  if (oasIncome <= 0 || !context.input.household.oasClawbackAwareMode) {
    return 0;
  }

  const thresholdRecord =
    context.rules.oas.recoveryPeriods.find(
      (item) => item.incomeYear === calendarYear - 1,
    ) ??
    context.rules.oas.recoveryPeriods.at(-1);

  if (!thresholdRecord || taxableIncome <= thresholdRecord.lowerThreshold) {
    return 0;
  }

  return Math.min(oasIncome, (taxableIncome - thresholdRecord.lowerThreshold) * 0.15);
}

function solveRegisteredWithdrawalForNetGap(
  context: NormalizedContext,
  calendarYear: number,
  taxState: MemberTaxState,
  targetNetGap: number,
  availableBalance: number,
  withdrawalCountsAsEligiblePensionIncome: boolean,
): number {
  const netFromMax = estimateNetFromRegisteredWithdrawal(
    context,
    calendarYear,
    taxState,
    availableBalance,
    withdrawalCountsAsEligiblePensionIncome,
  );

  if (netFromMax <= targetNetGap) {
    return availableBalance;
  }

  let low = 0;
  let high = availableBalance;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const mid = (low + high) / 2;
    const net = estimateNetFromRegisteredWithdrawal(
      context,
      calendarYear,
      taxState,
      mid,
      withdrawalCountsAsEligiblePensionIncome,
    );

    if (net >= targetNetGap) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return high;
}

function estimateNetFromRegisteredWithdrawal(
  context: NormalizedContext,
  calendarYear: number,
  taxState: MemberTaxState,
  grossWithdrawal: number,
  withdrawalCountsAsEligiblePensionIncome: boolean,
): number {
  const simulatedTaxState = cloneSingleMemberTaxState(taxState);
  simulatedTaxState.ordinaryTaxableIncome += grossWithdrawal;
  simulatedTaxState.eligiblePensionIncome = withdrawalCountsAsEligiblePensionIncome
    ? simulatedTaxState.eligiblePensionIncome + grossWithdrawal
    : simulatedTaxState.eligiblePensionIncome;
  refreshMemberTaxState(context, calendarYear, simulatedTaxState);

  return (
    grossWithdrawal -
    (simulatedTaxState.taxes - taxState.taxes) -
    (simulatedTaxState.oasRecoveryTax - taxState.oasRecoveryTax)
  );
}

function solveNonRegisteredWithdrawalForNetGap(
  context: NormalizedContext,
  calendarYear: number,
  taxState: MemberTaxState,
  targetNetGap: number,
  availableBalance: number,
  availableCostBase: number,
): number {
  const netFromMax = estimateNetFromNonRegisteredWithdrawal(
    context,
    calendarYear,
    taxState,
    availableBalance,
    availableBalance,
    availableCostBase,
  );

  if (netFromMax <= targetNetGap) {
    return availableBalance;
  }

  let low = 0;
  let high = availableBalance;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const mid = (low + high) / 2;
    const net = estimateNetFromNonRegisteredWithdrawal(
      context,
      calendarYear,
      taxState,
      mid,
      availableBalance,
      availableCostBase,
    );

    if (net >= targetNetGap) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return high;
}

function estimateNetFromNonRegisteredWithdrawal(
  context: NormalizedContext,
  calendarYear: number,
  taxState: MemberTaxState,
  grossWithdrawal: number,
  availableBalance: number,
  availableCostBase: number,
): number {
  const breakdown = calculateTaxableWithdrawalBreakdown(
    grossWithdrawal,
    availableBalance,
    availableCostBase,
    context.rules.taxableAccounts.capitalGainsInclusionRate,
  );
  const simulatedTaxState = cloneSingleMemberTaxState(taxState);
  simulatedTaxState.grossTaxableCapitalGains += breakdown.taxableCapitalGain;
  simulatedTaxState.allowableCapitalLossesCurrentYear +=
    breakdown.allowableCapitalLoss;
  refreshMemberTaxState(context, calendarYear, simulatedTaxState);

  return (
    grossWithdrawal -
    (simulatedTaxState.taxes - taxState.taxes) -
    (simulatedTaxState.oasRecoveryTax - taxState.oasRecoveryTax)
  );
}

function calculateTaxableWithdrawalBreakdown(
  grossWithdrawal: number,
  availableBalance: number,
  availableCostBase: number,
  inclusionRate: number,
): TaxableWithdrawalBreakdown {
  if (grossWithdrawal <= 0 || availableBalance <= 0) {
    return {
      costBaseReduction: 0,
      realizedCapitalGain: 0,
      taxableCapitalGain: 0,
      allowableCapitalLoss: 0,
    };
  }

  const normalizedWithdrawal = Math.min(grossWithdrawal, availableBalance);
  const costBaseReduction = Math.min(
    availableCostBase,
    availableCostBase * (normalizedWithdrawal / availableBalance),
  );
  const realizedCapitalGain = normalizedWithdrawal - costBaseReduction;
  const taxableCapitalGain =
    realizedCapitalGain > 0
      ? realizedCapitalGain * inclusionRate
      : 0;
  const allowableCapitalLoss =
    realizedCapitalGain < 0
      ? Math.abs(realizedCapitalGain) * inclusionRate
      : 0;

  return {
    costBaseReduction,
    realizedCapitalGain,
    taxableCapitalGain,
    allowableCapitalLoss,
  };
}

function resolveCppOrQppAnnualIncome(
  context: NormalizedContext,
  member: HouseholdMemberInput,
): number {
  const benefits = member.publicBenefits;

  if (
    benefits.cppQppEstimateMode === "manual-at-start-age" &&
    benefits.manualMonthlyPensionAtStartAge !== undefined
  ) {
    return benefits.manualMonthlyPensionAtStartAge * 12;
  }

  const monthlyAmountAt65 = resolveMonthlyBenefitAt65(context, member);
  if (monthlyAmountAt65 === 0) {
    return 0;
  }

  if (member.profile.pensionPlan === "QPP") {
    return (
      applyQppStartAgeAdjustment(
        monthlyAmountAt65,
        member.publicBenefits.pensionStartAge,
        context.rules,
      ) * 12
    );
  }

  const adjustedMonthlyAmount = applyCppStartAgeAdjustment(
    monthlyAmountAt65,
    benefits.pensionStartAge,
    context.rules,
  );

  return adjustedMonthlyAmount * 12;
}

function resolveMonthlyBenefitAt65(
  context: NormalizedContext,
  member: HouseholdMemberInput,
): number {
  const benefits = member.publicBenefits;

  if (benefits.statementMonthlyPensionAt65 !== undefined) {
    return benefits.statementMonthlyPensionAt65;
  }

  if (benefits.entitlementPercentOfMaximum !== undefined) {
    return (
      (member.profile.pensionPlan === "QPP"
        ? context.rules.qpp.maxMonthlyRetirementAt65
        : context.rules.cpp.maxMonthlyRetirementAt65) *
      benefits.entitlementPercentOfMaximum
    );
  }

  if (
    benefits.cppQppEstimateMode === "manual-at-start-age" &&
    benefits.manualMonthlyPensionAtStartAge !== undefined
  ) {
    if (benefits.pensionStartAge === 65) {
      return benefits.manualMonthlyPensionAtStartAge;
    }

    return member.profile.pensionPlan === "QPP"
      ? reverseQppStartAgeAdjustment(
          benefits.manualMonthlyPensionAtStartAge,
          benefits.pensionStartAge,
          context.rules,
        )
      : reverseCppStartAgeAdjustment(
          benefits.manualMonthlyPensionAtStartAge,
          benefits.pensionStartAge,
          context.rules,
        );
  }

  return 0;
}

function applyQppStartAgeAdjustment(
  monthlyAmountAt65: number,
  pensionStartAge: number,
  rules: CanadaRuleSet,
): number {
  const monthsFrom65 = Math.round((pensionStartAge - 65) * 12);

  if (monthsFrom65 < 0) {
    const reductionRatePerMonth = resolveQppReductionPerMonth(
      monthlyAmountAt65,
      rules,
    );

    return monthlyAmountAt65 * (1 - Math.abs(monthsFrom65) * reductionRatePerMonth);
  }

  if (monthsFrom65 > 0) {
    const delayedMonths = Math.min(monthsFrom65, (72 - 65) * 12);

    return monthlyAmountAt65 * (1 + delayedMonths * rules.qpp.increasePerMonthAfter65);
  }

  return monthlyAmountAt65;
}

function reverseQppStartAgeAdjustment(
  monthlyAmountAtStartAge: number,
  pensionStartAge: number,
  rules: CanadaRuleSet,
): number {
  const monthsFrom65 = Math.round((pensionStartAge - 65) * 12);

  if (monthsFrom65 < 0) {
    const reductionRatePerMonth = resolveQppReductionPerMonth(
      monthlyAmountAtStartAge,
      rules,
    );

    return monthlyAmountAtStartAge / (1 - Math.abs(monthsFrom65) * reductionRatePerMonth);
  }

  if (monthsFrom65 > 0) {
    const delayedMonths = Math.min(monthsFrom65, (72 - 65) * 12);

    return monthlyAmountAtStartAge / (1 + delayedMonths * rules.qpp.increasePerMonthAfter65);
  }

  return monthlyAmountAtStartAge;
}

function resolveQppReductionPerMonth(
  monthlyAmountAt65: number,
  rules: CanadaRuleSet,
): number {
  const maxMonthlyAmount = Math.max(0, rules.qpp.maxMonthlyRetirementAt65);

  if (maxMonthlyAmount <= 0) {
    return rules.qpp.reductionPerMonthBefore65Max;
  }

  const proportionOfMaximum = clampRate(monthlyAmountAt65 / maxMonthlyAmount);

  return (
    rules.qpp.reductionPerMonthBefore65Min +
    (rules.qpp.reductionPerMonthBefore65Max -
      rules.qpp.reductionPerMonthBefore65Min) *
      proportionOfMaximum
  );
}

function applyCppStartAgeAdjustment(
  monthlyAmountAt65: number,
  pensionStartAge: number,
  rules: CanadaRuleSet,
): number {
  const monthsFrom65 = Math.round((pensionStartAge - 65) * 12);

  if (monthsFrom65 < 0) {
    return (
      monthlyAmountAt65 *
      (1 - Math.abs(monthsFrom65) * rules.cpp.reductionPerMonthBefore65)
    );
  }

  if (monthsFrom65 > 0) {
    return monthlyAmountAt65 * (1 + monthsFrom65 * rules.cpp.increasePerMonthAfter65);
  }

  return monthlyAmountAt65;
}

function reverseCppStartAgeAdjustment(
  monthlyAmountAtStartAge: number,
  pensionStartAge: number,
  rules: CanadaRuleSet,
): number {
  const monthsFrom65 = Math.round((pensionStartAge - 65) * 12);

  if (monthsFrom65 < 0) {
    return (
      monthlyAmountAtStartAge /
      (1 - Math.abs(monthsFrom65) * rules.cpp.reductionPerMonthBefore65)
    );
  }

  if (monthsFrom65 > 0) {
    return monthlyAmountAtStartAge / (1 + monthsFrom65 * rules.cpp.increasePerMonthAfter65);
  }

  return monthlyAmountAtStartAge;
}

function applyOasStartAgeAdjustment(
  monthlyAmountAt65: number,
  oasStartAge: number,
  rules: CanadaRuleSet,
): number {
  const monthsFrom65 = Math.round((oasStartAge - 65) * 12);

  if (monthsFrom65 <= 0) {
    return monthlyAmountAt65;
  }

  return monthlyAmountAt65 * (1 + monthsFrom65 * rules.oas.increasePerMonthAfter65);
}

function getRrifMinimumFactor(rules: CanadaRuleSet, age: number): number {
  if (age <= 70) {
    return 1 / (90 - age);
  }

  if (age >= 95) {
    return 0.2;
  }

  return rules.rrif.allOtherRrifFactorsByAge[String(age)] ?? 0.2;
}

function resolveLockedInAccountPolicy(
  member: HouseholdMemberInput,
): HouseholdMemberInput["lockedInAccountPolicy"] {
  if (member.lockedInAccountPolicy) {
    return {
      preIncomeAccountLabel:
        member.lockedInAccountPolicy.preIncomeAccountLabel ??
        (member.lockedInAccountPolicy.jurisdiction === "QC" ? "CRI" : "LIRA"),
      incomeAccountLabel:
        member.lockedInAccountPolicy.incomeAccountLabel ??
        (member.lockedInAccountPolicy.jurisdiction === "QC" ? "FRV" : "LIF"),
      ...member.lockedInAccountPolicy,
    };
  }

  if ((member.accounts.lira ?? 0) <= 0 && (member.accounts.lif ?? 0) <= 0) {
    return undefined;
  }

  const inferredJurisdiction =
    member.profile.provinceAtRetirement === "ON" ||
    member.profile.provinceAtRetirement === "BC" ||
    member.profile.provinceAtRetirement === "AB" ||
    member.profile.provinceAtRetirement === "QC"
      ? member.profile.provinceAtRetirement
      : "Federal";

  return {
    jurisdiction: inferredJurisdiction,
    preIncomeAccountLabel: inferredJurisdiction === "QC" ? "CRI" : "LIRA",
    incomeAccountLabel: inferredJurisdiction === "QC" ? "FRV" : "LIF",
    plannedConversionAge: member.profile.retirementAge,
  };
}

function getLockedInIncomeAccountLabel(
  policy: HouseholdMemberInput["lockedInAccountPolicy"],
): string {
  if (!policy) {
    return "LIF";
  }

  return policy.incomeAccountLabel ?? (policy.jurisdiction === "QC" ? "FRV" : "LIF");
}

function inferLockedInMaximumWithdrawal(
  openingLifBalance: number,
  age: number,
  jurisdictionRule:
    | CanadaRuleSet["lockedIn"]["jurisdictions"][keyof CanadaRuleSet["lockedIn"]["jurisdictions"]]
    | undefined,
  assumedPreviousYearReturnRate: number,
): number {
  if (!jurisdictionRule) {
    return openingLifBalance;
  }

  if (
    jurisdictionRule.fallbackLongTermRate === undefined ||
    jurisdictionRule.annuityCertainEndAge === undefined
  ) {
    return openingLifBalance;
  }

  const laterPeriodRate =
    jurisdictionRule.withdrawalFactorLaterYearsRate ??
    (jurisdictionRule.applySixPercentFloor ? 0.06 : jurisdictionRule.fallbackLongTermRate);
  const firstPeriodRate = jurisdictionRule.applySixPercentFloor
    ? Math.max(jurisdictionRule.fallbackLongTermRate, laterPeriodRate)
    : jurisdictionRule.fallbackLongTermRate;
  const annuityPaymentFactor = calculateLifeIncomeFundMaximumFactor(
    age,
    firstPeriodRate,
    jurisdictionRule.withdrawalFactorHigherRateYears ??
      Math.max(0, jurisdictionRule.annuityCertainEndAge - age),
    laterPeriodRate,
    jurisdictionRule.annuityCertainEndAge,
  );
  const annuityBasedMaximum = openingLifBalance * annuityPaymentFactor;
  const investmentReturnMaximum =
    openingLifBalance * Math.max(0, assumedPreviousYearReturnRate);

  return Math.min(
    openingLifBalance,
    Math.max(annuityBasedMaximum, investmentReturnMaximum),
  );
}

function estimateQuebecTemporaryIncomeOtherIncomeProxy(
  frame: MemberFrame,
): number {
  return Math.max(
    0,
    frame.employmentIncome +
      frame.cppQppIncome +
      frame.oasIncome +
      frame.dbPensionIncome +
      frame.otherPlannedIncome,
  );
}

function calculateLifeIncomeFundMaximumFactor(
  age: number,
  firstPeriodRate: number,
  firstPeriodYears: number,
  laterPeriodRate: number,
  annuityCertainEndAge: number,
): number {
  if (age >= annuityCertainEndAge) {
    return 1;
  }

  let annuityDueFactor = 1;
  let cumulativeDiscountFactor = 1;
  const yearsRemaining = annuityCertainEndAge - age;

  for (let year = 1; year <= yearsRemaining; year += 1) {
    const annualDiscountRate =
      year <= firstPeriodYears ? firstPeriodRate : laterPeriodRate;
    cumulativeDiscountFactor *= 1 + annualDiscountRate;
    annuityDueFactor += 1 / cumulativeDiscountFactor;
  }

  return 1 / annuityDueFactor;
}

function buildYearWarnings(
  context: NormalizedContext,
  period: PeriodState,
  memberFrames: MemberFrame[],
  shortfallOrSurplus: number,
  remainingGap: number,
): string[] {
  const warnings: string[] = [];

  if (shortfallOrSurplus < 0 || remainingGap > 0.01) {
    warnings.push("Projected after-tax cash flow does not fully cover the modeled cash need.");
  }

  if (
    period.primaryAge >= 71 ||
    (period.partnerAge !== undefined && period.partnerAge >= 71)
  ) {
    warnings.push("RRIF minimum withdrawal rules may materially affect drawdown in this year.");
  }

  if (context.input.household.gisModelingEnabled) {
    warnings.push(
      "GIS / Allowance baseline is enabled. Review low-income years carefully because Service Canada uses prior-year income, July-to-June payment logic, and quarterly table changes that are only annualized in the current scaffold.",
    );
  }

  if (
    context.input.household.pensionIncomeSplittingEnabled &&
    context.input.household.householdType !== "single"
  ) {
    warnings.push(
      "Pension splitting heuristic optimizes planned eligible pension income before discretionary drawdown, not a full lifetime optimization.",
    );
  }

  if (context.input.household.withdrawalOrder === "custom") {
    warnings.push(
      "Custom withdrawal order is applied for supported account tokens, with any remaining accounts falling back to the blended default path.",
    );
  }

  if (
    context.input.household.householdType !== "single" &&
    memberFrames.filter((frame) => frame.isAlive).length === 1
  ) {
    warnings.push(
      "Survivor years currently use baseline spousal rollover, DB continuation, and partial CPP/QPP survivor-pension support, including baseline combined-benefit paths below age 65. Estate taxes, probate effects, and full combined-benefit math are still incomplete.",
    );

    if (context.input.household.expenseProfile.survivorSpendingPercentOfCouple === undefined) {
      warnings.push(
        "Survivor-year spending is using the baseline 72% couple-to-single spending assumption. Add expenseProfile.survivorSpendingPercentOfCouple when you want an explicit survivor spending path.",
      );
    }
  }

  if (memberFrames.some((frame) => frame.deathOccursThisYear)) {
    warnings.push(
      "Death-year cash flow uses a baseline mid-year death heuristic. Recurring income, contributions, and mandatory withdrawals are prorated to 50%, and couple spending transitions halfway toward the survivor path for that year.",
    );
  }

  for (const frame of memberFrames) {
    const benefits = frame.member.publicBenefits;
    const residenceYears =
      benefits.oasResidenceYearsOverride ??
      frame.member.profile.yearsResidedInCanadaAfter18;

    if (residenceYears > 0 && residenceYears < context.rules.oas.fullResidenceYearsAfter18) {
      warnings.push("Partial OAS case detected. Residence history must stay user-editable.");
    }

    if (
      frame.member.profile.pensionPlan === "QPP" &&
      benefits.cppQppEstimateMode !== "manual-at-start-age" &&
      benefits.pensionStartAge < 65
    ) {
      warnings.push(
        "QPP early-start reductions are modeled with a baseline set-proportion interpolation between the official 0.5% and 0.6% monthly factors. Use a manual amount at the chosen start age when you have a Retraite Quebec estimate.",
      );
    }

    if (benefits.hasSocialSecurityAgreementCountry) {
      warnings.push(
        "Social security agreement cases may change benefit eligibility and should be reviewed explicitly.",
      );
    }

    if (frame.province === "QC") {
      warnings.push(
        "Quebec cases currently use a scaffold tax path and should be validated against Quebec-specific rules as implementation deepens.",
      );
    }

    if ((frame.member.accounts.lira ?? 0) > 0 || (frame.member.accounts.lif ?? 0) > 0) {
      warnings.push(
        "Locked-in account logic is now baseline-supported, but institution-calculated annual maximums should override the fallback path when available.",
      );
    }

    if (
      frame.member.accounts.nonRegistered > 0 &&
      frame.member.taxableAccountTaxProfile?.nonRegisteredAdjustedCostBase === undefined
    ) {
      warnings.push(
        "Non-registered adjusted cost base was not provided. Taxable-account withdrawals currently assume the opening market value is the book cost until user-entered ACB is supplied.",
      );
    }

    if (
      (frame.member.taxableAccountTaxProfile?.nonRegisteredAdjustedCostBase ?? 0) >
      frame.member.accounts.nonRegistered + 0.01
    ) {
      warnings.push(
        "Non-registered adjusted cost base exceeds the current market value. Capital losses are now modeled with carryforward treatment, but terminal-return and carry-back handling remain outside the current scaffold.",
      );
    }

    if ((frame.member.taxableAccountTaxProfile?.annualInterestIncome ?? 0) > 0) {
      warnings.push(
        "Taxable-account interest income is being modeled as an explicit annual cash distribution. Make sure the portfolio return assumption excludes the same yield to avoid double counting.",
      );
    }

    if (
      (frame.member.taxableAccountTaxProfile?.annualEligibleDividendIncome ?? 0) > 0 ||
      (frame.member.taxableAccountTaxProfile?.annualNonEligibleDividendIncome ?? 0) > 0
    ) {
      warnings.push(
        "Taxable Canadian dividend income is now modeled with gross-up and dividend tax credits. Confirm the entered amount is the actual cash dividend, not the taxable slip amount.",
      );
      warnings.push(
        "Dividend-character support currently covers Canadian eligible and non-eligible dividends only. Foreign dividends are modeled separately as ordinary income, and return-of-capital distributions are modeled as ACB reductions rather than dividend income.",
      );
    }

    if ((frame.member.taxableAccountTaxProfile?.annualForeignDividendIncome ?? 0) > 0) {
      warnings.push(
        "Foreign dividend income is being modeled as ordinary taxable investment income. Federal foreign tax credit support is baseline-supported, and ON / BC / AB / QC provincial foreign tax credit support is now approximated. Treaty-specific and withholding-tax recovery detail are not yet modeled.",
      );
    }

    if ((frame.member.taxableAccountTaxProfile?.annualForeignNonBusinessIncomeTaxPaid ?? 0) > 0) {
      warnings.push(
        "Foreign tax paid is modeled with a baseline foreign tax credit approximation. ON / BC / AB / QC provincial residual-credit support is now included, while treaty-specific and multi-country detail are not yet modeled.",
      );
    }

    if (
      (frame.member.taxableAccountTaxProfile?.annualReturnOfCapitalDistribution ?? 0) > 0
    ) {
      warnings.push(
        "Return of capital is modeled as a non-taxable cash distribution that reduces both adjusted cost base and modeled non-registered market value. Make sure the same distribution is not also embedded in the portfolio return assumption.",
      );
    }
  }

  return warnings;
}

function estimateDeathYearFinalReturnAdjustment(
  context: NormalizedContext,
  period: PeriodState,
  memberFrames: MemberFrame[],
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  taxAttributes: HouseholdTaxAttributeLedger,
  balances: HouseholdLedger,
): DeathYearFinalReturnAdjustment {
  const terminalFrames = memberFrames.filter((frame) =>
    isDeathYearFinalReturnFrame(context, frame),
  );

  if (terminalFrames.length === 0) {
    return {
      taxAdjustment: 0,
      oasRecoveryTaxAdjustment: 0,
      taxableIncomeAdjustment: 0,
      warnings: [],
    };
  }

  const survivorFrames = memberFrames.filter(
    (frame) => frame.isAlive && !terminalFrames.some((terminal) => terminal.slot === frame.slot),
  );
  const survivorExists = survivorFrames.length === 1;

  let taxAdjustment = 0;
  let oasRecoveryTaxAdjustment = 0;
  let taxableIncomeAdjustment = 0;
  const warnings: string[] = [];

  for (const frame of terminalFrames) {
    const baseState = memberTaxState[frame.slot];

    if (!baseState) {
      continue;
    }

    const account = getAccountLedgerBySlot(balances, frame.slot);
    const estimate = estimateFinalReturnTaxIncrementForAccount(
      context,
      period.calendarYear,
      baseState,
      getTaxAttributeLedgerBySlot(taxAttributes, frame.slot),
      account,
      frame.member,
      survivorExists,
    );

    taxAdjustment += estimate.taxAdjustment;
    oasRecoveryTaxAdjustment += estimate.oasRecoveryTaxAdjustment;
    taxableIncomeAdjustment += estimate.taxableIncomeAdjustment;
    warnings.push(...estimate.warnings);

    if ((frame.member.accounts.dcPension ?? 0) > 0.01 || account.dcPension > 0.01) {
      warnings.push(
        `Death-year final return does not yet apply plan-specific death treatment to ${labelForSlot(
          frame.slot,
        ).toLowerCase()}'s DC pension balance. Estate and death-year tax output may still be understated or overstated for that account.`,
      );
    }
  }

  if (taxAdjustment !== 0 || oasRecoveryTaxAdjustment !== 0) {
    warnings.push(
      "Death-year final return now adds a baseline terminal tax adjustment for remaining registered balances and deemed taxable capital gains when no surviving spouse remains in the model. Optional returns and exact CRA final-return elections are still incomplete.",
    );
  } else if (survivorExists) {
    warnings.push(
      "Death-year final return is assuming baseline spousal continuation for estate-routed and spouse-designated assets while still taxing any registered balances explicitly marked for another direct beneficiary.",
    );
  }

  return {
    taxAdjustment,
    oasRecoveryTaxAdjustment,
    taxableIncomeAdjustment,
    warnings,
  };
}

function estimateDeathYearProbateSnapshot(
  context: NormalizedContext,
  period: PeriodState,
  memberFrames: MemberFrame[],
  balances: HouseholdLedger,
): DeathYearProbateSnapshot {
  const deathYearFrames = memberFrames.filter((frame) =>
    isDeathYearFinalReturnFrame(context, frame),
  );

  if (deathYearFrames.length === 0) {
    return {
      probateBaseValue: 0,
      probateExcludedAssets: 0,
      warnings: [],
    };
  }

  let probateBaseValue = 0;
  let probateExcludedAssets = 0;
  let knownProbateCost = 0;
  let probateCostIsFullyKnown = true;
  const estateProcedureLabels = new Set<string>();
  const warnings: string[] = [];

  for (const frame of deathYearFrames) {
    const survivorExists = memberFrames.some(
      (candidate) => candidate.slot !== frame.slot && candidate.isAlive,
    );
    const account = getAccountLedgerBySlot(balances, frame.slot);
    const registeredProbate = (
      ["rrsp", "rrif", "tfsa", "lira", "lif"] as const
    ).reduce((sum, accountKey) => {
      const amount = account[accountKey];
      if (amount <= 0.01) {
        return sum;
      }

      const designation = resolveBeneficiaryDesignation(
        frame.member,
        accountKey,
        survivorExists,
        warnings,
      );

      if (designation === "estate") {
        return sum + amount;
      }

      probateExcludedAssets += amount;
      return sum;
    }, 0);

    const nonRegisteredJointShare = resolveJointOwnershipExcludedAmount(
      frame.member,
      "nonRegistered",
      account.nonRegistered,
      survivorExists,
      warnings,
    );
    const cashJointShare = resolveJointOwnershipExcludedAmount(
      frame.member,
      "cash",
      account.cash,
      survivorExists,
      warnings,
    );

    const nonRegisteredProbate = Math.max(0, account.nonRegistered - nonRegisteredJointShare);
    const cashProbate = Math.max(0, account.cash - cashJointShare);
    const decedentProbateBase =
      registeredProbate + nonRegisteredProbate + cashProbate;
    probateBaseValue += decedentProbateBase;
    probateExcludedAssets += nonRegisteredJointShare + cashJointShare;

    if (nonRegisteredJointShare > 0.01 || cashJointShare > 0.01) {
      warnings.push(
        `Joint-ownership exclusions removed ${roundCurrency(
          nonRegisteredJointShare + cashJointShare,
        )} from ${labelForSlot(
          frame.slot,
        ).toLowerCase()}'s death-year estate-settlement proxy because those assets were marked as jointly held with the surviving spouse.`,
      );
    }

    const estateProcedureEstimate = estimateEstateSettlementCostForMember(
      frame.member,
      frame.member.profile.provinceAtRetirement,
      decedentProbateBase,
      warnings,
    );

    if (estateProcedureEstimate.procedureLabel) {
      estateProcedureLabels.add(estateProcedureEstimate.procedureLabel);
    }

    if (estateProcedureEstimate.cost === undefined) {
      probateCostIsFullyKnown = false;
    } else {
      knownProbateCost += estateProcedureEstimate.cost;
    }
  }

  const probateCost =
    probateBaseValue <= 0.01
      ? 0
      : probateCostIsFullyKnown
        ? knownProbateCost
        : undefined;

  if (probateBaseValue > 0.01 || probateExcludedAssets > 0.01) {
    warnings.push(
      `Death-year estate-settlement proxy for ${period.calendarYear} is a baseline estimate that excludes direct beneficiary designations and any user-entered joint-with-surviving-spouse shares, but still depends on real title form, beneficial ownership, and province-specific estate procedure.`,
    );
  }

  return {
    probateBaseValue,
    probateExcludedAssets,
    probateCost,
    estateProcedureLabel:
      estateProcedureLabels.size === 0
        ? undefined
        : estateProcedureLabels.size === 1
          ? Array.from(estateProcedureLabels)[0]
          : "Multiple estate procedures in the same calendar year",
    warnings,
  };
}

function isDeathYearFinalReturnFrame(
  context: NormalizedContext,
  frame: MemberFrame,
): boolean {
  if (!frame.isAlive) {
    return false;
  }

  if (frame.deathOccursThisYear) {
    return true;
  }

  return (
    context.input.household.householdType === "single" &&
    frame.age >= frame.member.profile.lifeExpectancy
  );
}

function estimateFinalReturnTaxIncrementForAccount(
  context: NormalizedContext,
  calendarYear: number,
  baseState: MemberTaxState,
  taxAttributeLedger: TaxAttributeLedger,
  account: AccountLedger,
  member: HouseholdMemberInput,
  survivorExists: boolean,
): DeathYearFinalReturnAdjustment {
  const capitalGainsInclusionRate =
    context.rules.taxableAccounts.capitalGainsInclusionRate;
  const taxableRegisteredAccounts: Array<[RegisteredAccountKey, number]> = [
    [
      "rrsp",
      shouldIncludeRegisteredAccountInFinalReturn(
        member,
        "rrsp",
        survivorExists,
      )
        ? account.rrsp
        : 0,
    ],
    [
      "rrif",
      shouldIncludeRegisteredAccountInFinalReturn(
        member,
        "rrif",
        survivorExists,
      )
        ? account.rrif
        : 0,
    ],
    [
      "lira",
      shouldIncludeRegisteredAccountInFinalReturn(
        member,
        "lira",
        survivorExists,
      )
        ? account.lira
        : 0,
    ],
    [
      "lif",
      shouldIncludeRegisteredAccountInFinalReturn(
        member,
        "lif",
        survivorExists,
      )
        ? account.lif
        : 0,
    ],
  ];
  const terminalOrdinaryIncome = taxableRegisteredAccounts.reduce(
    (sum, [, value]) => sum + value,
    0,
  );
  const terminalTaxableCapitalGains = survivorExists
    ? 0
    : Math.max(0, account.nonRegistered - account.nonRegisteredCostBase) *
      capitalGainsInclusionRate;
  const terminalAllowableCapitalLosses = survivorExists
    ? 0
    : Math.max(0, account.nonRegisteredCostBase - account.nonRegistered) *
      capitalGainsInclusionRate;
  const ordinaryTaxableIncome =
    baseState.ordinaryTaxableIncome + terminalOrdinaryIncome;
  const grossTaxableCapitalGains =
    baseState.grossTaxableCapitalGains + terminalTaxableCapitalGains;
  const allowableCapitalLossesCurrentYear =
    baseState.allowableCapitalLossesCurrentYear + terminalAllowableCapitalLosses;
  const currentYearNetCapitalLoss = Math.max(
    0,
    allowableCapitalLossesCurrentYear - grossTaxableCapitalGains,
  );
  const remainingTaxableCapitalGainsAfterCurrentLosses = Math.max(
    0,
    grossTaxableCapitalGains - allowableCapitalLossesCurrentYear,
  );
  const openingNetCapitalLossCarryforward = Math.max(
    0,
    taxAttributeLedger.netCapitalLossCarryforward,
  );
  const netCapitalLossCarryforwardUsed = Math.min(
    openingNetCapitalLossCarryforward,
    remainingTaxableCapitalGainsAfterCurrentLosses,
  );
  const taxableCapitalGains = Math.max(
    0,
    remainingTaxableCapitalGainsAfterCurrentLosses -
      netCapitalLossCarryforwardUsed,
  );
  const remainingCapitalLossPoolForOtherIncome = Math.max(
    0,
    openingNetCapitalLossCarryforward -
      netCapitalLossCarryforwardUsed +
      currentYearNetCapitalLoss,
  );
  const netOrdinaryTaxableIncome = Math.max(
    0,
    ordinaryTaxableIncome - remainingCapitalLossPoolForOtherIncome,
  );
  const taxableIncome = netOrdinaryTaxableIncome + taxableCapitalGains;
  const taxEstimate = estimateIncomeTax({
    taxableIncome,
    province: baseState.province,
    calendarYear,
    age: baseState.age,
    eligibleWorkIncome: baseState.eligibleWorkIncome,
    eligiblePensionIncome: baseState.eligiblePensionIncome,
    eligibleDividendIncome: baseState.eligibleDividendIncome,
    nonEligibleDividendIncome: baseState.nonEligibleDividendIncome,
    foreignNonBusinessIncome: baseState.foreignNonBusinessIncome,
    foreignNonBusinessIncomeTaxPaid: baseState.foreignNonBusinessIncomeTaxPaid,
  });
  const oasRecoveryTax = estimateOasRecoveryTax(
    context,
    calendarYear,
    taxableIncome,
    baseState.oasIncome,
  );
  const warnings = [...taxEstimate.warnings];

  for (const [accountKey, value] of taxableRegisteredAccounts) {
    if (value > 0.01) {
      warnings.push(
        `Death-year final return added ${roundCurrency(
          value,
        )} from the remaining ${accountKey} balance because that account was not modeled as a spouse-continuation transfer.`,
      );
    }
  }

  if (
    remainingCapitalLossPoolForOtherIncome > 0 &&
    ordinaryTaxableIncome > netOrdinaryTaxableIncome
  ) {
    warnings.push(
      "Death-year final return baseline lets available net capital losses reduce other income after taxable capital gains are exhausted, consistent with CRA final-return treatment. GRE carryback elections still remain outside the current scaffold.",
    );
  }

  if (terminalTaxableCapitalGains > 0) {
    warnings.push(
      `Death-year final return added ${roundCurrency(
        terminalTaxableCapitalGains,
      )} of taxable capital gains from the deemed disposition of remaining non-registered assets.`,
    );
  } else if (survivorExists && account.nonRegistered > 0.01) {
    warnings.push(
      "Death-year final return did not trigger a deemed disposition on remaining non-registered assets because the current survivor baseline assumes estate-routed capital property continues to the surviving spouse unless joint-ownership or beneficiary rules say otherwise.",
    );
  }

  if (terminalAllowableCapitalLosses > 0) {
    warnings.push(
      `Death-year final return recognized ${roundCurrency(
        terminalAllowableCapitalLosses,
      )} of allowable capital losses from remaining non-registered assets on the final return baseline.`,
    );
  }

  return {
    taxAdjustment: taxEstimate.totalTax - baseState.taxes,
    oasRecoveryTaxAdjustment: oasRecoveryTax - baseState.oasRecoveryTax,
    taxableIncomeAdjustment: taxableIncome - baseState.taxableIncome,
    warnings,
  };
}

function summarizeProjection(
  context: NormalizedContext,
  years: ProjectionYear[],
  balances: HouseholdLedger,
  taxAttributes: HouseholdTaxAttributeLedger,
): SimulationSummary {
  const firstShortfall = years.find((year) => year.shortfallOrSurplus < 0);
  const terminalEstateEstimate = estimateTerminalEstate(
    context,
    years,
    balances,
    taxAttributes,
  );
  const notableWarnings = Array.from(
    new Set([
      ...years.flatMap((year) => year.warnings),
      ...terminalEstateEstimate.warnings,
    ]),
  );
  const estimatedEstateValue = terminalEstateEstimate.grossEstateValue;
  const initialReadiness = firstShortfall
    ? "shortfall"
    : estimatedEstateValue < (years.at(-1)?.spending ?? 0)
      ? "borderline"
      : "on-track";

  return {
    initialReadiness,
    firstShortfallYear: firstShortfall?.calendarYear,
    lastProjectionYear: years.at(-1)?.calendarYear ?? new Date().getFullYear(),
    estimatedEstateValue: roundCurrency(estimatedEstateValue),
    estimatedAfterTaxEstateValue: roundCurrency(
      terminalEstateEstimate.afterTaxEstateValue,
    ),
    estimatedTerminalTaxLiability: roundCurrency(
      terminalEstateEstimate.terminalTaxLiability,
    ),
    estimatedProbateAndEstateAdminCost:
      terminalEstateEstimate.probateOrEstateAdminCost === undefined
        ? undefined
        : roundCurrency(terminalEstateEstimate.probateOrEstateAdminCost),
    estimatedEstateProcedure: terminalEstateEstimate.estateProcedureLabel,
    notableWarnings,
  };
}

function estimateTerminalEstate(
  context: NormalizedContext,
  years: ProjectionYear[],
  balances: HouseholdLedger,
  taxAttributes: HouseholdTaxAttributeLedger,
): TerminalEstateEstimate {
  const grossEstateValue = sumBalances(balances);
  const lastYear = years.at(-1);
  const warnings: string[] = [];

  if (!lastYear) {
    return {
      grossEstateValue,
      afterTaxEstateValue: grossEstateValue,
      terminalTaxLiability: 0,
      warnings,
    };
  }

  const projectionReachedLastModeledDeaths = getMemberEntries(context.input).every(
    ({ slot, member }) =>
      getAgeBySlot(lastYear, slot) >= member.profile.lifeExpectancy,
  );

  if (!projectionReachedLastModeledDeaths) {
    warnings.push(
      "Projection ended before the latest modeled death. After-tax estate values currently assume the household liquidates all modeled accounts at the projection horizon rather than at the actual future death date.",
    );
  }

  let terminalTaxLiability = 0;

  for (const { slot, member } of getMemberEntries(context.input)) {
    const account = getAccountLedgerBySlot(balances, slot);
    const grossSlotEstateValue = sumAccountLedger(account);

    if (grossSlotEstateValue <= 0.01) {
      continue;
    }

    const age = getAgeBySlot(lastYear, slot);
    const realizedCapitalGain = Math.max(
      0,
      account.nonRegistered - account.nonRegisteredCostBase,
    );
    const allowableCapitalLossFromTerminalDisposition =
      Math.max(0, account.nonRegisteredCostBase - account.nonRegistered) *
      context.rules.taxableAccounts.capitalGainsInclusionRate;
    const openingNetCapitalLossCarryforward = Math.max(
      0,
      getTaxAttributeLedgerBySlot(taxAttributes, slot).netCapitalLossCarryforward,
    );
    const taxableCapitalGainFromTerminalDisposition =
      realizedCapitalGain * context.rules.taxableAccounts.capitalGainsInclusionRate;
    const totalTerminalCapitalLossPool =
      openingNetCapitalLossCarryforward +
      allowableCapitalLossFromTerminalDisposition;
    const remainingCapitalLossPoolAfterGains = Math.max(
      0,
      totalTerminalCapitalLossPool - taxableCapitalGainFromTerminalDisposition,
    );
    const netTaxableCapitalGain = Math.max(
      0,
      taxableCapitalGainFromTerminalDisposition - totalTerminalCapitalLossPool,
    );
    const terminalOrdinaryIncome =
      account.rrsp + account.rrif + account.lira + account.lif;
    const netTerminalOrdinaryIncome = Math.max(
      0,
      terminalOrdinaryIncome - remainingCapitalLossPoolAfterGains,
    );

    if (
      remainingCapitalLossPoolAfterGains > 0 &&
      terminalOrdinaryIncome > 0
    ) {
      warnings.push(
        `Terminal estate estimate used ${roundCurrency(
          Math.min(terminalOrdinaryIncome, remainingCapitalLossPoolAfterGains),
        )} of ${labelForSlot(
          slot,
        ).toLowerCase()}'s available net capital losses against other income on the final return baseline.`,
      );
    }

    if (account.dcPension > 0.01) {
      warnings.push(
        `Terminal estate estimate does not yet apply death-time tax or beneficiary treatment to ${labelForSlot(
          slot,
        ).toLowerCase()}'s defined-contribution pension balance. Probate and after-tax estate values may be overstated until DC pension death rules are modeled.`,
      );
    }

    const terminalTaxEstimate = estimateIncomeTax({
      taxableIncome: netTerminalOrdinaryIncome + netTaxableCapitalGain,
      province: member.profile.provinceAtRetirement,
      calendarYear: lastYear.calendarYear,
      age,
      eligiblePensionIncome: 0,
    });
    terminalTaxLiability += terminalTaxEstimate.totalTax;
  }

  const probateOrEstateAdminCostEstimate = estimateProbateOrEstateAdminCost(
    context,
    years,
    balances,
    warnings,
  );
  const afterTaxEstateValue = Math.max(
    0,
    grossEstateValue -
      terminalTaxLiability -
      (probateOrEstateAdminCostEstimate.cost ?? 0),
  );

  return {
    grossEstateValue,
    afterTaxEstateValue,
    terminalTaxLiability,
    probateOrEstateAdminCost: probateOrEstateAdminCostEstimate.cost,
    estateProcedureLabel: probateOrEstateAdminCostEstimate.procedureLabel,
    warnings,
  };
}

function estimateProbateOrEstateAdminCost(
  context: NormalizedContext,
  years: ProjectionYear[],
  balances: HouseholdLedger,
  warnings: string[],
): { cost: number | undefined; procedureLabel?: string } {
  const lastYear = years.at(-1);

  if (!lastYear) {
    return { cost: undefined };
  }

  const projectionReachedLastModeledDeaths = getMemberEntries(context.input).every(
    ({ slot, member }) =>
      getAgeBySlot(lastYear, slot) >= member.profile.lifeExpectancy,
  );

  if (!projectionReachedLastModeledDeaths) {
    return { cost: undefined };
  }

  const probateBaseValue = sumProbateProxyBalances(context, balances, warnings);

  if (probateBaseValue <= 0.01) {
    return { cost: 0 };
  }

  const terminalEstateMember = resolveTerminalEstateMember(context, years, balances);
  const province = terminalEstateMember.profile.provinceAtRetirement;

  warnings.push(
    "Probate / estate administration cost is a baseline proxy that assumes the modeled estate requires a grant or certificate and that beneficiary designations or joint ownership have not removed assets from the estate.",
  );

  if (sumDcPensionBalances(balances) > 0.01) {
    warnings.push(
      "Probate proxy excludes modeled DC pension balances because beneficiary treatment and plan-level estate rules are not yet modeled.",
    );
  }

  return estimateEstateSettlementCostForMember(
    terminalEstateMember,
    province,
    probateBaseValue,
    warnings,
  );
}

function buildAssumptionList(context: NormalizedContext): string[] {
  return [
    `Projection starts in ${context.input.household.projectionStartYear}.`,
    `Inflation assumption: ${(context.input.household.inflationRate * 100).toFixed(2)}%.`,
    `Pre-retirement return assumption: ${(context.input.household.preRetirementReturnRate * 100).toFixed(2)}%.`,
    `Post-retirement return assumption: ${(context.input.household.postRetirementReturnRate * 100).toFixed(2)}%.`,
    "Tax estimates currently use 2026 federal and selected provincial tables with basic personal, age, and pension-income credits for federal, Ontario, British Columbia, and Alberta, plus a Quebec path that now includes dividend handling, residual foreign tax credits, a baseline career-extension credit, and a household-level Schedule B age, living-alone, and retirement-income approximation.",
    "OAS recovery tax is estimated with prior-year threshold mapping and capped by modeled OAS income.",
    "Drawdown currently supports a practical blended heuristic, not full optimization.",
    "Locked-in accounts now support baseline LIRA-to-LIF conversion, RRIF-style minimums, and jurisdiction-aware fallback maximums. Quebec FRV modeling recognizes the 2025+ no-maximum rule at age 55+, and under age 55 it can approximate a start-of-year temporary-income election when the request and declaration inputs are supplied. Manual annual overrides remain preferred when available.",
    "Non-registered withdrawals now track adjusted cost base, realize taxable capital gains, and carry forward net capital losses using the baseline Canadian inclusion rate, while explicit taxable-account interest, foreign dividends, Canadian eligible / non-eligible dividends, and return-of-capital cash distributions can be modeled annually. Return-of-capital distributions also reduce modeled non-registered market value. Baseline federal foreign tax credit support is now joined by ON / BC / AB / QC provincial residual-credit support for foreign non-business income, while exact form-level detail, treaty-specific cases, and carry-back or terminal-loss handling remain incomplete.",
    "Pension splitting currently uses an annual household heuristic on planned eligible pension income before discretionary registered drawdown.",
    "QPP delayed-start increases are now baseline-supported through age 72, while early-start QPP reductions use a set-proportion approximation unless a manual start-age amount is provided.",
    "Immigrant and partial-benefit support is modeled through statement, manual, residence-year, and foreign-pension inputs.",
    "GIS / Allowance now use a baseline prior-year assessable-income path with a work-income exemption and annualized quarterly OAS tables when published. The first projection year falls back to a current-year proxy unless household.incomeTestedBenefitsBaseIncome is supplied, while exact July-to-June reassessment timing and top-up mechanics are still simplified.",
    "Survivor years now include baseline CPP/QPP survivor-pension support, including capped or warning-heavy combined-benefit paths when the surviving spouse is already receiving retirement benefits, but full Service Canada / Retraite Quebec combined-benefit math remains incomplete.",
    "Survivor-year spending defaults to 72% of the couple after-tax spending target unless expenseProfile.survivorSpendingPercentOfCouple is explicitly provided.",
    "Death years use a baseline mid-year heuristic: recurring income, contributions, and mandatory RRIF/LIF withdrawals are prorated to 50%, and couple spending transitions halfway toward the survivor spending path for that year.",
    "Death-year annual results now add a baseline CRA final-return adjustment. Registered accounts marked for a surviving spouse can defer terminal income on the current baseline, registered accounts marked for another direct beneficiary still trigger terminal tax while leaving the surviving household, and user-entered joint-with-surviving-spouse shares can reduce the death-year estate-settlement proxy for cash and non-registered assets. Quebec will-form branching is now baseline-supported when estateAdministrationProfile is supplied, but optional returns and broader beneficial-ownership analysis remain separate roadmap items.",
    "Projection length now follows the longest modeled remaining lifetime in the household, capped by household.maxProjectionAge relative to the primary member's age.",
    "Summary estate values now include a baseline projection-end liquidation proxy: remaining RRSP / RRIF / LIRA / LIF balances are treated as taxable on a terminal return, net capital losses can offset capital gains and then other income on a final-return baseline, ON / BC / AB probate-style estate administration costs are approximated when the projection reaches the modeled final death, and Quebec notarial-versus-verification branching can now be reflected when estateAdministrationProfile is supplied. Direct beneficiary designations can now remove registered assets from the probate proxy, while broader joint ownership, exact Quebec verification fees, and DC pension death treatment remain incomplete.",
  ];
}

function getMemberEntries(
  input: SimulationInput,
): Array<{ slot: MemberSlot; member: HouseholdMemberInput }> {
  return input.household.partner
    ? [
        { slot: "primary", member: input.household.primary },
        { slot: "partner", member: input.household.partner },
      ]
    : [{ slot: "primary", member: input.household.primary }];
}

function getAccountLedgerBySlot(
  balances: HouseholdLedger,
  slot: MemberSlot,
): AccountLedger {
  return slot === "primary" ? balances.primary : balances.partner!;
}

function getTaxAttributeLedgerBySlot(
  taxAttributes: HouseholdTaxAttributeLedger,
  slot: MemberSlot,
): TaxAttributeLedger {
  return slot === "primary" ? taxAttributes.primary : taxAttributes.partner!;
}

function estimateScheduledCashFlowTotal(
  flows: HouseholdMemberInput["annuityIncome"],
  age: number,
): number {
  if (!flows || flows.length === 0) {
    return 0;
  }

  return flows.reduce((sum, flow) => {
    const hasStarted = age >= flow.startAge;
    const hasEnded = flow.endAge !== undefined && age > flow.endAge;

    if (!hasStarted || hasEnded) {
      return sum;
    }

    return sum + flow.annualAmount;
  }, 0);
}

function collectTaxWarnings(
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
): string[] {
  return Object.values(memberTaxState)
    .flatMap((state) => state?.warnings ?? []);
}

function sumMemberFrames(
  memberFrames: MemberFrame[],
  selector: (frame: MemberFrame) => number,
): number {
  return memberFrames.reduce((sum, frame) => sum + selector(frame), 0);
}

function sumMemberTaxState(
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  selector: (state: MemberTaxState) => number,
): number {
  return Object.values(memberTaxState).reduce((sum, state) => {
    if (!state) {
      return sum;
    }

    return sum + selector(state);
  }, 0);
}

function sumBalances(balances: HouseholdLedger): number {
  return sumAccountLedger(balances.primary) + (balances.partner ? sumAccountLedger(balances.partner) : 0);
}

function sumProbateProxyBalances(
  context: NormalizedContext,
  balances: HouseholdLedger,
  warnings: string[],
): number {
  return (
    sumProbateProxyAccountBalances(
      context.input.household.primary,
      balances.primary,
      false,
      warnings,
    ) +
    (balances.partner
      ? sumProbateProxyAccountBalances(
          context.input.household.partner!,
          balances.partner,
          false,
          warnings,
        )
      : 0)
  );
}

function sumProbateProxyAccountBalances(
  member: HouseholdMemberInput,
  account: AccountLedger,
  survivorExists: boolean,
  warnings: string[],
): number {
  return (
    resolveProbateProxyAccountAmount(
      member,
      "rrsp",
      account.rrsp,
      survivorExists,
      warnings,
    ) +
    resolveProbateProxyAccountAmount(
      member,
      "rrif",
      account.rrif,
      survivorExists,
      warnings,
    ) +
    resolveProbateProxyAccountAmount(
      member,
      "tfsa",
      account.tfsa,
      survivorExists,
      warnings,
    ) +
    account.nonRegistered +
    account.cash +
    resolveProbateProxyAccountAmount(
      member,
      "lira",
      account.lira,
      survivorExists,
      warnings,
    ) +
    resolveProbateProxyAccountAmount(
      member,
      "lif",
      account.lif,
      survivorExists,
      warnings,
    )
  );
}

function sumDcPensionBalances(balances: HouseholdLedger): number {
  return balances.primary.dcPension + (balances.partner?.dcPension ?? 0);
}

function sumAccountLedger(account: AccountLedger): number {
  return (
    account.rrsp +
    account.rrif +
    account.tfsa +
    account.nonRegistered +
    account.cash +
    account.lira +
    account.lif +
    account.dcPension
  );
}

function toAccountLedger(member: HouseholdMemberInput): AccountLedger {
  const accounts = member.accounts;

  return {
    rrsp: accounts.rrsp,
    rrif: accounts.rrif,
    tfsa: accounts.tfsa,
    nonRegistered: accounts.nonRegistered,
    nonRegisteredCostBase:
      accounts.nonRegistered > 0
        ? Math.max(
            0,
            member.taxableAccountTaxProfile?.nonRegisteredAdjustedCostBase ??
              accounts.nonRegistered,
          )
        : 0,
    cash: accounts.cash ?? 0,
    lira: accounts.lira ?? 0,
    lif: accounts.lif ?? 0,
    dcPension: accounts.dcPension ?? 0,
  };
}

function cloneHouseholdLedger(balances: HouseholdLedger): HouseholdLedger {
  return {
    primary: { ...balances.primary },
    partner: balances.partner ? { ...balances.partner } : undefined,
  };
}

function cloneHouseholdTaxAttributeLedger(
  taxAttributes: HouseholdTaxAttributeLedger,
): HouseholdTaxAttributeLedger {
  return {
    primary: { ...taxAttributes.primary },
    partner: taxAttributes.partner ? { ...taxAttributes.partner } : undefined,
  };
}

function buildNextHouseholdTaxAttributeLedger(
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
  priorTaxAttributes: HouseholdTaxAttributeLedger,
): HouseholdTaxAttributeLedger {
  return {
    primary: {
      netCapitalLossCarryforward:
        memberTaxState.primary?.closingNetCapitalLossCarryforward ??
        priorTaxAttributes.primary.netCapitalLossCarryforward,
    },
    partner: priorTaxAttributes.partner
      ? {
          netCapitalLossCarryforward:
            memberTaxState.partner?.closingNetCapitalLossCarryforward ??
            priorTaxAttributes.partner.netCapitalLossCarryforward,
        }
      : undefined,
  };
}

function resolveHouseholdCashReserveSlot(memberFrames: MemberFrame[]): MemberSlot {
  const primaryIsAlive = memberFrames.some(
    (frame) => frame.slot === "primary" && frame.isAlive,
  );
  const partnerIsAlive = memberFrames.some(
    (frame) => frame.slot === "partner" && frame.isAlive,
  );

  if (primaryIsAlive) {
    return "primary";
  }

  if (partnerIsAlive) {
    return "partner";
  }

  return "primary";
}

function roundAccountRecord(account: AccountLedger): Record<string, number> {
  return {
    rrsp: roundCurrency(account.rrsp),
    rrif: roundCurrency(account.rrif),
    tfsa: roundCurrency(account.tfsa),
    nonRegistered: roundCurrency(account.nonRegistered),
    nonRegisteredAdjustedCostBase: roundCurrency(account.nonRegisteredCostBase),
    cash: roundCurrency(account.cash),
    lira: roundCurrency(account.lira),
    lif: roundCurrency(account.lif),
    dcPension: roundCurrency(account.dcPension),
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function labelForSlot(slot: MemberSlot): string {
  return slot === "primary" ? "Primary household member" : "Partner";
}

function resolveBeneficiaryDesignation(
  member: HouseholdMemberInput,
  accountKey: RegisteredAccountKey,
  survivorExists: boolean,
  warnings: string[],
): BeneficiaryDesignationType {
  const designation = member.beneficiaryDesignations?.[accountKey] ?? "estate";

  if (designation === "spouse" && !survivorExists) {
    warnings.push(
      `${accountKey} is marked with a spouse beneficiary designation, but no surviving spouse remains in the current modeled path. The engine is falling back to estate treatment for that account.`,
    );
    return "estate";
  }

  if (member.profile.provinceAtRetirement === "QC" && accountKey === "tfsa" && designation !== "estate") {
    warnings.push(
      "Quebec TFSA beneficiary and successor-holder treatment depends on the account arrangement and Quebec succession law. The current scaffold still lets the user mark the account as bypassing probate, but this should be reviewed manually for Quebec cases.",
    );
  }

  return designation;
}

function shouldIncludeRegisteredAccountInFinalReturn(
  member: HouseholdMemberInput,
  accountKey: RegisteredAccountKey,
  survivorExists: boolean,
): boolean {
  const designation = member.beneficiaryDesignations?.[accountKey] ?? "estate";

  if (designation === "other-beneficiary") {
    return true;
  }

  if (designation === "spouse") {
    return !survivorExists;
  }

  return !survivorExists;
}

function resolveProbateProxyAccountAmount(
  member: HouseholdMemberInput,
  accountKey: RegisteredAccountKey,
  amount: number,
  survivorExists: boolean,
  warnings: string[],
): number {
  if (amount <= 0.01) {
    return 0;
  }

  const designation = resolveBeneficiaryDesignation(
    member,
    accountKey,
    survivorExists,
    warnings,
  );

  return designation === "estate" ? amount : 0;
}

function resolveJointOwnershipExcludedAmount(
  member: HouseholdMemberInput,
  assetKey: "nonRegistered" | "cash",
  amount: number,
  survivorExists: boolean,
  warnings: string[],
): number {
  if (amount <= 0.01 || !survivorExists) {
    return 0;
  }

  const configuredPercent =
    assetKey === "nonRegistered"
      ? member.jointOwnershipProfile?.nonRegisteredJointWithSurvivingSpousePercent ?? 0
      : member.jointOwnershipProfile?.cashJointWithSurvivingSpousePercent ?? 0;
  const excludedPercent = clampRate(configuredPercent);

  if (configuredPercent > 1) {
    warnings.push(
      `${assetKey} joint-ownership percent was above 100%, so it was capped at 100% for the probate baseline.`,
    );
  }

  if (excludedPercent <= 0) {
    return 0;
  }

  return amount * excludedPercent;
}

function getAgeBySlot(year: ProjectionYear, slot: MemberSlot): number {
  return slot === "primary" ? year.primaryAge : year.partnerAge ?? year.primaryAge;
}

function resolveTerminalEstateProvince(
  context: NormalizedContext,
  years: ProjectionYear[],
  balances: HouseholdLedger,
): ProvinceCode {
  return resolveTerminalEstateMember(context, years, balances).profile.provinceAtRetirement;
}

function resolveTerminalEstateMember(
  context: NormalizedContext,
  years: ProjectionYear[],
  balances: HouseholdLedger,
): HouseholdMemberInput {
  const lastYear = years.at(-1);

  if (!lastYear) {
    return context.input.household.primary;
  }

  const slotBalances: Array<{ slot: MemberSlot; balance: number }> = [
    {
      slot: "primary",
      balance: sumProbateProxyAccountBalances(
        context.input.household.primary,
        balances.primary,
        false,
        [],
      ),
    },
  ];

  if (balances.partner) {
    slotBalances.push({
      slot: "partner",
      balance: sumProbateProxyAccountBalances(
        context.input.household.partner!,
        balances.partner,
        false,
        [],
      ),
    });
  }

  const selectedSlot =
    slotBalances.sort((left, right) => right.balance - left.balance)[0]?.slot ??
    "primary";
  const member = getMemberEntries(context.input).find(
    (entry) => entry.slot === selectedSlot,
  )?.member;

  if (!member) {
    return context.input.household.primary;
  }

  const ageGapToLifeExpectancy =
    member.profile.lifeExpectancy - getAgeBySlot(lastYear, selectedSlot);

  if (ageGapToLifeExpectancy > 0.01) {
    return context.input.household.primary;
  }

  return member;
}

function estimateOntarioEstateAdministrationTax(estateValue: number): number {
  if (estateValue <= 50_000) {
    return 0;
  }

  return Math.ceil((estateValue - 50_000) / 1_000) * 15;
}

function estimateBritishColumbiaProbateFee(estateValue: number): number {
  if (estateValue <= 25_000) {
    return 0;
  }

  const firstBand = Math.max(
    0,
    Math.min(estateValue, 50_000) - 25_000,
  );
  const secondBand = Math.max(0, estateValue - 50_000);

  return Math.ceil(firstBand / 1_000) * 6 + Math.ceil(secondBand / 1_000) * 14;
}

function estimateAlbertaProbateFee(estateValue: number): number {
  if (estateValue <= 10_000) {
    return 35;
  }

  if (estateValue <= 25_000) {
    return 135;
  }

  if (estateValue <= 125_000) {
    return 275;
  }

  if (estateValue <= 250_000) {
    return 400;
  }

  return 525;
}

function estimateProvinceProbateCost(
  province: ProvinceCode,
  estateValue: number,
  warnings: string[],
): number | undefined {
  switch (province) {
    case "ON":
      return estimateOntarioEstateAdministrationTax(estateValue);
    case "BC":
      return estimateBritishColumbiaProbateFee(estateValue);
    case "AB":
      return estimateAlbertaProbateFee(estateValue);
    case "QC":
      warnings.push(
        "Quebec death-year probate cost is not being estimated because verification depends heavily on will form and Quebec succession procedure.",
      );
      return undefined;
    default:
      warnings.push(
        `Death-year probate cost is not yet modeled for ${province}.`,
      );
      return undefined;
  }
}

function estimateEstateSettlementCostForMember(
  member: HouseholdMemberInput,
  province: ProvinceCode,
  estateValue: number,
  warnings: string[],
): { cost: number | undefined; procedureLabel?: string } {
  switch (province) {
    case "ON":
      return {
        cost: estimateOntarioEstateAdministrationTax(estateValue),
        procedureLabel: "Ontario certificate of appointment proxy",
      };
    case "BC":
      return {
        cost: estimateBritishColumbiaProbateFee(estateValue),
        procedureLabel: "British Columbia probate fee proxy",
      };
    case "AB":
      return {
        cost: estimateAlbertaProbateFee(estateValue),
        procedureLabel: "Alberta probate fee proxy",
      };
    case "QC":
      return estimateQuebecEstateSettlementCost(member, warnings);
    default:
      warnings.push(
        `Probate proxy is not yet modeled for ${province}. Gross and after-tax estate values currently exclude province-specific estate administration costs there.`,
      );
      return {
        cost: undefined,
        procedureLabel: `${province} estate procedure not modeled`,
      };
  }
}

function estimateQuebecEstateSettlementCost(
  member: HouseholdMemberInput,
  warnings: string[],
): { cost: number | undefined; procedureLabel?: string } {
  const profile = member.estateAdministrationProfile;
  const willForm = profile?.quebecWillForm ?? "unknown";
  const verificationMethod =
    profile?.quebecWillVerificationMethod ??
    (willForm === "notarial" ? "not-required" : "unknown");
  const manualCost = profile?.manualQuebecVerificationCost;

  if (willForm === "notarial") {
    if (manualCost !== undefined) {
      warnings.push(
        "Quebec notarial will path is using a manual estate-settlement cost override. Verification is still assumed not to be required.",
      );
      return {
        cost: Math.max(0, manualCost),
        procedureLabel: "Quebec notarial will (no verification required)",
      };
    }

    warnings.push(
      "Quebec notarial will path assumes no probate or verification cost. Will-search certificates, liquidator fees, and optional professional fees are not modeled unless a manualQuebecVerificationCost override is supplied.",
    );
    return {
      cost: 0,
      procedureLabel: "Quebec notarial will (no verification required)",
    };
  }

  const procedureLabel =
    verificationMethod === "court"
      ? "Quebec will verification by Superior Court"
      : verificationMethod === "notary"
        ? "Quebec will verification by notary"
        : "Quebec non-notarial will verification required";

  if (manualCost !== undefined) {
    warnings.push(
      "Quebec non-notarial will path is using a manual verification-cost override. Court or notary fees beyond that override are not separately modeled.",
    );
    return {
      cost: Math.max(0, manualCost),
      procedureLabel,
    };
  }

  warnings.push(
    "Quebec holograph and witnessed wills generally require verification by a notary or the Superior Court. Add estateAdministrationProfile.manualQuebecVerificationCost when you want the model to reflect that estate-settlement cost.",
  );
  return {
    cost: undefined,
    procedureLabel,
  };
}

function clampRate(value: number): number {
  return Math.min(1, Math.max(0, value));
}
