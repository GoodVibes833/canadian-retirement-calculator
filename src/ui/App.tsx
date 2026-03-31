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
import type { SimulationResult } from "../domain/results.js";
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
const canadaRuleSet = canadaRules as CanadaRuleSet;
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

  const selectedPreset =
    uiPresets.find((preset) => preset.id === selectedPresetId) ?? defaultUiPreset;
  const partnerScenario =
    scenario.householdType === "single"
      ? null
      : scenario.partner ?? createDefaultPartnerEditable(scenario.province);
  const firstYear = runState.result.years[0];
  const previewYears = runState.result.years.slice(0, 10);
  const topWarnings = Array.from(
    new Set([
      ...runState.result.summary.notableWarnings,
      ...(firstYear?.warnings ?? []),
    ]),
  ).slice(0, 8);
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
  const assumptionPreview = runState.result.assumptionsUsed.slice(0, 6);
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

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Canada Retirement Engine Demo</p>
        <h1>Start using the planner before the polished product lands.</h1>
        <p className="hero-copy">
          Load a real Canadian persona, tune the biggest retirement levers, and
          see after-tax cash flow, government benefits, withdrawal mix, estate
          impact, and engine warnings in one pass.
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
              <p className="section-kicker">Preset</p>
              <h2>Scenario Intake</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                const resetScenario = createEditableScenario(selectedPreset);
                setScenario(resetScenario);
                setRunState(buildRunState(selectedPreset, resetScenario));
              }}
            >
              Reset
            </button>
          </div>

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
                onClick={() => {
                  const nextScenario = createEditableScenario(preset);
                  setSelectedPresetId(preset.id);
                  setScenario(nextScenario);
                  setRunState(buildRunState(preset, nextScenario));
                }}
              >
                <span className="preset-label">{preset.label}</span>
                <span className="preset-description">{preset.description}</span>
              </button>
            ))}
          </div>

          <section className="member-card">
            <div className="member-header">
              <h3>Household Setup</h3>
            </div>
            <p className="section-note">
              This layer sets the planning frame. Member sections below handle
              balances and public-benefit assumptions.
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
                          : current.partner ?? createDefaultPartnerEditable(current.province),
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
                  <small>Use household tax sharing where the engine supports it.</small>
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
                  <small>Keep strategy warnings aligned with OAS recovery tax exposure.</small>
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
                  <small>Turn on income-tested low-income benefit paths.</small>
                </span>
              </label>
            </div>
          </section>

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
          ) : null}

          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => setRunState(buildRunState(selectedPreset, scenario))}
            >
              Calculate Plan
            </button>
            <p className="action-hint">
              Runs the existing 2026 Canada rules snapshot and the same pure
              engine already passing the Golden regression set.
            </p>
          </div>
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
