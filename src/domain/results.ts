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
  federalForeignTaxCredit: number;
  provincialForeignTaxCredit: number;
  quebecCareerExtensionCredit: number;
  quebecTaxReliefMeasuresCredit: number;
  cppQppIncome: number;
  oasIncome: number;
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
  notableWarnings: string[];
}

export interface SimulationResult {
  summary: SimulationSummary;
  years: ProjectionYear[];
  assumptionsUsed: string[];
}
