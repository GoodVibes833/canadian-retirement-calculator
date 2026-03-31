import type {
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

interface SingleYearProjection {
  output: ProjectionYear;
  nextBalances: HouseholdLedger;
  nextTaxAttributes: HouseholdTaxAttributeLedger;
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
  const years: ProjectionYear[] = [];

  for (const period of timeline) {
    const projectedYear = projectSingleYear(
      context,
      period,
      balances,
      taxAttributes,
    );
    years.push(projectedYear.output);
    balances = projectedYear.nextBalances;
    taxAttributes = projectedYear.nextTaxAttributes;
  }

  const summary = summarizeProjection(years, balances);

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
  const finalAge = Math.min(
    household.maxProjectionAge,
    Math.max(
      household.primary.profile.lifeExpectancy,
      household.partner?.profile.lifeExpectancy ?? household.primary.profile.lifeExpectancy,
    ),
  );
  const length = Math.max(
    0,
    finalAge - household.primary.profile.currentAge + 1,
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
): SingleYearProjection {
  let balances = cloneHouseholdLedger(openingBalances);
  const taxAttributes = cloneHouseholdTaxAttributeLedger(openingTaxAttributes);
  const warnings: string[] = [];
  const memberFrames = buildMemberFrames(context, period);
  applySurvivorAdjustments(memberFrames, balances, warnings);
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

  const beforeTaxIncome =
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
  const taxes = sumMemberTaxState(memberTaxState, (state) => state.taxes);
  const oasRecoveryTax = sumMemberTaxState(
    memberTaxState,
    (state) => state.oasRecoveryTax,
  );
  const afterTaxIncome =
    baseAfterTaxCash +
    incomeTestedBenefits.totalAnnual +
    drawdown.netFromWithdrawals +
    quebecTaxReliefMeasuresCreditApplied;
  const shortfallOrSurplus = afterTaxIncome - requiredCash;

  if (shortfallOrSurplus > 0) {
    const cashReserveSlot = resolveHouseholdCashReserveSlot(memberFrames);
    getAccountLedgerBySlot(balances, cashReserveSlot).cash += shortfallOrSurplus;
  }

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

function buildMemberFrames(
  context: NormalizedContext,
  period: PeriodState,
): MemberFrame[] {
  const yearsFromStart =
    period.calendarYear - context.input.household.projectionStartYear;

  return getMemberEntries(context.input).map(({ slot, member }) => {
    const age = slot === "primary" ? period.primaryAge : period.partnerAge ?? 0;
    const isAlive = age <= member.profile.lifeExpectancy;
    const isRetired = age >= member.profile.retirementAge;

    return {
      slot,
      member,
      age,
      province: member.profile.provinceAtRetirement,
      isAlive,
      isRetired,
      employmentIncome: estimateEmploymentIncome(member, age, yearsFromStart),
      rrspContribution: estimateContribution(
        member.contributions.rrsp,
        member.contributions.contributionEscalationRate,
        yearsFromStart,
        isAlive && !isRetired,
      ),
      tfsaContribution: estimateContribution(
        member.contributions.tfsa,
        member.contributions.contributionEscalationRate,
        yearsFromStart,
        isAlive && !isRetired,
      ),
      nonRegisteredContribution: estimateContribution(
        member.contributions.nonRegistered,
        member.contributions.contributionEscalationRate,
        yearsFromStart,
        isAlive && !isRetired,
      ),
      cppQppIncome: estimateCppOrQppIncome(context, member, age, isAlive),
      oasIncome: estimateOasIncome(context, member, age, isAlive),
      dbPensionIncome: estimateDbPensionIncome(member, age, isAlive),
      annuityIncome: estimateScheduledCashFlowTotal(member.annuityIncome, age),
      rentalIncome: estimateScheduledCashFlowTotal(member.rentalIncome, age),
      foreignPensionIncome: estimateScheduledCashFlowTotal(
        member.foreignPensionIncome,
        age,
      ),
      taxableInterestIncome: member.taxableAccountTaxProfile?.annualInterestIncome ?? 0,
      eligibleDividendIncome:
        member.taxableAccountTaxProfile?.annualEligibleDividendIncome ?? 0,
      nonEligibleDividendIncome:
        member.taxableAccountTaxProfile?.annualNonEligibleDividendIncome ?? 0,
      foreignDividendIncome:
        member.taxableAccountTaxProfile?.annualForeignDividendIncome ?? 0,
      foreignNonBusinessIncomeTaxPaid:
        member.taxableAccountTaxProfile?.annualForeignNonBusinessIncomeTaxPaid ?? 0,
      returnOfCapitalDistribution:
        member.taxableAccountTaxProfile?.annualReturnOfCapitalDistribution ?? 0,
      deemedCapitalGainFromReturnOfCapital: 0,
      taxableCapitalGainFromReturnOfCapital: 0,
      otherPlannedIncome: estimateOtherPlannedIncome(member, age, isAlive),
    };
  });
}

function applySurvivorAdjustments(
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
  const deceasedBalance = sumAccountLedger(deceasedAccount);

  if (deceasedBalance > 0.01) {
    survivorAccount.rrsp += deceasedAccount.rrsp;
    survivorAccount.rrif += deceasedAccount.rrif;
    survivorAccount.tfsa += deceasedAccount.tfsa;
    survivorAccount.nonRegistered += deceasedAccount.nonRegistered;
    survivorAccount.nonRegisteredCostBase += deceasedAccount.nonRegisteredCostBase;
    survivorAccount.cash += deceasedAccount.cash;
    survivorAccount.lira += deceasedAccount.lira;
    survivorAccount.lif += deceasedAccount.lif;
    survivorAccount.dcPension += deceasedAccount.dcPension;

    deceasedAccount.rrsp = 0;
    deceasedAccount.rrif = 0;
    deceasedAccount.tfsa = 0;
    deceasedAccount.nonRegistered = 0;
    deceasedAccount.nonRegisteredCostBase = 0;
    deceasedAccount.cash = 0;
    deceasedAccount.lira = 0;
    deceasedAccount.lif = 0;
    deceasedAccount.dcPension = 0;

    warnings.push(
      `Baseline survivor rollover moved ${roundCurrency(
        deceasedBalance,
      )} of modeled assets from ${labelForSlot(
        deceased.slot,
      ).toLowerCase()} to ${labelForSlot(survivor.slot).toLowerCase()}.`,
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

    if (frame.age >= 71 && account.rrif > 0) {
      const factor = getRrifMinimumFactor(context.rules, frame.age);
      const minimumWithdrawal = Math.min(account.rrif, account.rrif * factor);

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
      lockedInLimit.minimumWithdrawal,
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
  baseAfterTaxCash: number,
  requiredCash: number,
): {
  balances: HouseholdLedger;
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>;
  drawdown: DrawdownResult;
  incomeTestedBenefits: IncomeTestedBenefitProjection;
} {
  let estimatedBenefitCash = 0;
  let finalBalances = cloneHouseholdLedger(baseBalances);
  let finalTaxState = cloneMemberTaxState(baseTaxState);
  let finalDrawdown = createEmptyDrawdownResult();
  let finalBenefitProjection = createEmptyIncomeTestedBenefitProjection();
  const iterationCount = context.input.household.gisModelingEnabled ? 2 : 1;

  for (let iteration = 0; iteration < iterationCount; iteration += 1) {
    const workingBalances = cloneHouseholdLedger(baseBalances);
    const workingTaxState = cloneMemberTaxState(baseTaxState);
    const workingLockedInAnnualLimits = cloneLockedInAnnualLimits(lockedInAnnualLimits);
    const gap = Math.max(0, requiredCash - (baseAfterTaxCash + estimatedBenefitCash));
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
      ? estimateIncomeTestedBenefits(context, memberFrames, workingTaxState)
      : createEmptyIncomeTestedBenefitProjection();

    finalBalances = workingBalances;
    finalTaxState = workingTaxState;
    finalDrawdown = drawdown;
    finalBenefitProjection = incomeTestedBenefits;

    if (
      !context.input.household.gisModelingEnabled ||
      Math.abs(incomeTestedBenefits.totalAnnual - estimatedBenefitCash) < 1
    ) {
      break;
    }

    estimatedBenefitCash = incomeTestedBenefits.totalAnnual;
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
  memberFrames: MemberFrame[],
  memberTaxState: Partial<Record<MemberSlot, MemberTaxState>>,
): IncomeTestedBenefitProjection {
  const warnings = [
    "GIS / Allowance baseline uses a current-year income proxy instead of Service Canada's prior-year and reassessment process.",
    "GIS / Allowance baseline uses a linear taper to the published annual cutoffs, not an exact quarterly SG3-3 table lookup or top-up formula.",
    "GIS / Allowance baseline applies the work-income exemption to modeled employment income only and does not yet capture every line-23600 adjustment.",
  ];
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

    assessableIncomeBySlot[frame.slot] = resolveIncomeTestedBenefitAssessableIncome(
      frame,
      state,
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
      const singleRule = findGisRule(context, "single-oas");
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
        context.rules.oas.allowanceSurvivorMaximumMonthly * 12,
        context.rules.oas.allowanceSurvivorIncomeCutoff,
        assessableIncome,
      );
      warnings.push(
        "Allowance for the Survivor requires an explicit eligibility flag and is not inferred automatically from widowhood timing in the current scaffold.",
      );
    }
  } else {
    const combinedAssessableIncome = livingFrames.reduce(
      (sum, frame) => sum + (assessableIncomeBySlot[frame.slot] ?? 0),
      0,
    );
    const partnerWithoutOas = livingFrames.find(
      (frame) => !(frame.age >= 65 && frame.oasIncome > 0),
    );
    const spouseAllowanceEligible = livingFrames.find(
      (frame) => frame.age >= 60 && frame.age <= 64,
    );

    if (oasRecipients.length >= 2) {
      const coupleRule = findGisRule(context, "spouse-oas");
      const annualPerRecipient = estimateLinearIncomeTestedBenefitAnnual(
        (coupleRule?.monthlyMaximum ?? 0) * 12,
        coupleRule?.incomeCutoff ?? 0,
        combinedAssessableIncome,
      );
      gisAnnual = annualPerRecipient * oasRecipients.length;
    } else if (oasRecipients.length === 1 && spouseAllowanceEligible) {
      const olderSpouseRule = findGisRule(context, "spouse-allowance");
      gisAnnual = estimateLinearIncomeTestedBenefitAnnual(
        (olderSpouseRule?.monthlyMaximum ?? 0) * 12,
        olderSpouseRule?.incomeCutoff ?? 0,
        combinedAssessableIncome,
      );
      allowanceAnnual = estimateLinearIncomeTestedBenefitAnnual(
        context.rules.oas.allowanceMaximumMonthly * 12,
        context.rules.oas.allowanceIncomeCutoff,
        combinedAssessableIncome,
      );
    } else if (oasRecipients.length === 1 && partnerWithoutOas) {
      const spouseNoOasRule = findGisRule(context, "spouse-no-oas");
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

function findGisRule(
  context: NormalizedContext,
  householdCase: "single-oas" | "spouse-no-oas" | "spouse-oas" | "spouse-allowance",
) {
  return context.rules.oas.gisMaximums.find(
    (item) => item.householdCase === householdCase,
  );
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

  const maximum =
    age >= 75
      ? context.rules.oas.monthlyMaximums.find((item) => item.ageBand === "75+")
      : context.rules.oas.monthlyMaximums.find((item) => item.ageBand === "65-74");

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

  if (livingMembers === 0) {
    return 0;
  }

  if (context.input.household.householdType !== "single" && livingMembers === 1) {
    spending *= 0.72;
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

  const longTermRate = jurisdictionRule.applySixPercentFloor
    ? Math.max(jurisdictionRule.fallbackLongTermRate, 0.06)
    : jurisdictionRule.fallbackLongTermRate;
  const annuityPaymentFactor = calculateLifeIncomeFundMaximumFactor(
    age,
    longTermRate,
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
  longTermRate: number,
  annuityCertainEndAge: number,
): number {
  if (age >= annuityCertainEndAge) {
    return 1;
  }

  let annuityDueFactor = 1;

  for (let year = 1; year <= annuityCertainEndAge - age; year += 1) {
    annuityDueFactor += 1 / Math.pow(1 + longTermRate, year);
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
      "GIS / Allowance baseline is enabled. Review low-income years carefully because Service Canada uses prior-year income and exact quarterly tables.",
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
      "Survivor years currently use baseline spousal rollover and DB continuation only; CPP survivor pension, estate taxes, and probate effects are not yet modeled.",
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

function summarizeProjection(
  years: ProjectionYear[],
  balances: HouseholdLedger,
): SimulationSummary {
  const firstShortfall = years.find((year) => year.shortfallOrSurplus < 0);
  const notableWarnings = Array.from(
    new Set(years.flatMap((year) => year.warnings)),
  );
  const estimatedEstateValue = sumBalances(balances);
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
    notableWarnings,
  };
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
    "GIS / Allowance now use a baseline current-year income proxy with a work-income exemption and published annual cutoffs, but exact prior-year Service Canada reassessment timing and quarterly SG3-3 tables are not yet replicated.",
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

function clampRate(value: number): number {
  return Math.min(0.6, Math.max(0, value));
}
