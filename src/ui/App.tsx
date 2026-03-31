import { useState } from "react";
import { simulateRetirementPlan } from "../index.js";
import type {
  HouseholdMemberInput,
  HouseholdType,
  PensionPlanType,
  ProvinceCode,
  SimulationInput,
  WithdrawalOrder,
} from "../domain/types.js";
import type {
  ProjectionYear,
  SimulationResult,
} from "../domain/results.js";
import type { CanadaRuleSet } from "../rules/types.js";
import canadaRules from "../../data/rules/canada/2026-01-01.json";
import { defaultUiPreset, uiPresets, type UiPreset } from "./presets.js";

type EditableBalances = {
  rrsp: number;
  rrif: number;
  tfsa: number;
  nonRegistered: number;
  cash: number;
  lif: number;
};

type EditableMember = {
  age: number;
  retirementAge: number;
  lifeExpectancy: number;
  pensionPlan: PensionPlanType;
  employmentIncome: number;
  cppMonthly: number;
  cppStartAge: number;
  oasStartAge: number;
  oasResidenceYears: number;
  oasEligible: boolean;
  rentalIncome: number;
  foreignPensionIncome: number;
  balances: EditableBalances;
};

type EditableScenario = {
  presetId: string;
  title: string;
  householdType: HouseholdType;
  province: ProvinceCode;
  withdrawalOrder: WithdrawalOrder;
  pensionIncomeSplittingEnabled: boolean;
  oasClawbackAwareMode: boolean;
  gisModelingEnabled: boolean;
  desiredAfterTaxSpending: number;
  survivorSpendingPercent: number;
  primary: EditableMember;
  partner: EditableMember | null;
};

type RunState = {
  result: SimulationResult;
  effectiveInput: SimulationInput;
};

type SavedScenarioRecord = {
  id: string;
  label: string;
  presetId: string;
  savedAt: string;
  scenario: EditableScenario;
};

type IntakeStepId = "setup" | "people" | "strategy" | "review";

const provinceOptions: ProvinceCode[] = ["ON", "BC", "AB", "QC"];
const householdTypeOptions: HouseholdType[] = ["single", "married", "common-law"];
const pensionPlanOptions: PensionPlanType[] = ["CPP", "QPP"];
const withdrawalOrderOptions: Array<{
  value: WithdrawalOrder;
  label: string;
}> = [
  { value: "tax-aware-blended", label: "Tax-Aware Blended" },
  { value: "taxable-first", label: "Taxable First" },
  { value: "rrsp-rrif-first", label: "RRSP / RRIF First" },
  { value: "tfsa-first", label: "TFSA First" },
  { value: "custom", label: "Custom" },
];
const intakeSteps: Array<{
  id: IntakeStepId;
  title: string;
  description: string;
}> = [
  {
    id: "setup",
    title: "Scenario",
    description: "Choose a baseline persona and define the household frame.",
  },
  {
    id: "people",
    title: "People",
    description: "Tune ages, benefits, income, and balances for each member.",
  },
  {
    id: "strategy",
    title: "Strategy",
    description: "Set spending, withdrawal order, and benefit strategy switches.",
  },
  {
    id: "review",
    title: "Review",
    description: "Save the scenario, confirm the setup, and run the engine.",
  },
];
const canadaRuleSet = canadaRules as CanadaRuleSet;
const savedScenarioStorageKey =
  "canadian-retirement-calculator.saved-ui-scenarios";
const fallbackPartnerTemplate = deepClone(
  defaultUiPreset.input.household.partner ?? defaultUiPreset.input.household.primary,
);
const initialScenario = createEditableScenario(defaultUiPreset);

export function App() {
  const [selectedPresetId, setSelectedPresetId] = useState(defaultUiPreset.id);
  const [scenario, setScenario] = useState<EditableScenario>(initialScenario);
  const [runState, setRunState] = useState<RunState>(() =>
    buildRunState(defaultUiPreset, initialScenario),
  );
  const [activeStep, setActiveStep] = useState<IntakeStepId>("setup");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioRecord[]>(
    () => readSavedScenarios(),
  );
  const [lastLoadedSavedId, setLastLoadedSavedId] = useState<string | null>(null);

  const selectedPreset =
    uiPresets.find((preset) => preset.id === selectedPresetId) ?? defaultUiPreset;
  const partnerScenario =
    scenario.householdType === "single"
      ? null
      : scenario.partner ?? createDefaultPartnerEditable(scenario.province);
  const firstYear = runState.result.years[0];
  const previewYears = runState.result.years.slice(0, 10);
  const chartYears = runState.result.years.slice(0, 18);
  const topWarnings = Array.from(
    new Set([
      ...runState.result.summary.notableWarnings,
      ...(firstYear?.warnings ?? []),
    ]),
  ).slice(0, 8);
  const assumptionPreview = runState.result.assumptionsUsed.slice(0, 6);
  const benefitTotal =
    (firstYear?.cppQppIncome ?? 0) +
    (firstYear?.oasIncome ?? 0) +
    (firstYear?.gisIncome ?? 0) +
    (firstYear?.allowanceIncome ?? 0) +
    (firstYear?.allowanceSurvivorIncome ?? 0);
  const firstYearWithdrawalTotal =
    (firstYear?.rrspRrifWithdrawals ?? 0) +
    (firstYear?.lifWithdrawals ?? 0) +
    (firstYear?.tfsaWithdrawals ?? 0) +
    (firstYear?.taxableWithdrawals ?? 0) +
    (firstYear?.cashWithdrawals ?? 0);
  const strategyTags = [
    runState.effectiveInput.household.withdrawalOrder,
    runState.effectiveInput.household.pensionIncomeSplittingEnabled
      ? "pension splitting on"
      : "pension splitting off",
    runState.effectiveInput.household.oasClawbackAwareMode
      ? "OAS-aware"
      : "OAS-neutral",
    runState.effectiveInput.household.gisModelingEnabled
      ? "GIS modeled"
      : "GIS off",
    scenario.householdType === "single"
      ? "single household"
      : `${scenario.survivorSpendingPercent}% survivor spending`,
  ];
  const savedScenarioLabel =
    savedScenarios.find((entry) => entry.id === lastLoadedSavedId)?.label ?? null;
  const cashFlowChartSeries = [
    {
      label: "After-Tax Income",
      color: "#1f5f4d",
      values: chartYears.map((year) => year.afterTaxIncome),
    },
    {
      label: "Spending",
      color: "#b15c33",
      values: chartYears.map((year) => year.spending),
    },
    {
      label: "Taxes",
      color: "#6f7d47",
      values: chartYears.map((year) => year.taxes),
    },
  ];
  const balanceChartSeries = [
    {
      label: "End Balance",
      color: "#20463d",
      values: chartYears.map((year) => totalHouseholdBalance(year)),
    },
    {
      label: "After-Tax Estate",
      color: "#8e6b2a",
      values: chartYears.map((year) =>
        Math.max(
          0,
          totalHouseholdBalance(year) - year.deathYearFinalReturnTaxAdjustment,
        ),
      ),
    },
  ];
  const reviewFacts = buildReviewFacts(scenario, runState.result);
  const currentStepIndex = intakeSteps.findIndex((step) => step.id === activeStep);

  const handlePresetSelect = (preset: UiPreset) => {
    const nextScenario = createEditableScenario(preset);
    setSelectedPresetId(preset.id);
    setScenario(nextScenario);
    setRunState(buildRunState(preset, nextScenario));
    setLastLoadedSavedId(null);
    setActiveStep("setup");
  };

  const handleReset = () => {
    const resetScenario = createEditableScenario(selectedPreset);
    setScenario(resetScenario);
    setRunState(buildRunState(selectedPreset, resetScenario));
    setLastLoadedSavedId(null);
  };

  const handleCalculate = () => {
    setRunState(buildRunState(selectedPreset, scenario));
  };

  const handleSaveScenario = () => {
    const snapshot: SavedScenarioRecord = {
      id: createScenarioSnapshotId(),
      label: scenario.title.trim() || `${selectedPreset.label} Snapshot`,
      presetId: selectedPreset.id,
      savedAt: new Date().toISOString(),
      scenario: deepClone({
        ...scenario,
        presetId: selectedPreset.id,
        partner: partnerScenario ? deepClone(partnerScenario) : null,
      }),
    };
    const nextSavedScenarios = [snapshot, ...savedScenarios].slice(0, 8);
    setSavedScenarios(nextSavedScenarios);
    writeSavedScenarios(nextSavedScenarios);
    setLastLoadedSavedId(snapshot.id);
  };

  const handleLoadSavedScenario = (savedScenario: SavedScenarioRecord) => {
    const preset =
      uiPresets.find((candidate) => candidate.id === savedScenario.presetId) ??
      defaultUiPreset;
    const nextScenario = deepClone(savedScenario.scenario);
    setSelectedPresetId(preset.id);
    setScenario(nextScenario);
    setRunState(buildRunState(preset, nextScenario));
    setLastLoadedSavedId(savedScenario.id);
    setActiveStep("review");
  };

  const handleDeleteSavedScenario = (savedScenarioId: string) => {
    const nextSavedScenarios = savedScenarios.filter(
      (entry) => entry.id !== savedScenarioId,
    );
    setSavedScenarios(nextSavedScenarios);
    writeSavedScenarios(nextSavedScenarios);
    if (lastLoadedSavedId === savedScenarioId) {
      setLastLoadedSavedId(null);
    }
  };

  const goToStep = (stepId: IntakeStepId) => {
    setActiveStep(stepId);
  };

  const goToPreviousStep = () => {
    const previousStep = intakeSteps[currentStepIndex - 1];
    if (previousStep) {
      setActiveStep(previousStep.id);
    }
  };

  const goToNextStep = () => {
    const nextStep = intakeSteps[currentStepIndex + 1];
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Canada Retirement Engine Demo</p>
        <h1>Start using the planner before the polished product lands.</h1>
        <p className="hero-copy">
          Load a real Canadian persona, move through a short intake flow, save
          scenario snapshots, and see retirement income, taxes, benefits,
          estate impact, and cash-flow trends in one pass.
        </p>
        <div className="hero-metrics">
          <Metric
            label="Readiness"
            value={runState.result.summary.initialReadiness}
          />
          <Metric
            label="First Shortfall"
            value={
              runState.result.summary.firstShortfallYear
                ? String(runState.result.summary.firstShortfallYear)
                : "None"
            }
          />
          <Metric
            label="Projection End"
            value={String(runState.result.summary.lastProjectionYear)}
          />
          <Metric label="Warnings" value={String(topWarnings.length)} />
        </div>
      </section>

      <section className="workspace-grid">
        <section className="panel input-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Planner</p>
              <h2>Scenario Intake</h2>
            </div>
            <button className="ghost-button" type="button" onClick={handleReset}>
              Reset
            </button>
          </div>

          <div className="stepper">
            {intakeSteps.map((step, index) => (
              <button
                key={step.id}
                className={
                  step.id === activeStep
                    ? "step-button step-button-active"
                    : "step-button"
                }
                type="button"
                onClick={() => goToStep(step.id)}
              >
                <span className="step-index">{index + 1}</span>
                <span className="step-copy">
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
              </button>
            ))}
          </div>

          {activeStep === "setup" ? (
            <>
              <section className="member-card">
                <div className="member-header">
                  <h3>Baseline Personas</h3>
                </div>
                <p className="section-note">
                  Pick a realistic starting point, then tailor it to the
                  household you want to model.
                </p>
                <div className="preset-grid">
                  {uiPresets.map((preset) => (
                    <button
                      key={preset.id}
                      className={
                        preset.id === selectedPresetId
                          ? "preset-card preset-card-active"
                          : "preset-card"
                      }
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                    >
                      <span className="preset-label">{preset.label}</span>
                      <span className="preset-description">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="member-card">
                <div className="member-header">
                  <h3>Household Setup</h3>
                </div>
                <p className="section-note">
                  Define the planning frame before filling in the people and
                  strategy details.
                </p>
                <div className="form-section">
                  <label>
                    <span>Scenario Title</span>
                    <input
                      type="text"
                      value={scenario.title}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Province</span>
                    <select
                      value={scenario.province}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          province: event.target.value as ProvinceCode,
                        }))
                      }
                    >
                      {provinceOptions.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Household Type</span>
                    <select
                      value={scenario.householdType}
                      onChange={(event) => {
                        const nextType = event.target.value as HouseholdType;
                        setScenario((current) => ({
                          ...current,
                          householdType: nextType,
                          partner:
                            nextType === "single"
                              ? current.partner
                              : current.partner ??
                                createDefaultPartnerEditable(current.province),
                        }));
                      }}
                    >
                      {householdTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Desired After-Tax Spending</span>
                    <input
                      type="number"
                      value={scenario.desiredAfterTaxSpending}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          desiredAfterTaxSpending: readNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            </>
          ) : null}

          {activeStep === "people" ? (
            <>
              <MemberEditor
                heading="Primary Household Member"
                member={scenario.primary}
                onChange={(nextMember) =>
                  setScenario((current) => ({
                    ...current,
                    primary: nextMember,
                  }))
                }
              />

              {partnerScenario ? (
                <MemberEditor
                  heading="Partner"
                  member={partnerScenario}
                  onChange={(nextMember) =>
                    setScenario((current) => ({
                      ...current,
                      partner: nextMember,
                    }))
                  }
                />
              ) : (
                <section className="member-card">
                  <div className="member-header">
                    <h3>Partner</h3>
                  </div>
                  <p className="section-note">
                    This scenario is currently modeled as a single household, so
                    no second member inputs are required.
                  </p>
                </section>
              )}
            </>
          ) : null}

          {activeStep === "strategy" ? (
            <>
              <section className="member-card">
                <div className="member-header">
                  <h3>Planning Strategy</h3>
                </div>
                <p className="section-note">
                  These settings shape drawdown behavior, survivor needs, and
                  low-income benefit logic.
                </p>
                <div className="form-section">
                  <label>
                    <span>Withdrawal Order</span>
                    <select
                      value={scenario.withdrawalOrder}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          withdrawalOrder: event.target.value as WithdrawalOrder,
                        }))
                      }
                    >
                      {withdrawalOrderOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Survivor Spending % of Couple</span>
                    <input
                      type="number"
                      value={scenario.survivorSpendingPercent}
                      disabled={scenario.householdType === "single"}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          survivorSpendingPercent: readNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="toggle-grid">
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={scenario.pensionIncomeSplittingEnabled}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          pensionIncomeSplittingEnabled: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>Pension income splitting</strong>
                      <small>
                        Use household tax sharing where the engine supports it.
                      </small>
                    </span>
                  </label>
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={scenario.oasClawbackAwareMode}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          oasClawbackAwareMode: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>OAS clawback aware</strong>
                      <small>
                        Keep strategy warnings aligned with OAS recovery tax
                        exposure.
                      </small>
                    </span>
                  </label>
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={scenario.gisModelingEnabled}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          gisModelingEnabled: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>GIS / Allowance modeling</strong>
                      <small>
                        Turn on income-tested low-income benefit paths.
                      </small>
                    </span>
                  </label>
                </div>
              </section>
            </>
          ) : null}

          {activeStep === "review" ? (
            <>
              <section className="member-card">
                <div className="panel-header">
                  <div>
                    <p className="section-kicker">Review</p>
                    <h3>Scenario Snapshot</h3>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={handleSaveScenario}
                  >
                    Save Snapshot
                  </button>
                </div>
                <p className="section-note">
                  Save custom cases here so you can jump back into them without
                  rebuilding the whole form.
                </p>
                {savedScenarioLabel ? (
                  <p className="section-note">
                    Last loaded snapshot: <strong>{savedScenarioLabel}</strong>
                  </p>
                ) : null}
                <div className="review-grid">
                  {reviewFacts.map((fact) => (
                    <article key={fact.label} className="review-card">
                      <span>{fact.label}</span>
                      <strong>{fact.value}</strong>
                    </article>
                  ))}
                </div>
              </section>

              <section className="member-card">
                <div className="member-header">
                  <h3>Saved Scenarios</h3>
                </div>
                {savedScenarios.length > 0 ? (
                  <div className="saved-list">
                    {savedScenarios.map((savedScenario) => (
                      <article key={savedScenario.id} className="saved-card">
                        <div>
                          <strong>{savedScenario.label}</strong>
                          <p>
                            {savedScenario.scenario.province} ·{" "}
                            {savedScenario.scenario.householdType} ·{" "}
                            {formatSavedAt(savedScenario.savedAt)}
                          </p>
                        </div>
                        <div className="saved-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => handleLoadSavedScenario(savedScenario)}
                          >
                            Load
                          </button>
                          <button
                            className="ghost-button ghost-button-danger"
                            type="button"
                            onClick={() =>
                              handleDeleteSavedScenario(savedScenario.id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="section-note">
                    No saved snapshots yet. Save a scenario here once it looks
                    useful.
                  </p>
                )}
              </section>
            </>
          ) : null}

          <div className="step-footer">
            <div className="step-footer-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={goToPreviousStep}
                disabled={currentStepIndex === 0}
              >
                Back
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={goToNextStep}
                disabled={currentStepIndex === intakeSteps.length - 1}
              >
                Next
              </button>
            </div>
            <div className="step-footer-actions">
              <button
                className="primary-button"
                type="button"
                onClick={handleCalculate}
              >
                Calculate Plan
              </button>
            </div>
          </div>
          <p className="action-hint">
            Runs the existing 2026 Canada rules snapshot and the same pure
            engine already passing the Golden regression set.
          </p>
        </section>

        <section className="panel results-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Result</p>
              <h2>{scenario.title}</h2>
            </div>
            <span className="result-badge">{selectedPreset.label}</span>
          </div>

          <div className="summary-grid">
            <Metric
              label="First-Year After-Tax Income"
              value={formatCurrency(firstYear?.afterTaxIncome ?? 0)}
            />
            <Metric
              label="Planned Spending"
              value={formatCurrency(firstYear?.spending ?? 0)}
            />
            <Metric
              label="First-Year Taxes"
              value={formatCurrency(firstYear?.taxes ?? 0)}
            />
            <Metric
              label="First-Year Gap"
              value={formatCurrency(firstYear?.shortfallOrSurplus ?? 0)}
            />
            <Metric
              label="Terminal Tax"
              value={formatCurrency(
                runState.result.summary.estimatedTerminalTaxLiability ?? 0,
              )}
            />
            <Metric
              label="After-Tax Estate"
              value={formatCurrency(
                runState.result.summary.estimatedAfterTaxEstateValue ?? 0,
              )}
            />
          </div>

          <div className="results-grid">
            <section className="results-card results-card-wide">
              <TrendChart
                title="Cash Flow Curve"
                subtitle="First 18 years of after-tax income, spending, and taxes."
                labels={chartYears.map((year) => String(year.calendarYear))}
                series={cashFlowChartSeries}
              />
            </section>

            <section className="results-card results-card-wide">
              <TrendChart
                title="Portfolio Glide Path"
                subtitle="Total projected household balances versus an after-tax proxy."
                labels={chartYears.map((year) => String(year.calendarYear))}
                series={balanceChartSeries}
              />
            </section>

            <section className="results-card">
              <h3>Government Benefits Snapshot</h3>
              <p className="card-copy">
                First-year public income across retirement and income-tested
                programs.
              </p>
              <dl className="mini-stats">
                <div>
                  <dt>CPP / QPP</dt>
                  <dd>{formatCurrency(firstYear?.cppQppIncome ?? 0)}</dd>
                </div>
                <div>
                  <dt>OAS</dt>
                  <dd>{formatCurrency(firstYear?.oasIncome ?? 0)}</dd>
                </div>
                <div>
                  <dt>GIS</dt>
                  <dd>{formatCurrency(firstYear?.gisIncome ?? 0)}</dd>
                </div>
                <div>
                  <dt>Allowance</dt>
                  <dd>
                    {formatCurrency(
                      (firstYear?.allowanceIncome ?? 0) +
                        (firstYear?.allowanceSurvivorIncome ?? 0),
                    )}
                  </dd>
                </div>
              </dl>
              <p className="inline-total">
                Public benefits total: <strong>{formatCurrency(benefitTotal)}</strong>
              </p>
            </section>

            <section className="results-card">
              <h3>Withdrawal Mix</h3>
              <p className="card-copy">
                Where the first retirement-year cash flow is coming from.
              </p>
              <ul className="info-list">
                <li>
                  <span>RRSP / RRIF</span>
                  <strong>{formatCurrency(firstYear?.rrspRrifWithdrawals ?? 0)}</strong>
                </li>
                <li>
                  <span>LIF / FRV</span>
                  <strong>{formatCurrency(firstYear?.lifWithdrawals ?? 0)}</strong>
                </li>
                <li>
                  <span>TFSA</span>
                  <strong>{formatCurrency(firstYear?.tfsaWithdrawals ?? 0)}</strong>
                </li>
                <li>
                  <span>Taxable</span>
                  <strong>{formatCurrency(firstYear?.taxableWithdrawals ?? 0)}</strong>
                </li>
                <li>
                  <span>Cash</span>
                  <strong>{formatCurrency(firstYear?.cashWithdrawals ?? 0)}</strong>
                </li>
              </ul>
              <p className="inline-total">
                Total withdrawals:{" "}
                <strong>{formatCurrency(firstYearWithdrawalTotal)}</strong>
              </p>
            </section>

            <section className="results-card">
              <h3>Estate Snapshot</h3>
              <p className="card-copy">
                Current summary output for estate, terminal tax, and probate
                proxy.
              </p>
              <ul className="info-list">
                <li>
                  <span>Gross Estate</span>
                  <strong>
                    {formatCurrency(runState.result.summary.estimatedEstateValue ?? 0)}
                  </strong>
                </li>
                <li>
                  <span>After-Tax Estate</span>
                  <strong>
                    {formatCurrency(
                      runState.result.summary.estimatedAfterTaxEstateValue ?? 0,
                    )}
                  </strong>
                </li>
                <li>
                  <span>Terminal Tax</span>
                  <strong>
                    {formatCurrency(
                      runState.result.summary.estimatedTerminalTaxLiability ?? 0,
                    )}
                  </strong>
                </li>
                <li>
                  <span>Probate / Admin Cost</span>
                  <strong>
                    {formatCurrency(
                      runState.result.summary.estimatedProbateAndEstateAdminCost ?? 0,
                    )}
                  </strong>
                </li>
              </ul>
              <p className="inline-total">
                Procedure:{" "}
                <strong>
                  {runState.result.summary.estimatedEstateProcedure ?? "Not surfaced"}
                </strong>
              </p>
            </section>

            <section className="results-card">
              <h3>Strategy Snapshot</h3>
              <p className="card-copy">
                Planning mode and household options used in this run.
              </p>
              <div className="tag-list">
                {strategyTags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <ul className="info-list compact-list">
                <li>
                  <span>Province</span>
                  <strong>{scenario.province}</strong>
                </li>
                <li>
                  <span>Primary Plan</span>
                  <strong>{scenario.primary.pensionPlan}</strong>
                </li>
                <li>
                  <span>Partner Plan</span>
                  <strong>{partnerScenario?.pensionPlan ?? "N/A"}</strong>
                </li>
              </ul>
            </section>

            <section className="results-card results-card-wide">
              <h3>Assumptions Used</h3>
              <p className="card-copy">
                A quick read on the first assumptions the engine surfaced for
                this run.
              </p>
              <ul className="warning-list assumption-list">
                {assumptionPreview.length > 0 ? (
                  assumptionPreview.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))
                ) : (
                  <li>No explicit assumptions were surfaced in the top slice.</li>
                )}
              </ul>
            </section>

            <section className="results-card results-card-wide">
              <h3>Engine Warnings</h3>
              <ul className="warning-list">
                {topWarnings.length > 0 ? (
                  topWarnings.map((warning) => <li key={warning}>{warning}</li>)
                ) : (
                  <li>No major warnings in the first pass.</li>
                )}
              </ul>
            </section>
          </div>

          <section className="results-card results-card-wide">
            <h3>10-Year Preview</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Age</th>
                    <th>After-Tax Income</th>
                    <th>Spending</th>
                    <th>Benefits</th>
                    <th>Withdrawals</th>
                    <th>Taxes</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {previewYears.map((year) => (
                    <tr key={year.calendarYear}>
                      <td>{year.calendarYear}</td>
                      <td>
                        {year.primaryAge}
                        {year.partnerAge !== undefined
                          ? ` / ${year.partnerAge}`
                          : ""}
                      </td>
                      <td>{formatCurrency(year.afterTaxIncome)}</td>
                      <td>{formatCurrency(year.spending)}</td>
                      <td>
                        {formatCurrency(
                          year.cppQppIncome +
                            year.oasIncome +
                            year.gisIncome +
                            year.allowanceIncome +
                            year.allowanceSurvivorIncome,
                        )}
                      </td>
                      <td>
                        {formatCurrency(
                          year.rrspRrifWithdrawals +
                            year.lifWithdrawals +
                            year.tfsaWithdrawals +
                            year.taxableWithdrawals +
                            year.cashWithdrawals,
                        )}
                      </td>
                      <td>{formatCurrency(year.taxes)}</td>
                      <td
                        className={
                          year.shortfallOrSurplus < 0 ? "negative-cell" : ""
                        }
                      >
                        {formatCurrency(year.shortfallOrSurplus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function MemberEditor(props: {
  heading: string;
  member: EditableMember;
  onChange: (member: EditableMember) => void;
}) {
  const { member, onChange } = props;

  return (
    <section className="member-card">
      <div className="member-header">
        <h3>{props.heading}</h3>
      </div>
      <div className="form-section">
        <label>
          <span>Current Age</span>
          <input
            type="number"
            value={member.age}
            onChange={(event) =>
              onChange({ ...member, age: readNumber(event.target.value) })
            }
          />
        </label>
        <label>
          <span>Retirement Age</span>
          <input
            type="number"
            value={member.retirementAge}
            onChange={(event) =>
              onChange({
                ...member,
                retirementAge: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>Life Expectancy</span>
          <input
            type="number"
            value={member.lifeExpectancy}
            onChange={(event) =>
              onChange({
                ...member,
                lifeExpectancy: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>Pension Plan</span>
          <select
            value={member.pensionPlan}
            onChange={(event) =>
              onChange({
                ...member,
                pensionPlan: event.target.value as PensionPlanType,
              })
            }
          >
            {pensionPlanOptions.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Employment Income</span>
          <input
            type="number"
            value={member.employmentIncome}
            onChange={(event) =>
              onChange({
                ...member,
                employmentIncome: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>CPP / QPP Monthly at Start Age</span>
          <input
            type="number"
            value={member.cppMonthly}
            onChange={(event) =>
              onChange({
                ...member,
                cppMonthly: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>CPP / QPP Start Age</span>
          <input
            type="number"
            value={member.cppStartAge}
            onChange={(event) =>
              onChange({
                ...member,
                cppStartAge: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>OAS Start Age</span>
          <input
            type="number"
            value={member.oasStartAge}
            onChange={(event) =>
              onChange({
                ...member,
                oasStartAge: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>OAS Residence Years</span>
          <input
            type="number"
            value={member.oasResidenceYears}
            onChange={(event) =>
              onChange({
                ...member,
                oasResidenceYears: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>Annual Rental Income</span>
          <input
            type="number"
            value={member.rentalIncome}
            onChange={(event) =>
              onChange({
                ...member,
                rentalIncome: readNumber(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>Annual Foreign Pension</span>
          <input
            type="number"
            value={member.foreignPensionIncome}
            onChange={(event) =>
              onChange({
                ...member,
                foreignPensionIncome: readNumber(event.target.value),
              })
            }
          />
        </label>
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={member.oasEligible}
          onChange={(event) =>
            onChange({
              ...member,
              oasEligible: event.target.checked,
            })
          }
        />
        <span>Eligible for OAS in this run</span>
      </label>

      <div className="balances-grid">
        {(
          [
            ["rrsp", "RRSP"],
            ["rrif", "RRIF"],
            ["tfsa", "TFSA"],
            ["nonRegistered", "Non-Registered"],
            ["cash", "Cash"],
            ["lif", "LIF / FRV"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="number"
              value={member.balances[key]}
              onChange={(event) =>
                onChange({
                  ...member,
                  balances: {
                    ...member.balances,
                    [key]: readNumber(event.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function TrendChart(props: {
  title: string;
  subtitle: string;
  labels: string[];
  series: Array<{
    label: string;
    color: string;
    values: number[];
  }>;
}) {
  const width = 760;
  const height = 220;
  const paddingX = 24;
  const paddingY = 20;
  const allValues = props.series.flatMap((entry) => entry.values);
  const minimumValue = Math.min(0, ...allValues);
  const maximumValue = Math.max(...allValues, 1);
  const range = maximumValue - minimumValue || 1;

  if (props.labels.length < 2) {
    return (
      <div className="chart-shell">
        <div className="chart-header">
          <div>
            <h3>{props.title}</h3>
            <p className="card-copy">{props.subtitle}</p>
          </div>
        </div>
        <p className="chart-empty">Not enough projection years to draw a chart.</p>
      </div>
    );
  }

  return (
    <div className="chart-shell">
      <div className="chart-header">
        <div>
          <h3>{props.title}</h3>
          <p className="card-copy">{props.subtitle}</p>
        </div>
        <div className="chart-legend">
          {props.series.map((entry) => (
            <span key={entry.label} className="legend-pill">
              <span
                className="legend-swatch"
                style={{ backgroundColor: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-chart"
        role="img"
        aria-label={props.title}
      >
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          className="chart-axis"
        />
        <line
          x1={paddingX}
          y1={paddingY}
          x2={paddingX}
          y2={height - paddingY}
          className="chart-axis"
        />
        {props.series.map((entry) => (
          <polyline
            key={entry.label}
            fill="none"
            stroke={entry.color}
            strokeWidth="3"
            points={buildChartPoints(
              entry.values,
              width,
              height,
              paddingX,
              paddingY,
              minimumValue,
              range,
            )}
          />
        ))}
      </svg>

      <div className="chart-footer">
        <span>{props.labels[0]}</span>
        <span>{props.labels[props.labels.length - 1]}</span>
      </div>
      <div className="chart-scale">
        <span>Low {formatCurrency(minimumValue)}</span>
        <span>High {formatCurrency(maximumValue)}</span>
      </div>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function createEditableScenario(preset: UiPreset): EditableScenario {
  const household = preset.input.household;

  return {
    presetId: preset.id,
    title: preset.label,
    householdType: household.householdType,
    province: household.primary.profile.provinceAtRetirement,
    withdrawalOrder: household.withdrawalOrder,
    pensionIncomeSplittingEnabled: household.pensionIncomeSplittingEnabled,
    oasClawbackAwareMode: household.oasClawbackAwareMode,
    gisModelingEnabled: household.gisModelingEnabled,
    desiredAfterTaxSpending: household.expenseProfile.desiredAfterTaxSpending,
    survivorSpendingPercent:
      (household.expenseProfile.survivorSpendingPercentOfCouple ?? 0.72) * 100,
    primary: createEditableMember(household.primary),
    partner: household.partner ? createEditableMember(household.partner) : null,
  };
}

function createEditableMember(member: HouseholdMemberInput): EditableMember {
  return {
    age: member.profile.currentAge,
    retirementAge: member.profile.retirementAge,
    lifeExpectancy: member.profile.lifeExpectancy,
    pensionPlan: member.profile.pensionPlan,
    employmentIncome: member.employment.baseAnnualIncome,
    cppMonthly:
      member.publicBenefits.manualMonthlyPensionAtStartAge ??
      member.publicBenefits.statementMonthlyPensionAt65 ??
      0,
    cppStartAge: member.publicBenefits.pensionStartAge,
    oasStartAge: member.publicBenefits.oasStartAge,
    oasResidenceYears:
      member.publicBenefits.oasResidenceYearsOverride ??
      member.profile.yearsResidedInCanadaAfter18,
    oasEligible: member.publicBenefits.oasEligible !== false,
    rentalIncome: firstRecurringIncomeAmount(member.rentalIncome),
    foreignPensionIncome: firstRecurringIncomeAmount(member.foreignPensionIncome),
    balances: {
      rrsp: member.accounts.rrsp,
      rrif: member.accounts.rrif,
      tfsa: member.accounts.tfsa,
      nonRegistered: member.accounts.nonRegistered,
      cash: member.accounts.cash ?? 0,
      lif: member.accounts.lif ?? 0,
    },
  };
}

function createDefaultPartnerEditable(province: ProvinceCode): EditableMember {
  const editablePartner = createEditableMember(fallbackPartnerTemplate);
  return {
    ...editablePartner,
    age: 55,
    retirementAge: 65,
    lifeExpectancy: 92,
    balances: { ...editablePartner.balances, cash: 10000 },
    pensionPlan: province === "QC" ? "QPP" : editablePartner.pensionPlan,
  };
}

function buildRunState(preset: UiPreset, scenario: EditableScenario): RunState {
  const effectiveInput = buildInputFromScenario(preset.input, scenario);
  const result = simulateRetirementPlan(effectiveInput, canadaRuleSet);

  return {
    result,
    effectiveInput,
  };
}

function buildInputFromScenario(
  baseInput: SimulationInput,
  scenario: EditableScenario,
): SimulationInput {
  const nextInput = deepClone(baseInput);

  nextInput.household.householdType = scenario.householdType;
  nextInput.household.withdrawalOrder = scenario.withdrawalOrder;
  nextInput.household.pensionIncomeSplittingEnabled =
    scenario.pensionIncomeSplittingEnabled;
  nextInput.household.oasClawbackAwareMode = scenario.oasClawbackAwareMode;
  nextInput.household.gisModelingEnabled = scenario.gisModelingEnabled;
  nextInput.household.expenseProfile.desiredAfterTaxSpending =
    scenario.desiredAfterTaxSpending;
  nextInput.household.expenseProfile.survivorSpendingPercentOfCouple =
    scenario.householdType === "single"
      ? undefined
      : clampPercent(scenario.survivorSpendingPercent);

  applyMemberScenario(nextInput.household.primary, scenario.primary, scenario.province);

  if (scenario.householdType === "single") {
    delete nextInput.household.partner;
  } else {
    const partnerScenario =
      scenario.partner ?? createDefaultPartnerEditable(scenario.province);
    nextInput.household.partner =
      nextInput.household.partner ?? deepClone(fallbackPartnerTemplate);
    applyMemberScenario(nextInput.household.partner, partnerScenario, scenario.province);
  }

  return nextInput;
}

function applyMemberScenario(
  member: HouseholdMemberInput,
  editable: EditableMember,
  province: ProvinceCode,
) {
  member.profile.currentAge = editable.age;
  member.profile.retirementAge = editable.retirementAge;
  member.profile.lifeExpectancy = editable.lifeExpectancy;
  member.profile.provinceAtRetirement = province;
  member.profile.pensionPlan = editable.pensionPlan;
  member.profile.yearsResidedInCanadaAfter18 = editable.oasResidenceYears;
  member.employment.baseAnnualIncome = editable.employmentIncome;
  member.publicBenefits.cppQppEstimateMode = "manual-at-start-age";
  member.publicBenefits.manualMonthlyPensionAtStartAge = editable.cppMonthly;
  member.publicBenefits.pensionStartAge = editable.cppStartAge;
  member.publicBenefits.oasEstimateMode = "residence-years";
  member.publicBenefits.oasStartAge = editable.oasStartAge;
  member.publicBenefits.oasEligible = editable.oasEligible;
  member.publicBenefits.oasResidenceYearsOverride = editable.oasResidenceYears;
  applyBalances(member, editable.balances);
  member.rentalIncome = createRecurringIncome(
    editable.rentalIncome,
    editable.age,
    "UI rental income",
  );
  member.foreignPensionIncome = createRecurringIncome(
    editable.foreignPensionIncome,
    editable.retirementAge,
    "UI foreign pension income",
  );
}

function applyBalances(member: HouseholdMemberInput, balances: EditableBalances) {
  member.accounts.rrsp = balances.rrsp;
  member.accounts.rrif = balances.rrif;
  member.accounts.tfsa = balances.tfsa;
  member.accounts.nonRegistered = balances.nonRegistered;
  member.accounts.cash = balances.cash;
  member.accounts.lif = balances.lif;
}

function createRecurringIncome(
  annualAmount: number,
  startAge: number,
  description: string,
) {
  if (annualAmount <= 0) {
    return [];
  }

  return [
    {
      startAge,
      annualAmount,
      inflationLinked: false,
      description,
    },
  ];
}

function buildChartPoints(
  values: number[],
  width: number,
  height: number,
  paddingX: number,
  paddingY: number,
  minimumValue: number,
  range: number,
) {
  return values
    .map((value, index) => {
      const x =
        paddingX +
        (index / Math.max(1, values.length - 1)) * (width - paddingX * 2);
      const y =
        height -
        paddingY -
        ((value - minimumValue) / range) * (height - paddingY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildReviewFacts(
  scenario: EditableScenario,
  result: SimulationResult,
): Array<{ label: string; value: string }> {
  return [
    { label: "Preset", value: scenario.presetId },
    { label: "Province", value: scenario.province },
    { label: "Household", value: scenario.householdType },
    {
      label: "Target Spending",
      value: formatCurrency(scenario.desiredAfterTaxSpending),
    },
    {
      label: "Projection End",
      value: String(result.summary.lastProjectionYear),
    },
    {
      label: "Readiness",
      value: result.summary.initialReadiness,
    },
  ];
}

function totalHouseholdBalance(year: ProjectionYear): number {
  return (
    sumRecordValues(year.endOfYearAccountBalances.primary) +
    sumRecordValues(year.endOfYearAccountBalances.partner)
  );
}

function sumRecordValues(record?: Record<string, number>): number {
  if (!record) {
    return 0;
  }

  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

function firstRecurringIncomeAmount(
  values: HouseholdMemberInput["rentalIncome"] | HouseholdMemberInput["foreignPensionIncome"],
): number {
  return values?.[0]?.annualAmount ?? 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value / 100));
}

function readSavedScenarios(): SavedScenarioRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(savedScenarioStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SavedScenarioRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedScenarios(savedScenarios: SavedScenarioRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    savedScenarioStorageKey,
    JSON.stringify(savedScenarios),
  );
}

function createScenarioSnapshotId() {
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}
