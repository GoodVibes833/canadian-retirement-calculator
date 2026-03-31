import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { simulateRetirementPlan } from "../index.js";
import type {
  BeneficiaryDesignationType,
  HouseholdMemberInput,
  HouseholdType,
  LockedInJurisdictionCode,
  PensionPlanType,
  ProvinceCode,
  QuebecWillForm,
  QuebecWillVerificationMethod,
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
  lira: number;
  lif: number;
};

type EditableLockedInBooleanChoice = "unspecified" | "yes" | "no";

type EditableDefinedBenefitPension = {
  enabled: boolean;
  annualAmount: number;
  startAge: number;
  indexationRatePercent: number;
  bridgeTo65AnnualAmount: number;
  survivorContinuationPercent: number;
};

type EditableScheduledIncome = {
  enabled: boolean;
  annualAmount: number;
  startAge: number;
  endAge: number;
  inflationLinked: boolean;
};

type EditableContributionPlan = {
  rrspAnnualContribution: number;
  tfsaAnnualContribution: number;
  nonRegisteredAnnualContribution: number;
  escalationRatePercent: number;
  rrspRoomRemaining: number;
  tfsaRoomRemaining: number;
};

type EditableMember = {
  age: number;
  retirementAge: number;
  lifeExpectancy: number;
  pensionPlan: PensionPlanType;
  livesAloneForTaxYear: boolean;
  employmentIncome: number;
  retirementPartTimeIncome: EditableScheduledIncome;
  cppMonthly: number;
  cppStartAge: number;
  oasStartAge: number;
  oasResidenceYears: number;
  oasEligible: boolean;
  definedBenefitPension: EditableDefinedBenefitPension;
  annuityIncome: EditableScheduledIncome;
  rentalIncome: number;
  foreignPensionIncome: number;
  balances: EditableBalances;
  contributions: EditableContributionPlan;
  lockedInPolicy: EditableLockedInPolicy;
  taxProfile: EditableTaxProfile;
  beneficiaryDesignations: EditableBeneficiaryDesignations;
  jointOwnership: EditableJointOwnership;
  estateAdministration: EditableEstateAdministration;
};

type EditableLockedInPolicy = {
  useCustomPolicy: boolean;
  jurisdiction: LockedInJurisdictionCode;
  plannedConversionAge: number;
  manualMinimumAnnualWithdrawal: number;
  manualMaximumAnnualWithdrawal: number;
  assumedPreviousYearReturnRatePercent: number;
  quebecTemporaryIncomeRequested: boolean;
  quebecTemporaryIncomeOptionOffered: EditableLockedInBooleanChoice;
  quebecTemporaryIncomeNoOtherFrvConfirmed: EditableLockedInBooleanChoice;
  quebecTemporaryIncomeEstimatedOtherIncome: number;
};

type EditableTaxProfile = {
  adjustedCostBase: number;
  capitalLossCarryforward: number;
  annualInterestIncome: number;
  annualEligibleDividendIncome: number;
  annualNonEligibleDividendIncome: number;
  annualForeignDividendIncome: number;
  annualForeignTaxPaid: number;
  annualReturnOfCapitalDistribution: number;
};

type EditableBeneficiaryDesignations = {
  rrsp: BeneficiaryDesignationType;
  rrif: BeneficiaryDesignationType;
  tfsa: BeneficiaryDesignationType;
  lif: BeneficiaryDesignationType;
};

type EditableJointOwnership = {
  nonRegisteredJointPercent: number;
  cashJointPercent: number;
};

type EditableEstateAdministration = {
  quebecWillForm: QuebecWillForm;
  quebecWillVerificationMethod: QuebecWillVerificationMethod;
  manualQuebecVerificationCost: number;
};

type EditableOneTimeEvent = {
  id: string;
  age: number;
  amount: number;
  direction: "inflow" | "outflow";
  description: string;
};

type EditableIncomeTestedBenefitsBaseIncome = {
  primaryAssessableIncome: number;
  partnerAssessableIncome: number;
  combinedAssessableIncome: number;
  calendarYear: number;
};

type EditableScenario = {
  presetId: string;
  title: string;
  householdType: HouseholdType;
  province: ProvinceCode;
  inflationRatePercent: number;
  preRetirementReturnRatePercent: number;
  postRetirementReturnRatePercent: number;
  annualFeeRatePercent: number;
  withdrawalOrder: WithdrawalOrder;
  pensionIncomeSplittingEnabled: boolean;
  oasClawbackAwareMode: boolean;
  gisModelingEnabled: boolean;
  desiredAfterTaxSpending: number;
  survivorSpendingPercent: number;
  incomeTestedBenefitsBaseIncome: EditableIncomeTestedBenefitsBaseIncome;
  oneTimeEvents: EditableOneTimeEvent[];
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

type ValidationIssue = {
  level: "error" | "warning";
  message: string;
};

type TransferStatus = {
  tone: "success" | "error";
  message: string;
};

type ReportStatus = {
  tone: "success" | "error";
  message: string;
};

type ScenarioTransferEnvelope = {
  version: "retirement-ui-scenario-v1";
  exportedAt: string;
  presetId: string;
  scenario: EditableScenario;
};

type ComparisonMode = "none" | "preset-baseline" | "saved-snapshot";
type ChartRange = 10 | 18 | "all";

type ComparisonState = {
  label: string;
  runState: RunState;
};

type IntakeStepId = "setup" | "people" | "strategy" | "review";

const provinceOptions: ProvinceCode[] = ["ON", "BC", "AB", "QC"];
const householdTypeOptions: HouseholdType[] = ["single", "married", "common-law"];
const pensionPlanOptions: PensionPlanType[] = ["CPP", "QPP"];
const beneficiaryDesignationOptions: Array<{
  value: BeneficiaryDesignationType;
  label: string;
}> = [
  { value: "estate", label: "Estate" },
  { value: "spouse", label: "Spouse" },
  { value: "other-beneficiary", label: "Other Beneficiary" },
];
const lockedInJurisdictionOptions: LockedInJurisdictionCode[] = [
  "ON",
  "BC",
  "AB",
  "QC",
  "Federal",
];
const lockedInBooleanChoiceOptions: Array<{
  value: EditableLockedInBooleanChoice;
  label: string;
}> = [
  { value: "unspecified", label: "Assume / not specified" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const quebecWillFormOptions: Array<{
  value: QuebecWillForm;
  label: string;
}> = [
  { value: "unknown", label: "Unknown / not set" },
  { value: "notarial", label: "Notarial" },
  { value: "witnessed", label: "Witnessed" },
  { value: "holograph", label: "Holograph" },
];
const quebecWillVerificationMethodOptions: Array<{
  value: QuebecWillVerificationMethod;
  label: string;
}> = [
  { value: "unknown", label: "Unknown / baseline" },
  { value: "not-required", label: "Not required" },
  { value: "notary", label: "By notary" },
  { value: "court", label: "By court" },
];
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
const autosaveDraftStorageKey =
  "canadian-retirement-calculator.ui-draft";
const scenarioTransferVersion = "retirement-ui-scenario-v1";
const fallbackPartnerTemplate = deepClone(
  defaultUiPreset.input.household.partner ?? defaultUiPreset.input.household.primary,
);
const initialAutosaveDraft = readAutosaveDraft();
const initialPreset =
  uiPresets.find((preset) => preset.id === initialAutosaveDraft?.presetId) ??
  defaultUiPreset;
const initialScenario = initialAutosaveDraft
  ? normalizeImportedScenario(initialAutosaveDraft, initialPreset)
  : createEditableScenario(defaultUiPreset);
const initialSelectedPresetId = initialPreset.id;

export function App() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState(initialSelectedPresetId);
  const [scenario, setScenario] = useState<EditableScenario>(initialScenario);
  const [runState, setRunState] = useState<RunState>(() =>
    buildRunState(initialPreset, initialScenario),
  );
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("none");
  const [compareSavedScenarioId, setCompareSavedScenarioId] = useState("");
  const [comparisonState, setComparisonState] = useState<ComparisonState | null>(null);
  const [activeStep, setActiveStep] = useState<IntakeStepId>("setup");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioRecord[]>(
    () => readSavedScenarios(),
  );
  const [lastLoadedSavedId, setLastLoadedSavedId] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<TransferStatus | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>(18);
  const [focusedYearIndex, setFocusedYearIndex] = useState(0);
  const [draftStatus, setDraftStatus] = useState<ReportStatus | null>(
    initialAutosaveDraft
      ? {
          tone: "success",
          message: "Restored the last autosaved draft from this browser.",
        }
      : null,
  );

  const selectedPreset =
    uiPresets.find((preset) => preset.id === selectedPresetId) ?? defaultUiPreset;
  const partnerScenario =
    scenario.householdType === "single"
      ? null
      : scenario.partner ?? createDefaultPartnerEditable(scenario.province);
  const validationIssues = validateScenario(scenario, partnerScenario);
  const blockingIssues = validationIssues.filter((issue) => issue.level === "error");
  const advisoryIssues = validationIssues.filter((issue) => issue.level === "warning");
  const firstYear = runState.result.years[0];
  const previewYears = runState.result.years.slice(0, 10);
  const chartYears = getChartYears(runState.result, chartRange);
  const clampedFocusedYearIndex = Math.min(
    focusedYearIndex,
    Math.max(0, chartYears.length - 1),
  );
  const focusedYear = chartYears[clampedFocusedYearIndex];
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
  const gapChartSeries = [
    {
      label: "Gap / Surplus",
      color: "#a05332",
      values: chartYears.map((year) => year.shortfallOrSurplus),
    },
  ];
  const comparisonFacts = comparisonState
    ? buildComparisonFacts(runState.result, comparisonState.runState.result)
    : [];
  const reviewFacts = buildReviewFacts(scenario, runState.result);
  const outcomeNarrative = buildOutcomeNarrative(
    runState.result,
    firstYear,
    topWarnings,
  );
  const currentStepIndex = intakeSteps.findIndex((step) => step.id === activeStep);
  const calculationHint =
    blockingIssues.length > 0
      ? `Resolve ${blockingIssues.length} blocking issue${
          blockingIssues.length === 1 ? "" : "s"
        } before running the engine.`
      : "Runs the existing 2026 Canada rules snapshot and the same pure engine already passing the Golden regression set.";
  const focusFacts = focusedYear ? buildFocusedYearFacts(focusedYear) : [];
  const reportSummary = buildReportSummary(
    scenario,
    runState.result,
    firstYear,
    comparisonState,
  );

  useEffect(() => {
    writeAutosaveDraft(scenario);
  }, [scenario]);

  const refreshComparisonState = (
    nextSelectedPreset: UiPreset,
    nextSavedScenarios: SavedScenarioRecord[] = savedScenarios,
  ) => {
    setComparisonState(
      buildComparisonState(
        comparisonMode,
        compareSavedScenarioId,
        nextSelectedPreset,
        nextSavedScenarios,
      ),
    );
  };

  const handlePresetSelect = (preset: UiPreset) => {
    const nextScenario = createEditableScenario(preset);
    setSelectedPresetId(preset.id);
    setScenario(nextScenario);
    setRunState(buildRunState(preset, nextScenario));
    setFocusedYearIndex(0);
    setLastLoadedSavedId(null);
    setTransferStatus(null);
    setReportStatus(null);
    setDraftStatus({
      tone: "success",
      message: "Loaded a fresh preset and made it the active autosaved draft.",
    });
    setComparisonState(
      buildComparisonState(
        comparisonMode,
        compareSavedScenarioId,
        preset,
        savedScenarios,
      ),
    );
    setActiveStep("setup");
  };

  const handleReset = () => {
    const resetScenario = createEditableScenario(selectedPreset);
    setScenario(resetScenario);
    setRunState(buildRunState(selectedPreset, resetScenario));
    setFocusedYearIndex(0);
    setLastLoadedSavedId(null);
    setTransferStatus(null);
    setReportStatus(null);
    setDraftStatus({
      tone: "success",
      message: "Reset the working scenario. This version is now the active autosaved draft.",
    });
    refreshComparisonState(selectedPreset);
  };

  const handleCalculate = () => {
    if (blockingIssues.length > 0) {
      setTransferStatus({
        tone: "error",
        message: `Fix ${blockingIssues.length} blocking issue${
          blockingIssues.length === 1 ? "" : "s"
        } before calculating.`,
      });
      return;
    }

    setRunState(buildRunState(selectedPreset, scenario));
    setFocusedYearIndex(0);
    refreshComparisonState(selectedPreset);
    setTransferStatus(null);
    setReportStatus(null);
    setDraftStatus({
      tone: "success",
      message: "Calculated the plan. The current scenario is autosaved in this browser.",
    });
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
    refreshComparisonState(selectedPreset, nextSavedScenarios);
    setTransferStatus({
      tone: "success",
      message: `Saved snapshot "${snapshot.label}".`,
    });
    setDraftStatus({
      tone: "success",
      message: "Current draft remains autosaved in this browser.",
    });
  };

  const handleLoadSavedScenario = (savedScenario: SavedScenarioRecord) => {
    const preset =
      uiPresets.find((candidate) => candidate.id === savedScenario.presetId) ??
      defaultUiPreset;
    const nextScenario = normalizeImportedScenario(savedScenario.scenario, preset);
    setSelectedPresetId(preset.id);
    setScenario(nextScenario);
    setRunState(buildRunState(preset, nextScenario));
    setFocusedYearIndex(0);
    setLastLoadedSavedId(savedScenario.id);
    setTransferStatus({
      tone: "success",
      message: `Loaded saved scenario "${savedScenario.label}".`,
    });
    setReportStatus(null);
    setDraftStatus({
      tone: "success",
      message: "Loaded snapshot is now the active autosaved draft.",
    });
    refreshComparisonState(preset);
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
    if (compareSavedScenarioId === savedScenarioId) {
      setCompareSavedScenarioId("");
      setComparisonState(
        buildComparisonState("none", "", selectedPreset, nextSavedScenarios),
      );
    } else {
      refreshComparisonState(selectedPreset, nextSavedScenarios);
    }
    setTransferStatus({
      tone: "success",
      message: "Deleted saved scenario snapshot.",
    });
  };

  const handleExportScenario = () => {
    if (typeof window === "undefined") {
      return;
    }

    const envelope: ScenarioTransferEnvelope = {
      version: scenarioTransferVersion,
      exportedAt: new Date().toISOString(),
      presetId: selectedPreset.id,
      scenario: deepClone({
        ...scenario,
        presetId: selectedPreset.id,
        partner: partnerScenario ? deepClone(partnerScenario) : null,
      }),
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugifyFileName(scenario.title || selectedPreset.label)}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setTransferStatus({
      tone: "success",
      message: "Exported current scenario to JSON.",
    });
    setDraftStatus({
      tone: "success",
      message: "Current draft remains autosaved in this browser.",
    });
  };

  const handleImportButtonClick = () => {
    importInputRef.current?.click();
  };

  const handleClearDraft = () => {
    clearAutosaveDraft();
    setDraftStatus({
      tone: "success",
      message:
        "Cleared the browser autosave draft. The next edit will create a fresh draft.",
    });
  };

  const handlePrintReport = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.print();
    setReportStatus({
      tone: "success",
      message: "Opened the browser print flow for the current report view.",
    });
  };

  const handleCopySummary = async () => {
    const text = buildShareSummary(
      scenario,
      runState.result,
      comparisonState,
      reportSummary,
    );

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("Clipboard is not available in this environment.");
      }

      setReportStatus({
        tone: "success",
        message: "Copied a shareable retirement summary to the clipboard.",
      });
    } catch (error) {
      setReportStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not copy the summary to the clipboard.",
      });
    }
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    void importScenarioFile(file);
  };

  const importScenarioFile = async (file: File) => {
    try {
      const raw = await file.text();
      const envelope = parseScenarioTransferEnvelope(raw);
      const preset =
        uiPresets.find((candidate) => candidate.id === envelope.presetId) ??
        defaultUiPreset;
      const normalizedScenario = normalizeImportedScenario(
        envelope.scenario,
        preset,
      );
      setSelectedPresetId(preset.id);
      setScenario(normalizedScenario);
      setRunState(buildRunState(preset, normalizedScenario));
      setFocusedYearIndex(0);
      setLastLoadedSavedId(null);
      setTransferStatus({
        tone: "success",
        message: `Imported scenario "${normalizedScenario.title}".`,
      });
      setReportStatus(null);
      setDraftStatus({
        tone: "success",
        message: "Imported scenario is now the active autosaved draft.",
      });
      refreshComparisonState(preset);
      setActiveStep("review");
    } catch (error) {
      setTransferStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not import that scenario file.",
      });
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

  const handleComparisonModeChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextMode = event.target.value as ComparisonMode;
    const nextSavedId =
      nextMode === "saved-snapshot"
        ? compareSavedScenarioId || savedScenarios[0]?.id || ""
        : "";
    setComparisonMode(nextMode);
    if (nextMode !== "saved-snapshot") {
      setCompareSavedScenarioId("");
    } else {
      setCompareSavedScenarioId(nextSavedId);
    }
    setComparisonState(
      buildComparisonState(nextMode, nextSavedId, selectedPreset, savedScenarios),
    );
  };

  const handleCompareSavedScenarioChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextSavedId = event.target.value;
    setCompareSavedScenarioId(nextSavedId);
    setComparisonState(
      buildComparisonState(
        comparisonMode,
        nextSavedId,
        selectedPreset,
        savedScenarios,
      ),
    );
  };

  const handleChartRangeChange = (nextRange: ChartRange) => {
    setChartRange(nextRange);
    setFocusedYearIndex(0);
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
                    <FieldLabel
                      label="Scenario Title"
                      hint="Used for saved snapshots and exported files."
                    />
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
                    <FieldLabel
                      label="Province"
                      hint="Provincial tax and some retirement rules depend on this selection."
                    />
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
                    <FieldLabel
                      label="Household Type"
                      hint="Choose single, married, or common-law so survivor and household tax logic are modeled correctly."
                    />
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
                    <FieldLabel
                      label="Desired After-Tax Spending"
                      hint="Annual lifestyle target after tax, not gross income."
                    />
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
                    <FieldLabel
                      label="Withdrawal Order"
                      hint="Sets the broad drawdown sequence the engine uses across taxable, registered, and TFSA assets."
                    />
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
                    <FieldLabel
                      label="Survivor Spending % of Couple"
                      hint="How much of couple spending remains after one partner dies."
                    />
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

              <section className="member-card">
                <div className="member-header">
                  <h3>Economic Assumptions</h3>
                </div>
                <p className="section-note">
                  These assumptions shape growth, erosion from fees, and the
                  spending pressure created by inflation.
                </p>
                <div className="form-section">
                  <label>
                    <FieldLabel
                      label="Inflation Rate (%)"
                      hint="Annual inflation assumption used to grow retirement spending and indexed cash flows."
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={scenario.inflationRatePercent}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          inflationRatePercent: readNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <FieldLabel
                      label="Pre-Retirement Return (%)"
                      hint="Average annual return assumption before retirement begins."
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={scenario.preRetirementReturnRatePercent}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          preRetirementReturnRatePercent: readNumber(
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <FieldLabel
                      label="Post-Retirement Return (%)"
                      hint="Average annual return assumption after retirement starts."
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={scenario.postRetirementReturnRatePercent}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          postRetirementReturnRatePercent: readNumber(
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <FieldLabel
                      label="Annual Fee Drag (%)"
                      hint="Portfolio fee or drag assumption applied inside the engine."
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={scenario.annualFeeRatePercent}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          annualFeeRatePercent: readNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="member-card">
                <div className="member-header">
                  <h3>Income-Tested Benefit Baseline</h3>
                </div>
                <p className="section-note">
                  Seed the prior-year assessable income used for first-year GIS
                  and Allowance logic, instead of relying on the engine&apos;s
                  current-year proxy fallback.
                </p>
                <div className="form-section">
                  <label>
                    <FieldLabel
                      label="Prior Tax Year"
                      hint="Usually the calendar year before the projection starts."
                    />
                    <input
                      type="number"
                      value={
                        scenario.incomeTestedBenefitsBaseIncome.calendarYear
                      }
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          incomeTestedBenefitsBaseIncome: {
                            ...current.incomeTestedBenefitsBaseIncome,
                            calendarYear: readNumber(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <FieldLabel
                      label="Primary Assessable Income"
                      hint="Prior-year assessable income used for first-year GIS / Allowance baseline."
                    />
                    <input
                      type="number"
                      value={
                        scenario.incomeTestedBenefitsBaseIncome
                          .primaryAssessableIncome
                      }
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          incomeTestedBenefitsBaseIncome: {
                            ...current.incomeTestedBenefitsBaseIncome,
                            primaryAssessableIncome: readNumber(
                              event.target.value,
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <FieldLabel
                      label="Partner Assessable Income"
                      hint="Only used in couple scenarios. Leave at zero for single households."
                    />
                    <input
                      type="number"
                      disabled={scenario.householdType === "single"}
                      value={
                        scenario.incomeTestedBenefitsBaseIncome
                          .partnerAssessableIncome
                      }
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          incomeTestedBenefitsBaseIncome: {
                            ...current.incomeTestedBenefitsBaseIncome,
                            partnerAssessableIncome: readNumber(
                              event.target.value,
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <FieldLabel
                      label="Combined Assessable Income"
                      hint="Useful when you know the household prior-year total but not each person&apos;s exact split."
                    />
                    <input
                      type="number"
                      value={
                        scenario.incomeTestedBenefitsBaseIncome
                          .combinedAssessableIncome
                      }
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          incomeTestedBenefitsBaseIncome: {
                            ...current.incomeTestedBenefitsBaseIncome,
                            combinedAssessableIncome: readNumber(
                              event.target.value,
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <OneTimeEventsEditor
                events={scenario.oneTimeEvents}
                primaryCurrentAge={scenario.primary.age}
                primaryLifeExpectancy={scenario.primary.lifeExpectancy}
                onChange={(nextEvents) =>
                  setScenario((current) => ({
                    ...current,
                    oneTimeEvents: nextEvents,
                  }))
                }
              />
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
                  <div className="saved-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={handleSaveScenario}
                    >
                      Save Snapshot
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={handleExportScenario}
                    >
                      Export JSON
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={handleImportButtonClick}
                    >
                      Import JSON
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={handleClearDraft}
                    >
                      Clear Draft
                    </button>
                    <input
                      ref={importInputRef}
                      className="visually-hidden"
                      type="file"
                      accept="application/json,.json"
                      onChange={handleImportFileChange}
                    />
                  </div>
                </div>
                <p className="section-note">
                  Save custom cases here so you can jump back into them without
                  rebuilding the whole form.
                </p>
                {transferStatus ? (
                  <p
                    className={
                      transferStatus.tone === "success"
                        ? "status-banner status-banner-success"
                        : "status-banner status-banner-error"
                    }
                  >
                    {transferStatus.message}
                  </p>
                ) : null}
                {draftStatus ? (
                  <p
                    className={
                      draftStatus.tone === "success"
                        ? "status-banner status-banner-success"
                        : "status-banner status-banner-error"
                    }
                  >
                    {draftStatus.message}
                  </p>
                ) : null}
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

          <section className="member-card">
            <div className="member-header">
              <h3>Validation</h3>
            </div>
            <p className="section-note">
              Blocking issues stop the run. Warnings are advisory and help you
              spot assumptions that deserve a second look.
            </p>
            <div className="validation-summary">
              <article className="review-card">
                <span>Blocking</span>
                <strong>{String(blockingIssues.length)}</strong>
              </article>
              <article className="review-card">
                <span>Warnings</span>
                <strong>{String(advisoryIssues.length)}</strong>
              </article>
            </div>
            {blockingIssues.length > 0 ? (
              <ul className="validation-list validation-list-error">
                {blockingIssues.map((issue) => (
                  <li key={`error-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            ) : (
              <p className="status-banner status-banner-success">
                No blocking issues in the current scenario.
              </p>
            )}
            {advisoryIssues.length > 0 ? (
              <ul className="validation-list validation-list-warning">
                {advisoryIssues.map((issue) => (
                  <li key={`warning-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
          </section>

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
                disabled={blockingIssues.length > 0}
              >
                Calculate Plan
              </button>
            </div>
          </div>
          <p className="action-hint">
            {calculationHint}
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

          <div className="report-actions no-print">
            <button
              className="ghost-button"
              type="button"
              onClick={handlePrintReport}
            >
              Print Report
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void handleCopySummary()}
            >
              Copy Summary
            </button>
          </div>
          {reportStatus ? (
            <p
              className={
                reportStatus.tone === "success"
                  ? "status-banner status-banner-success no-print"
                  : "status-banner status-banner-error no-print"
              }
            >
              {reportStatus.message}
            </p>
          ) : null}

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

          <section className="results-card results-card-wide report-summary-card">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Report</p>
                <h3>Advisor-Friendly Summary</h3>
              </div>
            </div>
            <div className="report-summary">
              {reportSummary.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <div className="results-grid">
            <section className="results-card results-card-wide">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Compare</p>
                  <h3>Scenario Compare Mode</h3>
                </div>
              </div>
              <div className="form-section compare-form">
                <label>
                  <FieldLabel
                    label="Compare Against"
                    hint="Use this to compare the current run with the preset baseline or a saved snapshot."
                  />
                  <select
                    value={comparisonMode}
                    onChange={handleComparisonModeChange}
                  >
                    <option value="none">No compare</option>
                    <option value="preset-baseline">Preset baseline</option>
                    <option value="saved-snapshot">Saved snapshot</option>
                  </select>
                </label>
                {comparisonMode === "saved-snapshot" ? (
                  <label>
                    <FieldLabel
                      label="Saved Snapshot"
                      hint="Choose which saved scenario should act as the comparison reference."
                    />
                    <select
                      value={compareSavedScenarioId}
                      onChange={handleCompareSavedScenarioChange}
                    >
                      {savedScenarios.length > 0 ? (
                        savedScenarios.map((savedScenario) => (
                          <option key={savedScenario.id} value={savedScenario.id}>
                            {savedScenario.label}
                          </option>
                        ))
                      ) : (
                        <option value="">No saved scenarios available</option>
                      )}
                    </select>
                  </label>
                ) : null}
              </div>
              {comparisonState ? (
                <>
                  <p className="section-note">
                    Comparing the current run against{" "}
                    <strong>{comparisonState.label}</strong>.
                  </p>
                  <div className="review-grid">
                    {comparisonFacts.map((fact) => (
                      <article key={fact.label} className="review-card">
                        <span>{fact.label}</span>
                        <strong>{fact.value}</strong>
                      </article>
                    ))}
                  </div>
                  <ul className="warning-list narrative-list">
                    {buildComparisonNarrative(
                      runState.result,
                      comparisonState.runState.result,
                    ).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="section-note">
                  Turn compare mode on to see deltas against a baseline or a
                  saved snapshot.
                </p>
              )}
            </section>

            <section className="results-card results-card-wide">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Inspect</p>
                  <h3>Chart Controls</h3>
                </div>
              </div>
              <div className="chart-controls">
                <div className="range-pills">
                  {[10, 18, "all"].map((option) => (
                    <button
                      key={String(option)}
                      className={
                        chartRange === option
                          ? "range-pill range-pill-active"
                          : "range-pill"
                      }
                      type="button"
                      onClick={() => handleChartRangeChange(option as ChartRange)}
                    >
                      {option === "all" ? "All years" : `${option} years`}
                    </button>
                  ))}
                </div>
                {chartYears.length > 1 ? (
                  <label className="slider-group">
                    <FieldLabel
                      label={`Focused Projection Year: ${focusedYear?.calendarYear ?? "N/A"}`}
                      hint="Move the focus marker across the chart window to inspect a specific projection year."
                    />
                    <input
                      type="range"
                      min="0"
                      max={String(chartYears.length - 1)}
                      value={String(clampedFocusedYearIndex)}
                      onChange={(event) =>
                        setFocusedYearIndex(readNumber(event.target.value))
                      }
                    />
                  </label>
                ) : null}
              </div>
              {focusedYear ? (
                <div className="review-grid">
                  {focusFacts.map((fact) => (
                    <article key={fact.label} className="review-card">
                      <span>{fact.label}</span>
                      <strong>{fact.value}</strong>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="section-note">
                  Not enough projection years are available for focused chart
                  inspection.
                </p>
              )}
            </section>

            <section className="results-card results-card-wide">
              <TrendChart
                title="Cash Flow Curve"
                subtitle={`Showing ${
                  chartRange === "all" ? "all available" : `${chartRange}`
                } years of after-tax income, spending, and taxes.`}
                labels={chartYears.map((year) => String(year.calendarYear))}
                series={cashFlowChartSeries}
                focusIndex={clampedFocusedYearIndex}
              />
            </section>

            <section className="results-card results-card-wide">
              <TrendChart
                title="Portfolio Glide Path"
                subtitle="Total projected household balances versus an after-tax proxy."
                labels={chartYears.map((year) => String(year.calendarYear))}
                series={balanceChartSeries}
                focusIndex={clampedFocusedYearIndex}
              />
            </section>

            <section className="results-card results-card-wide">
              <TrendChart
                title="Gap Monitor"
                subtitle="Positive values mean surplus. Negative values mean the plan is falling short."
                labels={chartYears.map((year) => String(year.calendarYear))}
                series={gapChartSeries}
                focusIndex={clampedFocusedYearIndex}
              />
            </section>

            <section className="results-card">
              <h3>What This Run Says</h3>
              <p className="card-copy">
                A short interpretation layer so the output reads more like a
                planning conversation than a raw spreadsheet.
              </p>
              <ul className="warning-list narrative-list">
                {outcomeNarrative.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
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
  const updateContributions = (
    key: keyof EditableContributionPlan,
    value: number,
  ) => {
    onChange({
      ...member,
      contributions: {
        ...member.contributions,
        [key]: value,
      },
    });
  };
  const updateTaxProfile = (
    key: keyof EditableTaxProfile,
    value: number,
  ) => {
    onChange({
      ...member,
      taxProfile: {
        ...member.taxProfile,
        [key]: value,
      },
    });
  };
  const updateBeneficiaryDesignation = (
    key: keyof EditableBeneficiaryDesignations,
    value: BeneficiaryDesignationType,
  ) => {
    onChange({
      ...member,
      beneficiaryDesignations: {
        ...member.beneficiaryDesignations,
        [key]: value,
      },
    });
  };
  const updateJointOwnership = (
    key: keyof EditableJointOwnership,
    value: number,
  ) => {
    onChange({
      ...member,
      jointOwnership: {
        ...member.jointOwnership,
        [key]: value,
      },
    });
  };
  const updateLockedInPolicy = (
    updates: Partial<EditableLockedInPolicy>,
  ) => {
    onChange({
      ...member,
      lockedInPolicy: {
        ...member.lockedInPolicy,
        ...updates,
      },
    });
  };

  return (
    <section className="member-card">
      <div className="member-header">
        <h3>{props.heading}</h3>
      </div>
      <div className="form-section">
        <label>
          <FieldLabel
            label="Current Age"
            hint="Current age at the start of the projection."
          />
          <input
            type="number"
            value={member.age}
            onChange={(event) =>
              onChange({ ...member, age: readNumber(event.target.value) })
            }
          />
        </label>
        <label>
          <FieldLabel
            label="Retirement Age"
            hint="Age when employment income is expected to stop or drop materially."
          />
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
          <FieldLabel
            label="Life Expectancy"
            hint="Planning horizon for this member, not a guaranteed lifespan."
          />
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
          <FieldLabel
            label="Pension Plan"
            hint="CPP is typical outside Quebec. QPP is typical inside Quebec."
          />
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
          <FieldLabel
            label="Employment Income"
            hint="Current annual employment income before retirement."
          />
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
          <FieldLabel
            label="CPP / QPP Monthly at Start Age"
            hint="Monthly retirement pension estimate at the chosen pension start age."
          />
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
          <FieldLabel
            label="CPP / QPP Start Age"
            hint="CPP usually starts between 60 and 70. QPP can extend to 72."
          />
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
          <FieldLabel
            label="OAS Start Age"
            hint="OAS can start between 65 and 70."
          />
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
          <FieldLabel
            label="OAS Residence Years"
            hint="Years lived in Canada after age 18 for OAS entitlement purposes."
          />
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
          <FieldLabel
            label="Annual Rental Income"
            hint="Recurring annual rental income the engine should carry into retirement."
          />
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
          <FieldLabel
            label="Annual Foreign Pension"
            hint="Recurring annual foreign pension income, before deeper treaty detail."
          />
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
            ["lira", "LIRA / CRI"],
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

      <div className="advanced-settings-grid">
        <section className="advanced-settings-card">
          <div className="member-header">
            <h4>Contribution Plan</h4>
          </div>
          <p className="section-note">
            Use this for ongoing accumulation before retirement, including
            annual RRSP, TFSA, and taxable contributions plus remaining room.
          </p>
          <div className="form-section compact-form-section">
            <label>
              <FieldLabel
                label="RRSP Contribution"
                hint="Annual RRSP contribution the engine should add before retirement."
              />
              <input
                type="number"
                value={member.contributions.rrspAnnualContribution}
                onChange={(event) =>
                  updateContributions(
                    "rrspAnnualContribution",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="TFSA Contribution"
                hint="Annual TFSA contribution before retirement."
              />
              <input
                type="number"
                value={member.contributions.tfsaAnnualContribution}
                onChange={(event) =>
                  updateContributions(
                    "tfsaAnnualContribution",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Taxable Contribution"
                hint="Annual contribution to non-registered savings."
              />
              <input
                type="number"
                value={member.contributions.nonRegisteredAnnualContribution}
                onChange={(event) =>
                  updateContributions(
                    "nonRegisteredAnnualContribution",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Contribution Escalation (%)"
                hint="Annual growth rate applied to the contribution plan."
              />
              <input
                type="number"
                step="0.1"
                value={member.contributions.escalationRatePercent}
                onChange={(event) =>
                  updateContributions(
                    "escalationRatePercent",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="RRSP Room Remaining"
                hint="Remaining RRSP contribution room if you want the engine to carry a room baseline."
              />
              <input
                type="number"
                value={member.contributions.rrspRoomRemaining}
                onChange={(event) =>
                  updateContributions(
                    "rrspRoomRemaining",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="TFSA Room Remaining"
                hint="Remaining TFSA contribution room baseline."
              />
              <input
                type="number"
                value={member.contributions.tfsaRoomRemaining}
                onChange={(event) =>
                  updateContributions(
                    "tfsaRoomRemaining",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="advanced-settings-card">
          <div className="member-header">
            <h4>Defined Benefit Pension</h4>
          </div>
          <p className="section-note">
            Use this for employer or public-service pensions with a known annual
            amount, indexation, bridge benefit, or survivor continuation.
          </p>
          <label className="toggle-row compact-toggle-row">
            <input
              type="checkbox"
              checked={member.definedBenefitPension.enabled}
              onChange={(event) =>
                onChange({
                  ...member,
                  definedBenefitPension: {
                    ...member.definedBenefitPension,
                    enabled: event.target.checked,
                  },
                })
              }
            />
            <span>Model a defined benefit pension for this member</span>
          </label>
          <div className="form-section compact-form-section">
            <label>
              <FieldLabel
                label="Annual DB Pension"
                hint="Gross annual pension amount at the pension start age."
              />
              <input
                type="number"
                disabled={!member.definedBenefitPension.enabled}
                value={member.definedBenefitPension.annualAmount}
                onChange={(event) =>
                  onChange({
                    ...member,
                    definedBenefitPension: {
                      ...member.definedBenefitPension,
                      annualAmount: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="DB Start Age"
                hint="Age when the pension starts paying."
              />
              <input
                type="number"
                disabled={!member.definedBenefitPension.enabled}
                value={member.definedBenefitPension.startAge}
                onChange={(event) =>
                  onChange({
                    ...member,
                    definedBenefitPension: {
                      ...member.definedBenefitPension,
                      startAge: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Indexation (%)"
                hint="Annual pension indexation, if any."
              />
              <input
                type="number"
                step="0.1"
                disabled={!member.definedBenefitPension.enabled}
                value={member.definedBenefitPension.indexationRatePercent}
                onChange={(event) =>
                  onChange({
                    ...member,
                    definedBenefitPension: {
                      ...member.definedBenefitPension,
                      indexationRatePercent: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Bridge to 65"
                hint="Annual bridge benefit that stops at age 65."
              />
              <input
                type="number"
                disabled={!member.definedBenefitPension.enabled}
                value={member.definedBenefitPension.bridgeTo65AnnualAmount}
                onChange={(event) =>
                  onChange({
                    ...member,
                    definedBenefitPension: {
                      ...member.definedBenefitPension,
                      bridgeTo65AnnualAmount: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Survivor Continuation (%)"
                hint="Percent of the DB pension that continues to a surviving spouse."
              />
              <input
                type="number"
                step="1"
                disabled={!member.definedBenefitPension.enabled}
                value={member.definedBenefitPension.survivorContinuationPercent}
                onChange={(event) =>
                  onChange({
                    ...member,
                    definedBenefitPension: {
                      ...member.definedBenefitPension,
                      survivorContinuationPercent: readNumber(
                        event.target.value,
                      ),
                    },
                  })
                }
              />
            </label>
          </div>
        </section>

        <section className="advanced-settings-card">
          <div className="member-header">
            <h4>Retirement Part-Time Income</h4>
          </div>
          <p className="section-note">
            Use this for phased retirement or consulting income that continues
            after the main job stops.
          </p>
          <label className="toggle-row compact-toggle-row">
            <input
              type="checkbox"
              checked={member.retirementPartTimeIncome.enabled}
              onChange={(event) =>
                onChange({
                  ...member,
                  retirementPartTimeIncome: {
                    ...member.retirementPartTimeIncome,
                    enabled: event.target.checked,
                  },
                })
              }
            />
            <span>Model part-time income after retirement</span>
          </label>
          <div className="form-section compact-form-section">
            <label>
              <FieldLabel
                label="Annual Amount"
                hint="Recurring annual part-time or consulting income."
              />
              <input
                type="number"
                disabled={!member.retirementPartTimeIncome.enabled}
                value={member.retirementPartTimeIncome.annualAmount}
                onChange={(event) =>
                  onChange({
                    ...member,
                    retirementPartTimeIncome: {
                      ...member.retirementPartTimeIncome,
                      annualAmount: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Start Age"
                hint="Age when the post-retirement work income begins."
              />
              <input
                type="number"
                disabled={!member.retirementPartTimeIncome.enabled}
                value={member.retirementPartTimeIncome.startAge}
                onChange={(event) =>
                  onChange({
                    ...member,
                    retirementPartTimeIncome: {
                      ...member.retirementPartTimeIncome,
                      startAge: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="End Age"
                hint="Leave at 0 when you want the income to continue through the projection."
              />
              <input
                type="number"
                disabled={!member.retirementPartTimeIncome.enabled}
                value={member.retirementPartTimeIncome.endAge}
                onChange={(event) =>
                  onChange({
                    ...member,
                    retirementPartTimeIncome: {
                      ...member.retirementPartTimeIncome,
                      endAge: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="toggle-row compact-toggle-row">
              <input
                type="checkbox"
                disabled={!member.retirementPartTimeIncome.enabled}
                checked={member.retirementPartTimeIncome.inflationLinked}
                onChange={(event) =>
                  onChange({
                    ...member,
                    retirementPartTimeIncome: {
                      ...member.retirementPartTimeIncome,
                      inflationLinked: event.target.checked,
                    },
                  })
                }
              />
              <span>Inflation-linked</span>
            </label>
          </div>
        </section>

        <section className="advanced-settings-card">
          <div className="member-header">
            <h4>Annuity Income</h4>
          </div>
          <p className="section-note">
            Use this for guaranteed annuity cash flow that starts at a known age.
          </p>
          <label className="toggle-row compact-toggle-row">
            <input
              type="checkbox"
              checked={member.annuityIncome.enabled}
              onChange={(event) =>
                onChange({
                  ...member,
                  annuityIncome: {
                    ...member.annuityIncome,
                    enabled: event.target.checked,
                  },
                })
              }
            />
            <span>Model annuity income for this member</span>
          </label>
          <div className="form-section compact-form-section">
            <label>
              <FieldLabel
                label="Annual Amount"
                hint="Recurring annual annuity payment."
              />
              <input
                type="number"
                disabled={!member.annuityIncome.enabled}
                value={member.annuityIncome.annualAmount}
                onChange={(event) =>
                  onChange({
                    ...member,
                    annuityIncome: {
                      ...member.annuityIncome,
                      annualAmount: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Start Age"
                hint="Age when the annuity begins."
              />
              <input
                type="number"
                disabled={!member.annuityIncome.enabled}
                value={member.annuityIncome.startAge}
                onChange={(event) =>
                  onChange({
                    ...member,
                    annuityIncome: {
                      ...member.annuityIncome,
                      startAge: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="End Age"
                hint="Leave at 0 for a lifetime-style annuity in the current baseline."
              />
              <input
                type="number"
                disabled={!member.annuityIncome.enabled}
                value={member.annuityIncome.endAge}
                onChange={(event) =>
                  onChange({
                    ...member,
                    annuityIncome: {
                      ...member.annuityIncome,
                      endAge: readNumber(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="toggle-row compact-toggle-row">
              <input
                type="checkbox"
                disabled={!member.annuityIncome.enabled}
                checked={member.annuityIncome.inflationLinked}
                onChange={(event) =>
                  onChange({
                    ...member,
                    annuityIncome: {
                      ...member.annuityIncome,
                      inflationLinked: event.target.checked,
                    },
                  })
                }
              />
              <span>Inflation-linked</span>
            </label>
          </div>
        </section>
      </div>

      <div className="advanced-settings-grid">
        <section className="advanced-settings-card">
          <div className="member-header">
            <h4>Locked-In Accounts</h4>
          </div>
          <p className="section-note">
            Use an explicit policy when the household has LIRA, LIF, or FRV
            assets and you know the governing rules or institution limits.
          </p>
          <label className="toggle-row compact-toggle-row">
            <input
              type="checkbox"
              checked={member.lockedInPolicy.useCustomPolicy}
              onChange={(event) =>
                updateLockedInPolicy({ useCustomPolicy: event.target.checked })
              }
            />
            <span>Use explicit locked-in policy instead of engine inference</span>
          </label>
          <div className="form-section compact-form-section">
            <label>
              <FieldLabel
                label="Jurisdiction"
                hint="Determines the LIRA / LIF / FRV rule set the engine applies."
              />
              <select
                disabled={!member.lockedInPolicy.useCustomPolicy}
                value={member.lockedInPolicy.jurisdiction}
                onChange={(event) =>
                  updateLockedInPolicy({
                    jurisdiction: event.target.value as LockedInJurisdictionCode,
                  })
                }
              >
                {lockedInJurisdictionOptions.map((jurisdiction) => (
                  <option
                    key={`locked-in-jurisdiction-${jurisdiction}`}
                    value={jurisdiction}
                  >
                    {jurisdiction}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <FieldLabel
                label="Planned Conversion Age"
                hint="Age when LIRA / CRI is assumed to convert into an income account like LIF / FRV."
              />
              <input
                type="number"
                disabled={!member.lockedInPolicy.useCustomPolicy}
                value={member.lockedInPolicy.plannedConversionAge}
                onChange={(event) =>
                  updateLockedInPolicy({
                    plannedConversionAge: readNumber(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Manual Minimum"
                hint="Use when the institution has already calculated the annual minimum withdrawal."
              />
              <input
                type="number"
                disabled={!member.lockedInPolicy.useCustomPolicy}
                value={member.lockedInPolicy.manualMinimumAnnualWithdrawal}
                onChange={(event) =>
                  updateLockedInPolicy({
                    manualMinimumAnnualWithdrawal: readNumber(
                      event.target.value,
                    ),
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Manual Maximum"
                hint="Use when the institution has already calculated the annual maximum withdrawal."
              />
              <input
                type="number"
                disabled={!member.lockedInPolicy.useCustomPolicy}
                value={member.lockedInPolicy.manualMaximumAnnualWithdrawal}
                onChange={(event) =>
                  updateLockedInPolicy({
                    manualMaximumAnnualWithdrawal: readNumber(
                      event.target.value,
                    ),
                  })
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Previous-Year Return (%)"
                hint="Used in fallback LIF maximum formulas where prior-year return matters."
              />
              <input
                type="number"
                step="0.1"
                disabled={!member.lockedInPolicy.useCustomPolicy}
                value={member.lockedInPolicy.assumedPreviousYearReturnRatePercent}
                onChange={(event) =>
                  updateLockedInPolicy({
                    assumedPreviousYearReturnRatePercent: readNumber(
                      event.target.value,
                    ),
                  })
                }
              />
            </label>
          </div>
          {member.lockedInPolicy.jurisdiction === "QC" ? (
            <>
              <label className="toggle-row compact-toggle-row">
                <input
                  type="checkbox"
                  disabled={!member.lockedInPolicy.useCustomPolicy}
                  checked={member.lockedInPolicy.quebecTemporaryIncomeRequested}
                  onChange={(event) =>
                    updateLockedInPolicy({
                      quebecTemporaryIncomeRequested: event.target.checked,
                    })
                  }
                />
                <span>Request Quebec FRV temporary income under age 55</span>
              </label>
              <div className="form-section compact-form-section">
                <label>
                  <FieldLabel
                    label="Contract Offers Option"
                    hint="Leave as assume when you do not know whether the FRV contract allows temporary income."
                  />
                  <select
                    disabled={!member.lockedInPolicy.useCustomPolicy}
                    value={member.lockedInPolicy.quebecTemporaryIncomeOptionOffered}
                    onChange={(event) =>
                      updateLockedInPolicy({
                        quebecTemporaryIncomeOptionOffered:
                          event.target.value as EditableLockedInBooleanChoice,
                      })
                    }
                  >
                    {lockedInBooleanChoiceOptions.map((option) => (
                      <option
                        key={`qc-temp-option-${option.value}`}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <FieldLabel
                    label="No Other FRV Confirmed"
                    hint="Temporary-income declarations generally assume there is no other FRV for the year."
                  />
                  <select
                    disabled={!member.lockedInPolicy.useCustomPolicy}
                    value={member.lockedInPolicy.quebecTemporaryIncomeNoOtherFrvConfirmed}
                    onChange={(event) =>
                      updateLockedInPolicy({
                        quebecTemporaryIncomeNoOtherFrvConfirmed:
                          event.target.value as EditableLockedInBooleanChoice,
                      })
                    }
                  >
                    {lockedInBooleanChoiceOptions.map((option) => (
                      <option
                        key={`qc-no-other-frv-${option.value}`}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <FieldLabel
                    label="Estimated Other Income"
                    hint="Next-12-month other-income estimate for Quebec temporary-income declarations."
                  />
                  <input
                    type="number"
                    disabled={!member.lockedInPolicy.useCustomPolicy}
                    value={
                      member.lockedInPolicy.quebecTemporaryIncomeEstimatedOtherIncome
                    }
                    onChange={(event) =>
                      updateLockedInPolicy({
                        quebecTemporaryIncomeEstimatedOtherIncome: readNumber(
                          event.target.value,
                        ),
                      })
                    }
                  />
                </label>
              </div>
            </>
          ) : null}
        </section>

        <section className="advanced-settings-card">
          <div className="member-header">
            <h4>Taxable Account Detail</h4>
          </div>
          <p className="section-note">
            Use this when non-registered balances need ACB, dividend, foreign
            tax, ROC, or capital-loss detail.
          </p>
          <div className="form-section compact-form-section">
            <label>
              <FieldLabel
                label="Non-Reg ACB"
                hint="Adjusted cost base for the current non-registered balance."
              />
              <input
                type="number"
                value={member.taxProfile.adjustedCostBase}
                onChange={(event) =>
                  updateTaxProfile(
                    "adjustedCostBase",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Capital Loss Carryforward"
                hint="Available net capital losses that can offset future taxable gains."
              />
              <input
                type="number"
                value={member.taxProfile.capitalLossCarryforward}
                onChange={(event) =>
                  updateTaxProfile(
                    "capitalLossCarryforward",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Annual Interest"
                hint="Recurring annual interest income from taxable accounts."
              />
              <input
                type="number"
                value={member.taxProfile.annualInterestIncome}
                onChange={(event) =>
                  updateTaxProfile(
                    "annualInterestIncome",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Eligible Dividends"
                hint="Cash eligible dividends received from Canadian corporations."
              />
              <input
                type="number"
                value={member.taxProfile.annualEligibleDividendIncome}
                onChange={(event) =>
                  updateTaxProfile(
                    "annualEligibleDividendIncome",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Non-Eligible Dividends"
                hint="Cash non-eligible dividends for smaller Canadian business distributions."
              />
              <input
                type="number"
                value={member.taxProfile.annualNonEligibleDividendIncome}
                onChange={(event) =>
                  updateTaxProfile(
                    "annualNonEligibleDividendIncome",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Foreign Dividends"
                hint="Recurring foreign dividend income before treaty detail."
              />
              <input
                type="number"
                value={member.taxProfile.annualForeignDividendIncome}
                onChange={(event) =>
                  updateTaxProfile(
                    "annualForeignDividendIncome",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Foreign Tax Paid"
                hint="Annual foreign non-business tax withheld and paid on taxable foreign income."
              />
              <input
                type="number"
                value={member.taxProfile.annualForeignTaxPaid}
                onChange={(event) =>
                  updateTaxProfile(
                    "annualForeignTaxPaid",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Return of Capital"
                hint="Annual return-of-capital cash that should reduce ACB instead of being taxed immediately."
              />
              <input
                type="number"
                value={member.taxProfile.annualReturnOfCapitalDistribution}
                onChange={(event) =>
                  updateTaxProfile(
                    "annualReturnOfCapitalDistribution",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="advanced-settings-card">
          <div className="member-header">
            <h4>Estate Routing</h4>
          </div>
          <p className="section-note">
            These settings affect baseline probate, survivor rollover, and
            death-year tax treatment.
          </p>
          <label className="toggle-row compact-toggle-row">
            <input
              type="checkbox"
              checked={member.livesAloneForTaxYear}
              onChange={(event) =>
                onChange({
                  ...member,
                  livesAloneForTaxYear: event.target.checked,
                })
              }
            />
            <span>Lives alone for Quebec tax-year relief modeling</span>
          </label>
          <div className="form-section compact-form-section">
            <label>
              <FieldLabel
                label="RRSP Beneficiary"
                hint="Estate keeps the default. Spouse and other beneficiary can change terminal-tax and estate flow."
              />
              <select
                value={member.beneficiaryDesignations.rrsp}
                onChange={(event) =>
                  updateBeneficiaryDesignation(
                    "rrsp",
                    event.target.value as BeneficiaryDesignationType,
                  )
                }
              >
                {beneficiaryDesignationOptions.map((option) => (
                  <option key={`rrsp-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <FieldLabel
                label="RRIF Beneficiary"
                hint="Use this when RRIF assets are meant for the spouse or another direct beneficiary."
              />
              <select
                value={member.beneficiaryDesignations.rrif}
                onChange={(event) =>
                  updateBeneficiaryDesignation(
                    "rrif",
                    event.target.value as BeneficiaryDesignationType,
                  )
                }
              >
                {beneficiaryDesignationOptions.map((option) => (
                  <option key={`rrif-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <FieldLabel
                label="TFSA Successor / Beneficiary"
                hint="Spouse generally maps to successor-holder style treatment in the current baseline."
              />
              <select
                value={member.beneficiaryDesignations.tfsa}
                onChange={(event) =>
                  updateBeneficiaryDesignation(
                    "tfsa",
                    event.target.value as BeneficiaryDesignationType,
                  )
                }
              >
                {beneficiaryDesignationOptions.map((option) => (
                  <option key={`tfsa-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <FieldLabel
                label="LIF / FRV Beneficiary"
                hint="Used for locked-in income accounts in the death-year baseline."
              />
              <select
                value={member.beneficiaryDesignations.lif}
                onChange={(event) =>
                  updateBeneficiaryDesignation(
                    "lif",
                    event.target.value as BeneficiaryDesignationType,
                  )
                }
              >
                {beneficiaryDesignationOptions.map((option) => (
                  <option key={`lif-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <FieldLabel
                label="Non-Reg Joint %"
                hint="Percent jointly owned with a surviving spouse for probate-exclusion baseline modeling."
              />
              <input
                type="number"
                value={member.jointOwnership.nonRegisteredJointPercent}
                onChange={(event) =>
                  updateJointOwnership(
                    "nonRegisteredJointPercent",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Cash Joint %"
                hint="Percent of cash treated as jointly owned with a surviving spouse."
              />
              <input
                type="number"
                value={member.jointOwnership.cashJointPercent}
                onChange={(event) =>
                  updateJointOwnership(
                    "cashJointPercent",
                    readNumber(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <FieldLabel
                label="Quebec Will Form"
                hint="Used for Quebec estate verification and probate-style cost branching."
              />
              <select
                value={member.estateAdministration.quebecWillForm}
                onChange={(event) =>
                  onChange({
                    ...member,
                    estateAdministration: {
                      ...member.estateAdministration,
                      quebecWillForm: event.target.value as QuebecWillForm,
                    },
                  })
                }
              >
                {quebecWillFormOptions.map((option) => (
                  <option key={`will-form-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <FieldLabel
                label="Verification Method"
                hint="Only matters for non-notarial Quebec wills in the current baseline."
              />
              <select
                value={member.estateAdministration.quebecWillVerificationMethod}
                onChange={(event) =>
                  onChange({
                    ...member,
                    estateAdministration: {
                      ...member.estateAdministration,
                      quebecWillVerificationMethod:
                        event.target.value as QuebecWillVerificationMethod,
                    },
                  })
                }
              >
                {quebecWillVerificationMethodOptions.map((option) => (
                  <option
                    key={`verification-method-${option.value}`}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <FieldLabel
                label="Manual Verification Cost"
                hint="Override for Quebec will verification or estate-settlement cost in the current baseline."
              />
              <input
                type="number"
                value={member.estateAdministration.manualQuebecVerificationCost}
                onChange={(event) =>
                  onChange({
                    ...member,
                    estateAdministration: {
                      ...member.estateAdministration,
                      manualQuebecVerificationCost: readNumber(
                        event.target.value,
                      ),
                    },
                  })
                }
              />
            </label>
          </div>
        </section>
      </div>
    </section>
  );
}

function OneTimeEventsEditor(props: {
  events: EditableOneTimeEvent[];
  primaryCurrentAge: number;
  primaryLifeExpectancy: number;
  onChange: (events: EditableOneTimeEvent[]) => void;
}) {
  const addEvent = () => {
    props.onChange([
      ...props.events,
      createEditableOneTimeEvent({
        age: Math.min(props.primaryLifeExpectancy, props.primaryCurrentAge + 1),
        amount: 10000,
        direction: "outflow",
        description: "One-time event",
      }),
    ]);
  };

  const updateEvent = (
    eventId: string,
    updates: Partial<EditableOneTimeEvent>,
  ) => {
    props.onChange(
      props.events.map((event) =>
        event.id === eventId ? { ...event, ...updates } : event,
      ),
    );
  };

  const removeEvent = (eventId: string) => {
    props.onChange(props.events.filter((event) => event.id !== eventId));
  };

  return (
    <section className="member-card">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Strategy</p>
          <h3>One-Time Events</h3>
        </div>
        <button className="ghost-button" type="button" onClick={addEvent}>
          Add Event
        </button>
      </div>
      <p className="section-note">
        These events run on the primary household member&apos;s age timeline, so
        they work well for inheritances, home repairs, downsizing proceeds, or
        large one-off spending.
      </p>
      {props.events.length > 0 ? (
        <div className="event-list">
          {props.events.map((event) => (
            <article key={event.id} className="event-card">
              <div className="event-card-header">
                <strong>{event.description || "One-time event"}</strong>
                <button
                  className="ghost-button ghost-button-danger"
                  type="button"
                  onClick={() => removeEvent(event.id)}
                >
                  Remove
                </button>
              </div>
              <div className="form-section compact-form-section">
                <label>
                  <FieldLabel
                    label="Primary Age"
                    hint="Event fires when the primary household member reaches this age."
                  />
                  <input
                    type="number"
                    value={event.age}
                    onChange={(valueEvent) =>
                      updateEvent(event.id, {
                        age: readNumber(valueEvent.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  <FieldLabel
                    label="Direction"
                    hint="Inflows add cash. Outflows model one-time spending."
                  />
                  <select
                    value={event.direction}
                    onChange={(valueEvent) =>
                      updateEvent(event.id, {
                        direction: valueEvent.target.value as
                          | "inflow"
                          | "outflow",
                      })
                    }
                  >
                    <option value="outflow">Outflow</option>
                    <option value="inflow">Inflow</option>
                  </select>
                </label>
                <label>
                  <FieldLabel
                    label="Amount"
                    hint="Annual cash amount used for that one-time event year."
                  />
                  <input
                    type="number"
                    value={event.amount}
                    onChange={(valueEvent) =>
                      updateEvent(event.id, {
                        amount: readNumber(valueEvent.target.value),
                      })
                    }
                  />
                </label>
                <label className="event-description-field">
                  <FieldLabel
                    label="Description"
                    hint="Used in warnings and review copy so future-you knows what the event represents."
                  />
                  <input
                    type="text"
                    value={event.description}
                    onChange={(valueEvent) =>
                      updateEvent(event.id, {
                        description: valueEvent.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="section-note">
          No one-time events yet. Add them here when the plan needs inheritances,
          home work, business sale proceeds, or other single-year shocks.
        </p>
      )}
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
  focusIndex?: number;
}) {
  const width = 760;
  const height = 220;
  const paddingX = 24;
  const paddingY = 20;
  const allValues = props.series.flatMap((entry) => entry.values);
  const minimumValue = Math.min(0, ...allValues);
  const maximumValue = Math.max(...allValues, 1);
  const range = maximumValue - minimumValue || 1;
  const clampedFocusIndex =
    typeof props.focusIndex === "number"
      ? Math.min(props.focusIndex, Math.max(0, props.labels.length - 1))
      : undefined;
  const focusX =
    clampedFocusIndex === undefined
      ? null
      : paddingX +
        (clampedFocusIndex / Math.max(1, props.labels.length - 1)) *
          (width - paddingX * 2);
  const zeroLineY =
    minimumValue <= 0 && maximumValue >= 0
      ? height -
        paddingY -
        ((0 - minimumValue) / range) * (height - paddingY * 2)
      : null;

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
        {zeroLineY !== null ? (
          <line
            x1={paddingX}
            y1={zeroLineY}
            x2={width - paddingX}
            y2={zeroLineY}
            className="chart-zero-line"
          />
        ) : null}
        {focusX !== null ? (
          <line
            x1={focusX}
            y1={paddingY}
            x2={focusX}
            y2={height - paddingY}
            className="chart-focus-line"
          />
        ) : null}
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
        {focusX !== null
          ? props.series.map((entry) => {
              const focusValue = entry.values[clampedFocusIndex ?? 0] ?? 0;
              const focusY =
                height -
                paddingY -
                ((focusValue - minimumValue) / range) * (height - paddingY * 2);

              return (
                <circle
                  key={`${entry.label}-focus`}
                  cx={focusX}
                  cy={focusY}
                  r="5"
                  fill={entry.color}
                  className="chart-focus-point"
                />
              );
            })
          : null}
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

function FieldLabel(props: { label: string; hint?: string }) {
  return (
    <span className="label-row">
      <span>{props.label}</span>
      {props.hint ? (
        <span className="help-badge" title={props.hint} aria-label={props.hint}>
          ?
        </span>
      ) : null}
    </span>
  );
}

function createEditableScenario(preset: UiPreset): EditableScenario {
  const household = preset.input.household;

  return {
    presetId: preset.id,
    title: preset.label,
    householdType: household.householdType,
    province: household.primary.profile.provinceAtRetirement,
    inflationRatePercent: toPercentValue(household.inflationRate),
    preRetirementReturnRatePercent: toPercentValue(
      household.preRetirementReturnRate,
    ),
    postRetirementReturnRatePercent: toPercentValue(
      household.postRetirementReturnRate,
    ),
    annualFeeRatePercent: toPercentValue(household.annualFeeRate ?? 0),
    withdrawalOrder: household.withdrawalOrder,
    pensionIncomeSplittingEnabled: household.pensionIncomeSplittingEnabled,
    oasClawbackAwareMode: household.oasClawbackAwareMode,
    gisModelingEnabled: household.gisModelingEnabled,
    desiredAfterTaxSpending: household.expenseProfile.desiredAfterTaxSpending,
    survivorSpendingPercent:
      (household.expenseProfile.survivorSpendingPercentOfCouple ?? 0.72) * 100,
    incomeTestedBenefitsBaseIncome: createEditableIncomeTestedBenefitsBaseIncome(
      preset,
    ),
    oneTimeEvents: household.oneTimeEvents.map((event) =>
      createEditableOneTimeEvent(event),
    ),
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
    livesAloneForTaxYear: member.profile.livesAloneForTaxYear === true,
    employmentIncome: member.employment.baseAnnualIncome,
    retirementPartTimeIncome: createEditableScheduledIncome(
      member.employment.partTimeIncomeAfterRetirement,
      member.profile.retirementAge,
    ),
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
    definedBenefitPension: createEditableDefinedBenefitPension(member),
    annuityIncome: createEditableScheduledIncome(
      member.annuityIncome,
      member.profile.retirementAge,
    ),
    rentalIncome: firstRecurringIncomeAmount(member.rentalIncome),
    foreignPensionIncome: firstRecurringIncomeAmount(member.foreignPensionIncome),
    balances: {
      rrsp: member.accounts.rrsp,
      rrif: member.accounts.rrif,
      tfsa: member.accounts.tfsa,
      nonRegistered: member.accounts.nonRegistered,
      cash: member.accounts.cash ?? 0,
      lira: member.accounts.lira ?? 0,
      lif: member.accounts.lif ?? 0,
    },
    contributions: createEditableContributionPlan(member),
    lockedInPolicy: createEditableLockedInPolicy(member),
    taxProfile: createEditableTaxProfile(member),
    beneficiaryDesignations: createEditableBeneficiaryDesignations(member),
    jointOwnership: createEditableJointOwnership(member),
    estateAdministration: createEditableEstateAdministration(member),
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
  nextInput.household.inflationRate = fromPercentValue(scenario.inflationRatePercent);
  nextInput.household.preRetirementReturnRate = fromPercentValue(
    scenario.preRetirementReturnRatePercent,
  );
  nextInput.household.postRetirementReturnRate = fromPercentValue(
    scenario.postRetirementReturnRatePercent,
  );
  nextInput.household.annualFeeRate = fromPercentValue(
    scenario.annualFeeRatePercent,
  );
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
  nextInput.household.incomeTestedBenefitsBaseIncome =
    buildIncomeTestedBenefitsBaseIncomeInput(
      scenario.incomeTestedBenefitsBaseIncome,
      scenario.householdType,
    );
  nextInput.household.oneTimeEvents = scenario.oneTimeEvents
    .map((event) => ({
      age: event.age,
      amount: event.amount,
      direction: event.direction,
      description: event.description.trim(),
    }))
    .sort((left, right) => left.age - right.age);

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
  member.profile.livesAloneForTaxYear = editable.livesAloneForTaxYear;
  member.profile.yearsResidedInCanadaAfter18 = editable.oasResidenceYears;
  member.employment.baseAnnualIncome = editable.employmentIncome;
  applyContributionPlan(member, editable.contributions);
  member.employment.partTimeIncomeAfterRetirement = buildScheduledIncomeInput(
    editable.retirementPartTimeIncome,
    "UI retirement part-time income",
  );
  member.publicBenefits.cppQppEstimateMode = "manual-at-start-age";
  member.publicBenefits.manualMonthlyPensionAtStartAge = editable.cppMonthly;
  member.publicBenefits.pensionStartAge = editable.cppStartAge;
  member.publicBenefits.oasEstimateMode = "residence-years";
  member.publicBenefits.oasStartAge = editable.oasStartAge;
  member.publicBenefits.oasEligible = editable.oasEligible;
  member.publicBenefits.oasResidenceYearsOverride = editable.oasResidenceYears;
  applyBalances(member, editable.balances);
  member.lockedInAccountPolicy = buildLockedInPolicyInput(editable.lockedInPolicy);
  member.taxableAccountTaxProfile = buildTaxProfileInput(editable.taxProfile);
  member.beneficiaryDesignations = buildBeneficiaryDesignationsInput(
    editable.beneficiaryDesignations,
  );
  member.jointOwnershipProfile = buildJointOwnershipInput(editable.jointOwnership);
  member.estateAdministrationProfile = buildEstateAdministrationInput(
    editable.estateAdministration,
  );
  member.definedBenefitPension = buildDefinedBenefitPensionInput(
    editable.definedBenefitPension,
  );
  member.annuityIncome = buildScheduledIncomeInput(
    editable.annuityIncome,
    "UI annuity income",
  );
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
  member.accounts.lira = balances.lira;
  member.accounts.lif = balances.lif;
}

function applyContributionPlan(
  member: HouseholdMemberInput,
  contributions: EditableContributionPlan,
) {
  member.contributions.rrsp = contributions.rrspAnnualContribution;
  member.contributions.tfsa = contributions.tfsaAnnualContribution;
  member.contributions.nonRegistered =
    contributions.nonRegisteredAnnualContribution;
  member.contributions.contributionEscalationRate = fromPercentValue(
    contributions.escalationRatePercent,
  );
  member.contributions.rrspRoomRemaining =
    contributions.rrspRoomRemaining > 0
      ? contributions.rrspRoomRemaining
      : undefined;
  member.contributions.tfsaRoomRemaining =
    contributions.tfsaRoomRemaining > 0
      ? contributions.tfsaRoomRemaining
      : undefined;
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

function createEditableDefinedBenefitPension(
  member: HouseholdMemberInput,
): EditableDefinedBenefitPension {
  const pension = member.definedBenefitPension;

  return {
    enabled: Boolean(pension),
    annualAmount: pension?.annualAmount ?? 0,
    startAge: pension?.startAge ?? member.profile.retirementAge,
    indexationRatePercent: toPercentValue(pension?.indexationRate ?? 0),
    bridgeTo65AnnualAmount: pension?.bridgeTo65AnnualAmount ?? 0,
    survivorContinuationPercent: toPercentValue(
      pension?.survivorContinuationPercent ?? 0,
    ),
  };
}

function createEditableContributionPlan(
  member: HouseholdMemberInput,
): EditableContributionPlan {
  return {
    rrspAnnualContribution: member.contributions.rrsp,
    tfsaAnnualContribution: member.contributions.tfsa,
    nonRegisteredAnnualContribution: member.contributions.nonRegistered,
    escalationRatePercent: toPercentValue(
      member.contributions.contributionEscalationRate,
    ),
    rrspRoomRemaining: member.contributions.rrspRoomRemaining ?? 0,
    tfsaRoomRemaining: member.contributions.tfsaRoomRemaining ?? 0,
  };
}

function createEditableScheduledIncome(
  flows:
    | HouseholdMemberInput["employment"]["partTimeIncomeAfterRetirement"]
    | HouseholdMemberInput["annuityIncome"],
  defaultStartAge: number,
): EditableScheduledIncome {
  const firstFlow = flows?.[0];

  return {
    enabled: Boolean(firstFlow),
    annualAmount: firstFlow?.annualAmount ?? 0,
    startAge: firstFlow?.startAge ?? defaultStartAge,
    endAge: firstFlow?.endAge ?? 0,
    inflationLinked: firstFlow?.inflationLinked === true,
  };
}

function createEditableTaxProfile(member: HouseholdMemberInput): EditableTaxProfile {
  return {
    adjustedCostBase:
      member.taxableAccountTaxProfile?.nonRegisteredAdjustedCostBase ?? 0,
    capitalLossCarryforward:
      member.taxableAccountTaxProfile?.initialNetCapitalLossCarryforward ?? 0,
    annualInterestIncome:
      member.taxableAccountTaxProfile?.annualInterestIncome ?? 0,
    annualEligibleDividendIncome:
      member.taxableAccountTaxProfile?.annualEligibleDividendIncome ?? 0,
    annualNonEligibleDividendIncome:
      member.taxableAccountTaxProfile?.annualNonEligibleDividendIncome ?? 0,
    annualForeignDividendIncome:
      member.taxableAccountTaxProfile?.annualForeignDividendIncome ?? 0,
    annualForeignTaxPaid:
      member.taxableAccountTaxProfile?.annualForeignNonBusinessIncomeTaxPaid ?? 0,
    annualReturnOfCapitalDistribution:
      member.taxableAccountTaxProfile?.annualReturnOfCapitalDistribution ?? 0,
  };
}

function createEditableLockedInPolicy(
  member: HouseholdMemberInput,
): EditableLockedInPolicy {
  const policy = member.lockedInAccountPolicy;
  const defaultJurisdiction =
    member.profile.provinceAtRetirement === "ON" ||
    member.profile.provinceAtRetirement === "BC" ||
    member.profile.provinceAtRetirement === "AB" ||
    member.profile.provinceAtRetirement === "QC"
      ? member.profile.provinceAtRetirement
      : "Federal";

  return {
    useCustomPolicy: Boolean(policy),
    jurisdiction: policy?.jurisdiction ?? defaultJurisdiction,
    plannedConversionAge:
      policy?.plannedConversionAge ?? member.profile.retirementAge,
    manualMinimumAnnualWithdrawal: policy?.manualMinimumAnnualWithdrawal ?? 0,
    manualMaximumAnnualWithdrawal: policy?.manualMaximumAnnualWithdrawal ?? 0,
    assumedPreviousYearReturnRatePercent: toPercentValue(
      policy?.assumedPreviousYearReturnRate ?? 0,
    ),
    quebecTemporaryIncomeRequested:
      policy?.quebecTemporaryIncomeRequested === true,
    quebecTemporaryIncomeOptionOffered:
      policy?.quebecTemporaryIncomeOptionOffered === undefined
        ? "unspecified"
        : policy.quebecTemporaryIncomeOptionOffered
          ? "yes"
          : "no",
    quebecTemporaryIncomeNoOtherFrvConfirmed:
      policy?.quebecTemporaryIncomeNoOtherFrvConfirmed === undefined
        ? "unspecified"
        : policy.quebecTemporaryIncomeNoOtherFrvConfirmed
          ? "yes"
          : "no",
    quebecTemporaryIncomeEstimatedOtherIncome:
      policy?.quebecTemporaryIncomeEstimatedOtherIncome ?? 0,
  };
}

function createEditableBeneficiaryDesignations(
  member: HouseholdMemberInput,
): EditableBeneficiaryDesignations {
  return {
    rrsp: member.beneficiaryDesignations?.rrsp ?? "estate",
    rrif: member.beneficiaryDesignations?.rrif ?? "estate",
    tfsa: member.beneficiaryDesignations?.tfsa ?? "estate",
    lif: member.beneficiaryDesignations?.lif ?? "estate",
  };
}

function createEditableJointOwnership(
  member: HouseholdMemberInput,
): EditableJointOwnership {
  return {
    nonRegisteredJointPercent:
      (member.jointOwnershipProfile?.nonRegisteredJointWithSurvivingSpousePercent ??
        0) * 100,
    cashJointPercent:
      (member.jointOwnershipProfile?.cashJointWithSurvivingSpousePercent ?? 0) *
      100,
  };
}

function createEditableEstateAdministration(
  member: HouseholdMemberInput,
): EditableEstateAdministration {
  return {
    quebecWillForm: member.estateAdministrationProfile?.quebecWillForm ?? "unknown",
    quebecWillVerificationMethod:
      member.estateAdministrationProfile?.quebecWillVerificationMethod ?? "unknown",
    manualQuebecVerificationCost:
      member.estateAdministrationProfile?.manualQuebecVerificationCost ?? 0,
  };
}

function createEditableIncomeTestedBenefitsBaseIncome(
  preset: UiPreset,
): EditableIncomeTestedBenefitsBaseIncome {
  const baseIncome = preset.input.household.incomeTestedBenefitsBaseIncome;

  return {
    primaryAssessableIncome: baseIncome?.primaryAssessableIncome ?? 0,
    partnerAssessableIncome: baseIncome?.partnerAssessableIncome ?? 0,
    combinedAssessableIncome: baseIncome?.combinedAssessableIncome ?? 0,
    calendarYear:
      baseIncome?.calendarYear ?? preset.input.household.projectionStartYear - 1,
  };
}

function createEditableOneTimeEvent(
  event: Omit<EditableOneTimeEvent, "id">,
): EditableOneTimeEvent {
  return {
    ...event,
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function buildTaxProfileInput(editable: EditableTaxProfile) {
  const nextProfile: NonNullable<
    HouseholdMemberInput["taxableAccountTaxProfile"]
  > = {};

  if (editable.adjustedCostBase > 0) {
    nextProfile.nonRegisteredAdjustedCostBase = editable.adjustedCostBase;
  }
  if (editable.capitalLossCarryforward > 0) {
    nextProfile.initialNetCapitalLossCarryforward =
      editable.capitalLossCarryforward;
  }
  if (editable.annualInterestIncome > 0) {
    nextProfile.annualInterestIncome = editable.annualInterestIncome;
  }
  if (editable.annualEligibleDividendIncome > 0) {
    nextProfile.annualEligibleDividendIncome =
      editable.annualEligibleDividendIncome;
  }
  if (editable.annualNonEligibleDividendIncome > 0) {
    nextProfile.annualNonEligibleDividendIncome =
      editable.annualNonEligibleDividendIncome;
  }
  if (editable.annualForeignDividendIncome > 0) {
    nextProfile.annualForeignDividendIncome =
      editable.annualForeignDividendIncome;
  }
  if (editable.annualForeignTaxPaid > 0) {
    nextProfile.annualForeignNonBusinessIncomeTaxPaid =
      editable.annualForeignTaxPaid;
  }
  if (editable.annualReturnOfCapitalDistribution > 0) {
    nextProfile.annualReturnOfCapitalDistribution =
      editable.annualReturnOfCapitalDistribution;
  }

  return Object.keys(nextProfile).length > 0 ? nextProfile : undefined;
}

function buildLockedInPolicyInput(editable: EditableLockedInPolicy) {
  if (!editable.useCustomPolicy) {
    return undefined;
  }

  const nextPolicy: NonNullable<HouseholdMemberInput["lockedInAccountPolicy"]> = {
    jurisdiction: editable.jurisdiction,
    plannedConversionAge: editable.plannedConversionAge,
  };

  if (editable.manualMinimumAnnualWithdrawal > 0) {
    nextPolicy.manualMinimumAnnualWithdrawal =
      editable.manualMinimumAnnualWithdrawal;
  }
  if (editable.manualMaximumAnnualWithdrawal > 0) {
    nextPolicy.manualMaximumAnnualWithdrawal =
      editable.manualMaximumAnnualWithdrawal;
  }
  if (editable.assumedPreviousYearReturnRatePercent !== 0) {
    nextPolicy.assumedPreviousYearReturnRate = fromPercentValue(
      editable.assumedPreviousYearReturnRatePercent,
    );
  }
  if (editable.jurisdiction === "QC") {
    nextPolicy.quebecTemporaryIncomeRequested =
      editable.quebecTemporaryIncomeRequested;
    if (editable.quebecTemporaryIncomeOptionOffered !== "unspecified") {
      nextPolicy.quebecTemporaryIncomeOptionOffered =
        editable.quebecTemporaryIncomeOptionOffered === "yes";
    }
    if (editable.quebecTemporaryIncomeNoOtherFrvConfirmed !== "unspecified") {
      nextPolicy.quebecTemporaryIncomeNoOtherFrvConfirmed =
        editable.quebecTemporaryIncomeNoOtherFrvConfirmed === "yes";
    }
    if (editable.quebecTemporaryIncomeEstimatedOtherIncome > 0) {
      nextPolicy.quebecTemporaryIncomeEstimatedOtherIncome =
        editable.quebecTemporaryIncomeEstimatedOtherIncome;
    }
  }

  return nextPolicy;
}

function buildDefinedBenefitPensionInput(
  editable: EditableDefinedBenefitPension,
) {
  if (!editable.enabled) {
    return undefined;
  }

  return {
    annualAmount: editable.annualAmount,
    startAge: editable.startAge,
    indexationRate: fromPercentValue(editable.indexationRatePercent),
    bridgeTo65AnnualAmount:
      editable.bridgeTo65AnnualAmount > 0
        ? editable.bridgeTo65AnnualAmount
        : undefined,
    survivorContinuationPercent:
      editable.survivorContinuationPercent > 0
        ? clampPercent(editable.survivorContinuationPercent)
        : undefined,
  };
}

function buildScheduledIncomeInput(
  editable: EditableScheduledIncome,
  description: string,
) {
  if (!editable.enabled || editable.annualAmount <= 0) {
    return [];
  }

  return [
    {
      startAge: editable.startAge,
      endAge: editable.endAge > 0 ? editable.endAge : undefined,
      annualAmount: editable.annualAmount,
      inflationLinked: editable.inflationLinked,
      description,
    },
  ];
}

function buildBeneficiaryDesignationsInput(
  editable: EditableBeneficiaryDesignations,
) {
  const nextDesignations: NonNullable<
    HouseholdMemberInput["beneficiaryDesignations"]
  > = {};

  if (editable.rrsp !== "estate") {
    nextDesignations.rrsp = editable.rrsp;
  }
  if (editable.rrif !== "estate") {
    nextDesignations.rrif = editable.rrif;
  }
  if (editable.tfsa !== "estate") {
    nextDesignations.tfsa = editable.tfsa;
  }
  if (editable.lif !== "estate") {
    nextDesignations.lif = editable.lif;
  }

  return Object.keys(nextDesignations).length > 0 ? nextDesignations : undefined;
}

function buildJointOwnershipInput(editable: EditableJointOwnership) {
  const nextJointOwnership: NonNullable<
    HouseholdMemberInput["jointOwnershipProfile"]
  > = {};

  if (editable.nonRegisteredJointPercent > 0) {
    nextJointOwnership.nonRegisteredJointWithSurvivingSpousePercent =
      clampPercent(editable.nonRegisteredJointPercent);
  }
  if (editable.cashJointPercent > 0) {
    nextJointOwnership.cashJointWithSurvivingSpousePercent = clampPercent(
      editable.cashJointPercent,
    );
  }

  return Object.keys(nextJointOwnership).length > 0
    ? nextJointOwnership
    : undefined;
}

function buildEstateAdministrationInput(
  editable: EditableEstateAdministration,
) {
  const nextEstateAdministration: NonNullable<
    HouseholdMemberInput["estateAdministrationProfile"]
  > = {};

  if (editable.quebecWillForm !== "unknown") {
    nextEstateAdministration.quebecWillForm = editable.quebecWillForm;
  }
  if (editable.quebecWillVerificationMethod !== "unknown") {
    nextEstateAdministration.quebecWillVerificationMethod =
      editable.quebecWillVerificationMethod;
  }
  if (editable.manualQuebecVerificationCost > 0) {
    nextEstateAdministration.manualQuebecVerificationCost =
      editable.manualQuebecVerificationCost;
  }

  return Object.keys(nextEstateAdministration).length > 0
    ? nextEstateAdministration
    : undefined;
}

function buildIncomeTestedBenefitsBaseIncomeInput(
  editable: EditableIncomeTestedBenefitsBaseIncome,
  householdType: HouseholdType,
) {
  const nextBaseIncome: NonNullable<
    SimulationInput["household"]["incomeTestedBenefitsBaseIncome"]
  > = {};

  if (editable.primaryAssessableIncome > 0) {
    nextBaseIncome.primaryAssessableIncome = editable.primaryAssessableIncome;
  }
  if (householdType !== "single" && editable.partnerAssessableIncome > 0) {
    nextBaseIncome.partnerAssessableIncome = editable.partnerAssessableIncome;
  }
  if (editable.combinedAssessableIncome > 0) {
    nextBaseIncome.combinedAssessableIncome = editable.combinedAssessableIncome;
  }
  if (editable.calendarYear > 0) {
    nextBaseIncome.calendarYear = editable.calendarYear;
  }

  return Object.keys(nextBaseIncome).length > 0 ? nextBaseIncome : undefined;
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

function getChartYears(result: SimulationResult, chartRange: ChartRange) {
  return chartRange === "all"
    ? result.years
    : result.years.slice(0, chartRange);
}

function buildComparisonState(
  comparisonMode: ComparisonMode,
  compareSavedScenarioId: string,
  selectedPreset: UiPreset,
  savedScenarios: SavedScenarioRecord[],
): ComparisonState | null {
  if (comparisonMode === "none") {
    return null;
  }

  if (comparisonMode === "preset-baseline") {
    const baselineScenario = createEditableScenario(selectedPreset);
    return {
      label: `${selectedPreset.label} baseline`,
      runState: buildRunState(selectedPreset, baselineScenario),
    };
  }

  const savedScenario = savedScenarios.find(
    (entry) => entry.id === compareSavedScenarioId,
  );

  if (!savedScenario) {
    return null;
  }

  const savedPreset =
    uiPresets.find((preset) => preset.id === savedScenario.presetId) ??
    defaultUiPreset;

  return {
    label: savedScenario.label,
    runState: buildRunState(savedPreset, savedScenario.scenario),
  };
}

function buildComparisonFacts(
  currentResult: SimulationResult,
  comparisonResult: SimulationResult,
): Array<{ label: string; value: string }> {
  const currentFirstYear = currentResult.years[0];
  const comparisonFirstYear = comparisonResult.years[0];

  return [
    {
      label: "After-Tax Income Delta",
      value: formatSignedCurrency(
        (currentFirstYear?.afterTaxIncome ?? 0) -
          (comparisonFirstYear?.afterTaxIncome ?? 0),
      ),
    },
    {
      label: "First-Year Gap Delta",
      value: formatSignedCurrency(
        (currentFirstYear?.shortfallOrSurplus ?? 0) -
          (comparisonFirstYear?.shortfallOrSurplus ?? 0),
      ),
    },
    {
      label: "After-Tax Estate Delta",
      value: formatSignedCurrency(
        (currentResult.summary.estimatedAfterTaxEstateValue ?? 0) -
          (comparisonResult.summary.estimatedAfterTaxEstateValue ?? 0),
      ),
    },
    {
      label: "Terminal Tax Delta",
      value: formatSignedCurrency(
        (currentResult.summary.estimatedTerminalTaxLiability ?? 0) -
          (comparisonResult.summary.estimatedTerminalTaxLiability ?? 0),
      ),
    },
    {
      label: "Readiness",
      value: `${comparisonResult.summary.initialReadiness} -> ${currentResult.summary.initialReadiness}`,
    },
    {
      label: "First Shortfall",
      value: `${comparisonResult.summary.firstShortfallYear ?? "None"} -> ${
        currentResult.summary.firstShortfallYear ?? "None"
      }`,
    },
  ];
}

function buildFocusedYearFacts(
  year: ProjectionYear,
): Array<{ label: string; value: string }> {
  return [
    { label: "Year", value: String(year.calendarYear) },
    {
      label: "Age",
      value:
        year.partnerAge !== undefined
          ? `${year.primaryAge} / ${year.partnerAge}`
          : String(year.primaryAge),
    },
    { label: "After-Tax Income", value: formatCurrency(year.afterTaxIncome) },
    { label: "Spending", value: formatCurrency(year.spending) },
    { label: "Taxes", value: formatCurrency(year.taxes) },
    { label: "Gap / Surplus", value: formatSignedCurrency(year.shortfallOrSurplus) },
  ];
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
      label: "Inflation",
      value: formatDisplayPercent(scenario.inflationRatePercent),
    },
    {
      label: "Post-Ret Return",
      value: formatDisplayPercent(scenario.postRetirementReturnRatePercent),
    },
    {
      label: "Target Spending",
      value: formatCurrency(scenario.desiredAfterTaxSpending),
    },
    {
      label: "One-Time Events",
      value: String(scenario.oneTimeEvents.length),
    },
    {
      label: "GIS Seed Year",
      value: String(scenario.incomeTestedBenefitsBaseIncome.calendarYear),
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

function buildOutcomeNarrative(
  result: SimulationResult,
  firstYear: ProjectionYear | undefined,
  topWarnings: string[],
): string[] {
  const readinessLine =
    result.summary.initialReadiness === "on-track"
      ? "The first pass looks on track, which means the baseline assumptions fund the modeled lifestyle."
      : result.summary.initialReadiness === "borderline"
        ? "This plan is close, but it has a thinner margin than a comfortable retirement plan usually wants."
        : "This run projects a meaningful retirement funding gap under the current assumptions.";
  const gapLine = result.summary.firstShortfallYear
    ? `The first projected shortfall appears in ${result.summary.firstShortfallYear}, so that is the first year worth stress-testing.`
    : "The first decade stays funded without a modeled shortfall.";
  const benefitsLine = firstYear
    ? `Public benefits cover about ${formatPercent(
        safeDivide(
          firstYear.cppQppIncome +
            firstYear.oasIncome +
            firstYear.gisIncome +
            firstYear.allowanceIncome +
            firstYear.allowanceSurvivorIncome,
          Math.max(1, firstYear.spending),
        ),
      )} of first-year spending.`
    : "Public-benefit coverage is not available yet because there is no first-year projection row.";
  const warningLine =
    topWarnings.length > 0
      ? `Top warning to review next: ${topWarnings[0]}`
      : "The engine did not surface a major first-pass warning in the current scenario.";

  return [readinessLine, gapLine, benefitsLine, warningLine];
}

function buildReportSummary(
  scenario: EditableScenario,
  result: SimulationResult,
  firstYear: ProjectionYear | undefined,
  comparisonState: ComparisonState | null,
): string[] {
  const firstShortfallText = result.summary.firstShortfallYear
    ? `The first modeled shortfall appears in ${result.summary.firstShortfallYear}.`
    : "The current run does not show a shortfall in the modeled horizon.";
  const firstYearLine = firstYear
    ? `In the first projection year, the household brings in ${formatCurrency(
        firstYear.afterTaxIncome,
      )} after tax against ${formatCurrency(firstYear.spending)} of spending, with ${formatCurrency(
        firstYear.taxes,
      )} of tax drag and ${formatCurrency(
        firstYear.cppQppIncome +
          firstYear.oasIncome +
          firstYear.gisIncome +
          firstYear.allowanceIncome +
          firstYear.allowanceSurvivorIncome,
      )} coming from public programs.`
    : "A first-year projection row is not available yet for narrative reporting.";
  const estateLine = `The current after-tax estate estimate is ${formatCurrency(
    result.summary.estimatedAfterTaxEstateValue ?? 0,
  )}, with terminal tax estimated at ${formatCurrency(
    result.summary.estimatedTerminalTaxLiability ?? 0,
  )}.`;
  const assumptionsLine = `This scenario currently assumes ${formatDisplayPercent(
    scenario.inflationRatePercent,
  )} inflation, ${formatDisplayPercent(
    scenario.preRetirementReturnRatePercent,
  )} pre-retirement returns, ${formatDisplayPercent(
    scenario.postRetirementReturnRatePercent,
  )} post-retirement returns, and ${formatDisplayPercent(
    scenario.annualFeeRatePercent,
  )} annual fee drag.`;
  const comparisonLine = comparisonState
    ? buildComparisonNarrative(result, comparisonState.runState.result)[0]
    : "No comparison baseline is active, so this summary reflects only the current scenario.";

  return [
    `${scenario.title} is currently assessed as ${result.summary.initialReadiness}. ${firstShortfallText}`,
    firstYearLine,
    estateLine,
    assumptionsLine,
    comparisonLine,
  ];
}

function buildShareSummary(
  scenario: EditableScenario,
  result: SimulationResult,
  comparisonState: ComparisonState | null,
  reportSummary: string[],
): string {
  const lines = [
    `Retirement Summary: ${scenario.title}`,
    `Province: ${scenario.province}`,
    `Household: ${scenario.householdType}`,
    `Readiness: ${result.summary.initialReadiness}`,
    `First shortfall: ${result.summary.firstShortfallYear ?? "None"}`,
    `After-tax estate: ${formatCurrency(
      result.summary.estimatedAfterTaxEstateValue ?? 0,
    )}`,
    comparisonState ? `Compare baseline: ${comparisonState.label}` : null,
    "",
    ...reportSummary,
  ];

  return lines.filter(Boolean).join("\n");
}

function buildComparisonNarrative(
  currentResult: SimulationResult,
  comparisonResult: SimulationResult,
): string[] {
  const currentFirstYear = currentResult.years[0];
  const comparisonFirstYear = comparisonResult.years[0];
  const incomeDelta =
    (currentFirstYear?.afterTaxIncome ?? 0) -
    (comparisonFirstYear?.afterTaxIncome ?? 0);
  const gapDelta =
    (currentFirstYear?.shortfallOrSurplus ?? 0) -
    (comparisonFirstYear?.shortfallOrSurplus ?? 0);
  const estateDelta =
    (currentResult.summary.estimatedAfterTaxEstateValue ?? 0) -
    (comparisonResult.summary.estimatedAfterTaxEstateValue ?? 0);

  return [
    `Compared with the reference scenario, first-year after-tax income is ${formatSignedCurrency(
      incomeDelta,
    )}.`,
    `First-year funding gap changes by ${formatSignedCurrency(
      gapDelta,
    )}, which helps show whether the plan is becoming more or less resilient.`,
    `After-tax estate changes by ${formatSignedCurrency(
      estateDelta,
    )} under the current assumptions.`,
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

function validateScenario(
  scenario: EditableScenario,
  partnerScenario: EditableMember | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!scenario.title.trim()) {
    issues.push({
      level: "warning",
      message: "Scenario title is blank, so exports and saved snapshots will be harder to recognize.",
    });
  }

  if (scenario.desiredAfterTaxSpending <= 0) {
    issues.push({
      level: "error",
      message: "Desired after-tax spending needs to be greater than zero.",
    });
  }

  issues.push(
    ...validatePercentScenarioValue(
      "Inflation rate",
      scenario.inflationRatePercent,
      0,
      10,
      6,
    ),
  );
  issues.push(
    ...validatePercentScenarioValue(
      "Pre-retirement return",
      scenario.preRetirementReturnRatePercent,
      -10,
      20,
      12,
    ),
  );
  issues.push(
    ...validatePercentScenarioValue(
      "Post-retirement return",
      scenario.postRetirementReturnRatePercent,
      -10,
      20,
      10,
    ),
  );
  issues.push(
    ...validatePercentScenarioValue(
      "Annual fee drag",
      scenario.annualFeeRatePercent,
      0,
      5,
      2,
    ),
  );

  if (scenario.householdType !== "single" && !partnerScenario) {
    issues.push({
      level: "error",
      message: "Married and common-law scenarios need a partner profile before the run is reliable.",
    });
  }

  if (
    scenario.householdType !== "single" &&
    (scenario.survivorSpendingPercent < 0 || scenario.survivorSpendingPercent > 100)
  ) {
    issues.push({
      level: "error",
      message: "Survivor spending must stay between 0% and 100% of the couple spending level.",
    });
  }

  if (scenario.householdType === "single" && scenario.pensionIncomeSplittingEnabled) {
    issues.push({
      level: "warning",
      message: "Pension income splitting is enabled, but this scenario is currently modeled as single.",
    });
  }

  if (scenario.gisModelingEnabled && scenario.desiredAfterTaxSpending > 70000) {
    issues.push({
      level: "warning",
      message: "GIS modeling is turned on, but the spending target is high enough that GIS will often stay irrelevant.",
    });
  }

  if (scenario.incomeTestedBenefitsBaseIncome.calendarYear < 1900) {
    issues.push({
      level: "error",
      message: "Prior-year GIS / Allowance seed year must be a valid calendar year.",
    });
  }

  if (scenario.incomeTestedBenefitsBaseIncome.primaryAssessableIncome < 0) {
    issues.push({
      level: "error",
      message: "Primary assessable income seed cannot be negative.",
    });
  }

  if (scenario.incomeTestedBenefitsBaseIncome.partnerAssessableIncome < 0) {
    issues.push({
      level: "error",
      message: "Partner assessable income seed cannot be negative.",
    });
  }

  if (scenario.incomeTestedBenefitsBaseIncome.combinedAssessableIncome < 0) {
    issues.push({
      level: "error",
      message: "Combined assessable income seed cannot be negative.",
    });
  }

  if (
    scenario.householdType === "single" &&
    scenario.incomeTestedBenefitsBaseIncome.partnerAssessableIncome > 0
  ) {
    issues.push({
      level: "warning",
      message: "Partner assessable income seed is entered, but the household is currently modeled as single.",
    });
  }

  if (
    scenario.incomeTestedBenefitsBaseIncome.combinedAssessableIncome > 0 &&
    scenario.incomeTestedBenefitsBaseIncome.combinedAssessableIncome <
      scenario.incomeTestedBenefitsBaseIncome.primaryAssessableIncome +
        (scenario.householdType === "single"
          ? 0
          : scenario.incomeTestedBenefitsBaseIncome.partnerAssessableIncome)
  ) {
    issues.push({
      level: "warning",
      message: "Combined assessable income seed is lower than the entered person-level assessable incomes.",
    });
  }

  for (const event of scenario.oneTimeEvents) {
    if (event.age < scenario.primary.age) {
      issues.push({
        level: "error",
        message: `One-time event "${event.description || "Untitled event"}" is set before the current primary age.`,
      });
    }

    if (event.amount <= 0) {
      issues.push({
        level: "error",
        message: `One-time event "${event.description || "Untitled event"}" needs an amount greater than zero.`,
      });
    }

    if (!event.description.trim()) {
      issues.push({
        level: "error",
        message: "Each one-time event needs a short description.",
      });
    }

    if (event.age > scenario.primary.lifeExpectancy) {
      issues.push({
        level: "warning",
        message: `One-time event "${event.description || "Untitled event"}" is beyond the primary life expectancy and may never be reached in the run.`,
      });
    }
  }

  issues.push(
    ...validateMember(
      "Primary",
      scenario.primary,
      scenario.province,
      scenario.householdType,
    ),
  );

  if (partnerScenario) {
    issues.push(
      ...validateMember(
        "Partner",
        partnerScenario,
        scenario.province,
        scenario.householdType,
      ),
    );
  }

  return issues;
}

function validateMember(
  label: string,
  member: EditableMember,
  province: ProvinceCode,
  householdType: HouseholdType,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pensionStartMax = member.pensionPlan === "QPP" ? 72 : 70;

  if (member.age < 18) {
    issues.push({
      level: "error",
      message: `${label} age must be at least 18.`,
    });
  }

  if (member.lifeExpectancy <= member.age) {
    issues.push({
      level: "error",
      message: `${label} life expectancy needs to be greater than current age.`,
    });
  }

  if (member.employmentIncome < 0) {
    issues.push({
      level: "error",
      message: `${label} employment income cannot be negative.`,
    });
  }

  for (const [fieldLabel, value] of [
    ["RRSP contribution", member.contributions.rrspAnnualContribution],
    ["TFSA contribution", member.contributions.tfsaAnnualContribution],
    [
      "non-registered contribution",
      member.contributions.nonRegisteredAnnualContribution,
    ],
    ["RRSP room remaining", member.contributions.rrspRoomRemaining],
    ["TFSA room remaining", member.contributions.tfsaRoomRemaining],
  ] as const) {
    if (value < 0) {
      issues.push({
        level: "error",
        message: `${label} ${fieldLabel} cannot be negative.`,
      });
    }
  }

  issues.push(
    ...validatePercentScenarioValue(
      `${label} contribution escalation`,
      member.contributions.escalationRatePercent,
      -10,
      20,
      10,
    ),
  );

  if (member.retirementPartTimeIncome.enabled) {
    if (member.retirementPartTimeIncome.annualAmount <= 0) {
      issues.push({
        level: "error",
        message: `${label} retirement part-time income needs an annual amount greater than zero when enabled.`,
      });
    }

    if (member.retirementPartTimeIncome.startAge < member.retirementAge) {
      issues.push({
        level: "warning",
        message: `${label} retirement part-time income starts before the retirement age currently entered.`,
      });
    }

    if (
      member.retirementPartTimeIncome.endAge > 0 &&
      member.retirementPartTimeIncome.endAge <
        member.retirementPartTimeIncome.startAge
    ) {
      issues.push({
        level: "error",
        message: `${label} retirement part-time income end age cannot be earlier than the start age.`,
      });
    }
  }

  if (member.cppMonthly < 0) {
    issues.push({
      level: "error",
      message: `${label} CPP / QPP monthly estimate cannot be negative.`,
    });
  }

  if (member.cppStartAge < 60 || member.cppStartAge > pensionStartMax) {
    issues.push({
      level: "error",
      message: `${label} ${member.pensionPlan} start age must stay between 60 and ${pensionStartMax}.`,
    });
  }

  if (member.oasStartAge < 65 || member.oasStartAge > 70) {
    issues.push({
      level: "error",
      message: `${label} OAS start age must stay between 65 and 70.`,
    });
  }

  if (member.oasResidenceYears < 0 || member.oasResidenceYears > 40) {
    issues.push({
      level: "error",
      message: `${label} OAS residence years must stay between 0 and 40.`,
    });
  }

  if (member.oasEligible && member.oasResidenceYears < 10) {
    issues.push({
      level: "warning",
      message: `${label} has fewer than 10 residence years entered, which often means OAS will depend on treaty rules or be unavailable.`,
    });
  }

  if (member.definedBenefitPension.enabled) {
    if (member.definedBenefitPension.annualAmount <= 0) {
      issues.push({
        level: "error",
        message: `${label} defined benefit pension needs an annual amount greater than zero when enabled.`,
      });
    }

    if (member.definedBenefitPension.startAge < 45) {
      issues.push({
        level: "warning",
        message: `${label} defined benefit pension start age is unusually early.`,
      });
    }

    issues.push(
      ...validatePercentScenarioValue(
        `${label} defined benefit indexation`,
        member.definedBenefitPension.indexationRatePercent,
        -5,
        10,
        4,
      ),
    );

    if (
      member.definedBenefitPension.survivorContinuationPercent < 0 ||
      member.definedBenefitPension.survivorContinuationPercent > 100
    ) {
      issues.push({
        level: "error",
        message: `${label} defined benefit survivor continuation percent must stay between 0% and 100%.`,
      });
    }
  }

  if (member.annuityIncome.enabled) {
    if (member.annuityIncome.annualAmount <= 0) {
      issues.push({
        level: "error",
        message: `${label} annuity income needs an annual amount greater than zero when enabled.`,
      });
    }

    if (member.annuityIncome.endAge > 0 && member.annuityIncome.endAge < member.annuityIncome.startAge) {
      issues.push({
        level: "error",
        message: `${label} annuity income end age cannot be earlier than the start age.`,
      });
    }
  }

  if (province === "QC" && member.pensionPlan !== "QPP") {
    issues.push({
      level: "warning",
      message: `${label} is in Quebec, so QPP is usually the more realistic public pension path.`,
    });
  }

  if (province !== "QC" && member.pensionPlan === "QPP") {
    issues.push({
      level: "warning",
      message: `${label} is outside Quebec, so CPP is usually the more realistic public pension path.`,
    });
  }

  for (const [accountLabel, value] of Object.entries(member.balances)) {
    if (value < 0) {
      issues.push({
        level: "error",
        message: `${label} ${accountLabel} balance cannot be negative.`,
      });
    }
  }

  if (member.lockedInPolicy.useCustomPolicy) {
    if (member.lockedInPolicy.plannedConversionAge < 0) {
      issues.push({
        level: "error",
        message: `${label} locked-in planned conversion age cannot be negative.`,
      });
    }

    if (member.lockedInPolicy.manualMinimumAnnualWithdrawal < 0) {
      issues.push({
        level: "error",
        message: `${label} locked-in manual minimum cannot be negative.`,
      });
    }

    if (member.lockedInPolicy.manualMaximumAnnualWithdrawal < 0) {
      issues.push({
        level: "error",
        message: `${label} locked-in manual maximum cannot be negative.`,
      });
    }

    if (
      member.lockedInPolicy.manualMaximumAnnualWithdrawal > 0 &&
      member.lockedInPolicy.manualMinimumAnnualWithdrawal > 0 &&
      member.lockedInPolicy.manualMaximumAnnualWithdrawal <
        member.lockedInPolicy.manualMinimumAnnualWithdrawal
    ) {
      issues.push({
        level: "warning",
        message: `${label} locked-in manual maximum is below the manual minimum, so the engine will effectively raise the cap to the minimum.`,
      });
    }

    issues.push(
      ...validatePercentScenarioValue(
        `${label} locked-in previous-year return`,
        member.lockedInPolicy.assumedPreviousYearReturnRatePercent,
        -20,
        20,
        12,
      ),
    );

    if (
      member.balances.lira > 0 &&
      member.lockedInPolicy.plannedConversionAge <= member.age
    ) {
      issues.push({
        level: "warning",
        message: `${label} still has a LIRA / CRI balance entered, but the planned conversion age is at or before the current age.`,
      });
    }

    if (
      member.lockedInPolicy.jurisdiction === "QC" &&
      member.lockedInPolicy.quebecTemporaryIncomeEstimatedOtherIncome < 0
    ) {
      issues.push({
        level: "error",
        message: `${label} Quebec temporary-income estimated other income cannot be negative.`,
      });
    }

    if (
      member.lockedInPolicy.jurisdiction !== "QC" &&
      (member.lockedInPolicy.quebecTemporaryIncomeRequested ||
        member.lockedInPolicy.quebecTemporaryIncomeOptionOffered !==
          "unspecified" ||
        member.lockedInPolicy.quebecTemporaryIncomeNoOtherFrvConfirmed !==
          "unspecified" ||
        member.lockedInPolicy.quebecTemporaryIncomeEstimatedOtherIncome > 0)
    ) {
      issues.push({
        level: "warning",
        message: `${label} has Quebec FRV temporary-income settings entered, but the locked-in jurisdiction is not Quebec.`,
      });
    }
  } else if (member.balances.lira > 0 || member.balances.lif > 0) {
    issues.push({
      level: "warning",
      message: `${label} has locked-in balances entered, but the UI is still using engine-inferred locked-in policy rules.`,
    });
  }

  if (member.rentalIncome < 0 || member.foreignPensionIncome < 0) {
    issues.push({
      level: "error",
      message: `${label} recurring outside income entries cannot be negative.`,
    });
  }

  for (const [fieldLabel, value] of [
    ["adjusted cost base", member.taxProfile.adjustedCostBase],
    ["capital loss carryforward", member.taxProfile.capitalLossCarryforward],
    ["annual interest income", member.taxProfile.annualInterestIncome],
    [
      "annual eligible dividend income",
      member.taxProfile.annualEligibleDividendIncome,
    ],
    [
      "annual non-eligible dividend income",
      member.taxProfile.annualNonEligibleDividendIncome,
    ],
    [
      "annual foreign dividend income",
      member.taxProfile.annualForeignDividendIncome,
    ],
    ["annual foreign tax paid", member.taxProfile.annualForeignTaxPaid],
    [
      "annual return of capital",
      member.taxProfile.annualReturnOfCapitalDistribution,
    ],
  ] as const) {
    if (value < 0) {
      issues.push({
        level: "error",
        message: `${label} ${fieldLabel} cannot be negative.`,
      });
    }
  }

  if (member.taxProfile.adjustedCostBase > 0 && member.balances.nonRegistered <= 0) {
    issues.push({
      level: "warning",
      message: `${label} has a non-registered ACB entered but no non-registered balance.`,
    });
  }

  if (
    member.taxProfile.annualForeignTaxPaid > 0 &&
    member.taxProfile.annualForeignDividendIncome <= 0 &&
    member.foreignPensionIncome <= 0
  ) {
    issues.push({
      level: "warning",
      message: `${label} has foreign tax paid entered without foreign dividend or foreign pension income.`,
    });
  }

  if (
    member.jointOwnership.nonRegisteredJointPercent < 0 ||
    member.jointOwnership.nonRegisteredJointPercent > 100
  ) {
    issues.push({
      level: "error",
      message: `${label} non-registered joint ownership percent must stay between 0% and 100%.`,
    });
  }

  if (member.jointOwnership.cashJointPercent < 0 || member.jointOwnership.cashJointPercent > 100) {
    issues.push({
      level: "error",
      message: `${label} cash joint ownership percent must stay between 0% and 100%.`,
    });
  }

  if (
    householdType === "single" &&
    (member.jointOwnership.nonRegisteredJointPercent > 0 ||
      member.jointOwnership.cashJointPercent > 0)
  ) {
    issues.push({
      level: "warning",
      message: `${label} has joint-with-spouse ownership entered, but the household is currently modeled as single.`,
    });
  }

  if (
    householdType === "single" &&
    Object.values(member.beneficiaryDesignations).some(
      (designation) => designation === "spouse",
    )
  ) {
    issues.push({
      level: "warning",
      message: `${label} has spouse beneficiary routing selected, but the household is currently modeled as single.`,
    });
  }

  if (member.livesAloneForTaxYear && province !== "QC") {
    issues.push({
      level: "warning",
      message: `${label} has the Quebec living-alone flag turned on, but the scenario province is outside Quebec.`,
    });
  }

  if (member.estateAdministration.manualQuebecVerificationCost < 0) {
    issues.push({
      level: "error",
      message: `${label} manual Quebec verification cost cannot be negative.`,
    });
  }

  if (
    member.estateAdministration.quebecWillForm !== "unknown" &&
    province !== "QC"
  ) {
    issues.push({
      level: "warning",
      message: `${label} has Quebec will inputs entered, but the province is currently outside Quebec.`,
    });
  }

  if (
    member.estateAdministration.quebecWillForm === "notarial" &&
    member.estateAdministration.quebecWillVerificationMethod !== "unknown" &&
    member.estateAdministration.quebecWillVerificationMethod !== "not-required"
  ) {
    issues.push({
      level: "warning",
      message: `${label} is marked as having a notarial Quebec will, which usually does not require verification.`,
    });
  }

  if (member.retirementAge < 45 || member.retirementAge > 80) {
    issues.push({
      level: "warning",
      message: `${label} retirement age is outside the typical 45-80 planning band, so double-check the intent.`,
    });
  }

  return issues;
}

function validatePercentScenarioValue(
  label: string,
  value: number,
  minimum: number,
  maximum: number,
  warningThreshold: number,
): ValidationIssue[] {
  if (value < minimum || value > maximum) {
    return [
      {
        level: "error",
        message: `${label} must stay between ${minimum}% and ${maximum}%.`,
      },
    ];
  }

  if (Math.abs(value) > warningThreshold) {
    return [
      {
        level: "warning",
        message: `${label} is set to ${formatDisplayPercent(
          value,
        )}, which is outside a typical planning range.`,
      },
    ];
  }

  return [];
}

function parseScenarioTransferEnvelope(raw: string): ScenarioTransferEnvelope {
  const parsed = JSON.parse(raw) as Partial<ScenarioTransferEnvelope>;

  if (parsed.version !== scenarioTransferVersion) {
    throw new Error("This JSON file is not a supported retirement UI scenario export.");
  }

  if (!parsed.scenario || typeof parsed.scenario !== "object") {
    throw new Error("Imported file is missing the scenario payload.");
  }

  if (typeof parsed.presetId !== "string") {
    throw new Error("Imported file is missing a valid preset id.");
  }

  return parsed as ScenarioTransferEnvelope;
}

function normalizeImportedScenario(
  scenario: EditableScenario,
  preset: UiPreset,
): EditableScenario {
  const fallback = createEditableScenario(preset);
  const nextHouseholdType = householdTypeOptions.includes(scenario.householdType)
    ? scenario.householdType
    : fallback.householdType;
  const nextProvince = provinceOptions.includes(scenario.province)
    ? scenario.province
    : fallback.province;
  const fallbackPartner =
    fallback.partner ?? createDefaultPartnerEditable(nextProvince);

  return {
    presetId: typeof scenario.presetId === "string" ? scenario.presetId : preset.id,
    title:
      typeof scenario.title === "string" && scenario.title.trim()
        ? scenario.title
        : fallback.title,
    householdType: nextHouseholdType,
    province: nextProvince,
    inflationRatePercent: safeNumber(
      scenario.inflationRatePercent,
      fallback.inflationRatePercent,
    ),
    preRetirementReturnRatePercent: safeNumber(
      scenario.preRetirementReturnRatePercent,
      fallback.preRetirementReturnRatePercent,
    ),
    postRetirementReturnRatePercent: safeNumber(
      scenario.postRetirementReturnRatePercent,
      fallback.postRetirementReturnRatePercent,
    ),
    annualFeeRatePercent: safeNumber(
      scenario.annualFeeRatePercent,
      fallback.annualFeeRatePercent,
    ),
    withdrawalOrder: withdrawalOrderOptions.some(
      (option) => option.value === scenario.withdrawalOrder,
    )
      ? scenario.withdrawalOrder
      : fallback.withdrawalOrder,
    pensionIncomeSplittingEnabled: Boolean(scenario.pensionIncomeSplittingEnabled),
    oasClawbackAwareMode: Boolean(scenario.oasClawbackAwareMode),
    gisModelingEnabled: Boolean(scenario.gisModelingEnabled),
    desiredAfterTaxSpending: safeNumber(
      scenario.desiredAfterTaxSpending,
      fallback.desiredAfterTaxSpending,
    ),
    survivorSpendingPercent: safeNumber(
      scenario.survivorSpendingPercent,
      fallback.survivorSpendingPercent,
    ),
    incomeTestedBenefitsBaseIncome: {
      primaryAssessableIncome: safeNumber(
        scenario.incomeTestedBenefitsBaseIncome?.primaryAssessableIncome,
        fallback.incomeTestedBenefitsBaseIncome.primaryAssessableIncome,
      ),
      partnerAssessableIncome: safeNumber(
        scenario.incomeTestedBenefitsBaseIncome?.partnerAssessableIncome,
        fallback.incomeTestedBenefitsBaseIncome.partnerAssessableIncome,
      ),
      combinedAssessableIncome: safeNumber(
        scenario.incomeTestedBenefitsBaseIncome?.combinedAssessableIncome,
        fallback.incomeTestedBenefitsBaseIncome.combinedAssessableIncome,
      ),
      calendarYear: safeNumber(
        scenario.incomeTestedBenefitsBaseIncome?.calendarYear,
        fallback.incomeTestedBenefitsBaseIncome.calendarYear,
      ),
    },
    oneTimeEvents: normalizeImportedOneTimeEvents(
      scenario.oneTimeEvents,
      fallback.oneTimeEvents,
    ),
    primary: normalizeImportedMember(scenario.primary, fallback.primary),
    partner:
      scenario.partner || nextHouseholdType !== "single"
        ? normalizeImportedMember(scenario.partner ?? fallbackPartner, fallbackPartner)
        : null,
  };
}

function normalizeImportedMember(
  member: EditableMember,
  fallback: EditableMember,
): EditableMember {
  return {
    age: safeNumber(member?.age, fallback.age),
    retirementAge: safeNumber(member?.retirementAge, fallback.retirementAge),
    lifeExpectancy: safeNumber(member?.lifeExpectancy, fallback.lifeExpectancy),
    pensionPlan: pensionPlanOptions.includes(member?.pensionPlan)
      ? member.pensionPlan
      : fallback.pensionPlan,
    livesAloneForTaxYear:
      typeof member?.livesAloneForTaxYear === "boolean"
        ? member.livesAloneForTaxYear
        : fallback.livesAloneForTaxYear,
    employmentIncome: safeNumber(
      member?.employmentIncome,
      fallback.employmentIncome,
    ),
    contributions: {
      rrspAnnualContribution: safeNumber(
        member?.contributions?.rrspAnnualContribution,
        fallback.contributions.rrspAnnualContribution,
      ),
      tfsaAnnualContribution: safeNumber(
        member?.contributions?.tfsaAnnualContribution,
        fallback.contributions.tfsaAnnualContribution,
      ),
      nonRegisteredAnnualContribution: safeNumber(
        member?.contributions?.nonRegisteredAnnualContribution,
        fallback.contributions.nonRegisteredAnnualContribution,
      ),
      escalationRatePercent: safeNumber(
        member?.contributions?.escalationRatePercent,
        fallback.contributions.escalationRatePercent,
      ),
      rrspRoomRemaining: safeNumber(
        member?.contributions?.rrspRoomRemaining,
        fallback.contributions.rrspRoomRemaining,
      ),
      tfsaRoomRemaining: safeNumber(
        member?.contributions?.tfsaRoomRemaining,
        fallback.contributions.tfsaRoomRemaining,
      ),
    },
    retirementPartTimeIncome: {
      enabled:
        typeof member?.retirementPartTimeIncome?.enabled === "boolean"
          ? member.retirementPartTimeIncome.enabled
          : fallback.retirementPartTimeIncome.enabled,
      annualAmount: safeNumber(
        member?.retirementPartTimeIncome?.annualAmount,
        fallback.retirementPartTimeIncome.annualAmount,
      ),
      startAge: safeNumber(
        member?.retirementPartTimeIncome?.startAge,
        fallback.retirementPartTimeIncome.startAge,
      ),
      endAge: safeNumber(
        member?.retirementPartTimeIncome?.endAge,
        fallback.retirementPartTimeIncome.endAge,
      ),
      inflationLinked:
        typeof member?.retirementPartTimeIncome?.inflationLinked === "boolean"
          ? member.retirementPartTimeIncome.inflationLinked
          : fallback.retirementPartTimeIncome.inflationLinked,
    },
    cppMonthly: safeNumber(member?.cppMonthly, fallback.cppMonthly),
    cppStartAge: safeNumber(member?.cppStartAge, fallback.cppStartAge),
    oasStartAge: safeNumber(member?.oasStartAge, fallback.oasStartAge),
    oasResidenceYears: safeNumber(
      member?.oasResidenceYears,
      fallback.oasResidenceYears,
    ),
    oasEligible:
      typeof member?.oasEligible === "boolean"
        ? member.oasEligible
        : fallback.oasEligible,
    definedBenefitPension: {
      enabled:
        typeof member?.definedBenefitPension?.enabled === "boolean"
          ? member.definedBenefitPension.enabled
          : fallback.definedBenefitPension.enabled,
      annualAmount: safeNumber(
        member?.definedBenefitPension?.annualAmount,
        fallback.definedBenefitPension.annualAmount,
      ),
      startAge: safeNumber(
        member?.definedBenefitPension?.startAge,
        fallback.definedBenefitPension.startAge,
      ),
      indexationRatePercent: safeNumber(
        member?.definedBenefitPension?.indexationRatePercent,
        fallback.definedBenefitPension.indexationRatePercent,
      ),
      bridgeTo65AnnualAmount: safeNumber(
        member?.definedBenefitPension?.bridgeTo65AnnualAmount,
        fallback.definedBenefitPension.bridgeTo65AnnualAmount,
      ),
      survivorContinuationPercent: safeNumber(
        member?.definedBenefitPension?.survivorContinuationPercent,
        fallback.definedBenefitPension.survivorContinuationPercent,
      ),
    },
    annuityIncome: {
      enabled:
        typeof member?.annuityIncome?.enabled === "boolean"
          ? member.annuityIncome.enabled
          : fallback.annuityIncome.enabled,
      annualAmount: safeNumber(
        member?.annuityIncome?.annualAmount,
        fallback.annuityIncome.annualAmount,
      ),
      startAge: safeNumber(
        member?.annuityIncome?.startAge,
        fallback.annuityIncome.startAge,
      ),
      endAge: safeNumber(
        member?.annuityIncome?.endAge,
        fallback.annuityIncome.endAge,
      ),
      inflationLinked:
        typeof member?.annuityIncome?.inflationLinked === "boolean"
          ? member.annuityIncome.inflationLinked
          : fallback.annuityIncome.inflationLinked,
    },
    rentalIncome: safeNumber(member?.rentalIncome, fallback.rentalIncome),
    foreignPensionIncome: safeNumber(
      member?.foreignPensionIncome,
      fallback.foreignPensionIncome,
    ),
    balances: {
      rrsp: safeNumber(member?.balances?.rrsp, fallback.balances.rrsp),
      rrif: safeNumber(member?.balances?.rrif, fallback.balances.rrif),
      tfsa: safeNumber(member?.balances?.tfsa, fallback.balances.tfsa),
      nonRegistered: safeNumber(
        member?.balances?.nonRegistered,
        fallback.balances.nonRegistered,
      ),
      cash: safeNumber(member?.balances?.cash, fallback.balances.cash),
      lira: safeNumber(member?.balances?.lira, fallback.balances.lira),
      lif: safeNumber(member?.balances?.lif, fallback.balances.lif),
    },
    lockedInPolicy: {
      useCustomPolicy:
        typeof member?.lockedInPolicy?.useCustomPolicy === "boolean"
          ? member.lockedInPolicy.useCustomPolicy
          : fallback.lockedInPolicy.useCustomPolicy,
      jurisdiction: lockedInJurisdictionOptions.includes(
        member?.lockedInPolicy?.jurisdiction as LockedInJurisdictionCode,
      )
        ? (member?.lockedInPolicy?.jurisdiction as LockedInJurisdictionCode)
        : fallback.lockedInPolicy.jurisdiction,
      plannedConversionAge: safeNumber(
        member?.lockedInPolicy?.plannedConversionAge,
        fallback.lockedInPolicy.plannedConversionAge,
      ),
      manualMinimumAnnualWithdrawal: safeNumber(
        member?.lockedInPolicy?.manualMinimumAnnualWithdrawal,
        fallback.lockedInPolicy.manualMinimumAnnualWithdrawal,
      ),
      manualMaximumAnnualWithdrawal: safeNumber(
        member?.lockedInPolicy?.manualMaximumAnnualWithdrawal,
        fallback.lockedInPolicy.manualMaximumAnnualWithdrawal,
      ),
      assumedPreviousYearReturnRatePercent: safeNumber(
        member?.lockedInPolicy?.assumedPreviousYearReturnRatePercent,
        fallback.lockedInPolicy.assumedPreviousYearReturnRatePercent,
      ),
      quebecTemporaryIncomeRequested:
        typeof member?.lockedInPolicy?.quebecTemporaryIncomeRequested === "boolean"
          ? member.lockedInPolicy.quebecTemporaryIncomeRequested
          : fallback.lockedInPolicy.quebecTemporaryIncomeRequested,
      quebecTemporaryIncomeOptionOffered: lockedInBooleanChoiceOptions.some(
        (option) =>
          option.value === member?.lockedInPolicy?.quebecTemporaryIncomeOptionOffered,
      )
        ? member?.lockedInPolicy?.quebecTemporaryIncomeOptionOffered ??
          fallback.lockedInPolicy.quebecTemporaryIncomeOptionOffered
        : fallback.lockedInPolicy.quebecTemporaryIncomeOptionOffered,
      quebecTemporaryIncomeNoOtherFrvConfirmed:
        lockedInBooleanChoiceOptions.some(
          (option) =>
            option.value ===
            member?.lockedInPolicy?.quebecTemporaryIncomeNoOtherFrvConfirmed,
        )
          ? member?.lockedInPolicy?.quebecTemporaryIncomeNoOtherFrvConfirmed ??
            fallback.lockedInPolicy.quebecTemporaryIncomeNoOtherFrvConfirmed
          : fallback.lockedInPolicy.quebecTemporaryIncomeNoOtherFrvConfirmed,
      quebecTemporaryIncomeEstimatedOtherIncome: safeNumber(
        member?.lockedInPolicy?.quebecTemporaryIncomeEstimatedOtherIncome,
        fallback.lockedInPolicy.quebecTemporaryIncomeEstimatedOtherIncome,
      ),
    },
    taxProfile: {
      adjustedCostBase: safeNumber(
        member?.taxProfile?.adjustedCostBase,
        fallback.taxProfile.adjustedCostBase,
      ),
      capitalLossCarryforward: safeNumber(
        member?.taxProfile?.capitalLossCarryforward,
        fallback.taxProfile.capitalLossCarryforward,
      ),
      annualInterestIncome: safeNumber(
        member?.taxProfile?.annualInterestIncome,
        fallback.taxProfile.annualInterestIncome,
      ),
      annualEligibleDividendIncome: safeNumber(
        member?.taxProfile?.annualEligibleDividendIncome,
        fallback.taxProfile.annualEligibleDividendIncome,
      ),
      annualNonEligibleDividendIncome: safeNumber(
        member?.taxProfile?.annualNonEligibleDividendIncome,
        fallback.taxProfile.annualNonEligibleDividendIncome,
      ),
      annualForeignDividendIncome: safeNumber(
        member?.taxProfile?.annualForeignDividendIncome,
        fallback.taxProfile.annualForeignDividendIncome,
      ),
      annualForeignTaxPaid: safeNumber(
        member?.taxProfile?.annualForeignTaxPaid,
        fallback.taxProfile.annualForeignTaxPaid,
      ),
      annualReturnOfCapitalDistribution: safeNumber(
        member?.taxProfile?.annualReturnOfCapitalDistribution,
        fallback.taxProfile.annualReturnOfCapitalDistribution,
      ),
    },
    beneficiaryDesignations: {
      rrsp: beneficiaryDesignationOptions.some(
        (option) => option.value === member?.beneficiaryDesignations?.rrsp,
      )
        ? member?.beneficiaryDesignations?.rrsp ?? fallback.beneficiaryDesignations.rrsp
        : fallback.beneficiaryDesignations.rrsp,
      rrif: beneficiaryDesignationOptions.some(
        (option) => option.value === member?.beneficiaryDesignations?.rrif,
      )
        ? member?.beneficiaryDesignations?.rrif ?? fallback.beneficiaryDesignations.rrif
        : fallback.beneficiaryDesignations.rrif,
      tfsa: beneficiaryDesignationOptions.some(
        (option) => option.value === member?.beneficiaryDesignations?.tfsa,
      )
        ? member?.beneficiaryDesignations?.tfsa ?? fallback.beneficiaryDesignations.tfsa
        : fallback.beneficiaryDesignations.tfsa,
      lif: beneficiaryDesignationOptions.some(
        (option) => option.value === member?.beneficiaryDesignations?.lif,
      )
        ? member?.beneficiaryDesignations?.lif ?? fallback.beneficiaryDesignations.lif
        : fallback.beneficiaryDesignations.lif,
    },
    jointOwnership: {
      nonRegisteredJointPercent: safeNumber(
        member?.jointOwnership?.nonRegisteredJointPercent,
        fallback.jointOwnership.nonRegisteredJointPercent,
      ),
      cashJointPercent: safeNumber(
        member?.jointOwnership?.cashJointPercent,
        fallback.jointOwnership.cashJointPercent,
      ),
    },
    estateAdministration: {
      quebecWillForm: quebecWillFormOptions.some(
        (option) => option.value === member?.estateAdministration?.quebecWillForm,
      )
        ? member?.estateAdministration?.quebecWillForm ??
          fallback.estateAdministration.quebecWillForm
        : fallback.estateAdministration.quebecWillForm,
      quebecWillVerificationMethod: quebecWillVerificationMethodOptions.some(
        (option) =>
          option.value === member?.estateAdministration?.quebecWillVerificationMethod,
      )
        ? member?.estateAdministration?.quebecWillVerificationMethod ??
          fallback.estateAdministration.quebecWillVerificationMethod
        : fallback.estateAdministration.quebecWillVerificationMethod,
      manualQuebecVerificationCost: safeNumber(
        member?.estateAdministration?.manualQuebecVerificationCost,
        fallback.estateAdministration.manualQuebecVerificationCost,
      ),
    },
  };
}

function normalizeImportedOneTimeEvents(
  events: EditableOneTimeEvent[] | undefined,
  fallbackEvents: EditableOneTimeEvent[],
): EditableOneTimeEvent[] {
  if (!Array.isArray(events)) {
    return fallbackEvents.map((event) => createEditableOneTimeEvent(event));
  }

  return events.map((event, index) =>
    createEditableOneTimeEvent({
      age: safeNumber(event?.age, fallbackEvents[index]?.age ?? 65),
      amount: safeNumber(event?.amount, fallbackEvents[index]?.amount ?? 10000),
      direction:
        event?.direction === "inflow" || event?.direction === "outflow"
          ? event.direction
          : fallbackEvents[index]?.direction ?? "outflow",
      description:
        typeof event?.description === "string"
          ? event.description
          : fallbackEvents[index]?.description ?? "One-time event",
    }),
  );
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
    const parsed = JSON.parse(raw) as Partial<SavedScenarioRecord>[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is Partial<SavedScenarioRecord> => Boolean(entry))
      .map((entry) => {
        const preset =
          uiPresets.find((candidate) => candidate.id === entry.presetId) ??
          defaultUiPreset;
        const normalizedScenario = normalizeImportedScenario(
          (entry.scenario as EditableScenario | undefined) ??
            createEditableScenario(preset),
          preset,
        );

        return {
          id:
            typeof entry.id === "string" && entry.id.trim()
              ? entry.id
              : createScenarioSnapshotId(),
          label:
            typeof entry.label === "string" && entry.label.trim()
              ? entry.label
              : normalizedScenario.title,
          presetId: preset.id,
          savedAt:
            typeof entry.savedAt === "string" && entry.savedAt.trim()
              ? entry.savedAt
              : new Date().toISOString(),
          scenario: normalizedScenario,
        };
      });
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

function readAutosaveDraft(): EditableScenario | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(autosaveDraftStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as EditableScenario;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeAutosaveDraft(scenario: EditableScenario) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    autosaveDraftStorageKey,
    JSON.stringify(deepClone(scenario)),
  );
}

function clearAutosaveDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(autosaveDraftStorageKey);
}

function createScenarioSnapshotId() {
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugifyFileName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "retirement-scenario";
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

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function toPercentValue(decimalRate: number): number {
  return Number((decimalRate * 100).toFixed(2));
}

function fromPercentValue(percentRate: number): number {
  return percentRate / 100;
}

function formatDisplayPercent(value: number): string {
  return `${value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedCurrency(value: number): string {
  const absoluteValue = formatCurrency(Math.abs(value));
  if (value > 0) {
    return `+${absoluteValue}`;
  }
  if (value < 0) {
    return `-${absoluteValue}`;
  }
  return absoluteValue;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}
