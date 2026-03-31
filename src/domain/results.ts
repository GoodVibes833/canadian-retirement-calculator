export interface ProjectionYear {
  calendarYear: number;
  primaryAge: number;
  partnerAge?: number;
  employmentIncome: number;
  beforeTaxIncome: number;
  afterTaxIncome: number;
  spending: number;
  totalContributions: number;
  oneTimeNetCashFlow: number;
  taxes: number;
  oasRecoveryTax: number;
  deathYearFinalReturnTaxAdjustment: number;
  deathYearFinalReturnTaxableIncomeAdjustment: number;
  deathYearEstimatedProbateBase?: number;
  deathYearProbateExcludedAssets?: number;
  deathYearEstimatedProbateCost?: number;
  deathYearEstateProcedure?: string;
  federalForeignTaxCredit: number;
  provincialForeignTaxCredit: number;
  quebecCareerExtensionCredit: number;
  quebecTaxReliefMeasuresCredit: number;
  cppQppIncome: number;
  oasIncome: number;
  gisIncome: number;
  allowanceIncome: number;
  allowanceSurvivorIncome: number;
  dbPensionIncome: number;
  otherPlannedIncome: number;
  rrspRrifWithdrawals: number;
  lifWithdrawals: number;
  tfsaWithdrawals: number;
  taxableWithdrawals: number;
  realizedCapitalGains: number;
  taxableCapitalGains: number;
  capitalLossesUsed: number;
  netCapitalLossCarryforward: number;
  cashWithdrawals: number;
  endOfYearAccountBalances: {
    primary: Record<string, number>;
    partner?: Record<string, number>;
  };
  shortfallOrSurplus: number;
  warnings: string[];
}

export interface SimulationSummary {
  initialReadiness: "on-track" | "borderline" | "shortfall";
  firstShortfallYear?: number;
  lastProjectionYear: number;
  estimatedEstateValue?: number;
  estimatedAfterTaxEstateValue?: number;
  estimatedTerminalTaxLiability?: number;
  estimatedProbateAndEstateAdminCost?: number;
  estimatedEstateProcedure?: string;
  notableWarnings: string[];
}

export interface SimulationResult {
  summary: SimulationSummary;
  years: ProjectionYear[];
  assumptionsUsed: string[];
}
