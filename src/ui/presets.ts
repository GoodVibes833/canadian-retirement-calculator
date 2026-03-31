import type { SimulationInput } from "../domain/types.js";
import ontarioCoupleCore from "../../data/fixtures/golden/golden-on-couple-core.json";
import britishColumbiaImmigrant from "../../data/fixtures/golden/golden-bc-immigrant-partial-oas.json";
import quebecCoupleCore from "../../data/fixtures/golden/golden-qc-couple-core.json";

export interface UiPreset {
  id: string;
  label: string;
  description: string;
  input: SimulationInput;
}

export const uiPresets: UiPreset[] = [
  {
    id: "on-couple-core",
    label: "Ontario Couple Core",
    description: "Balanced near-retirement couple with registered savings and standard public benefits.",
    input: ontarioCoupleCore as SimulationInput,
  },
  {
    id: "bc-immigrant",
    label: "BC Immigrant Partial OAS",
    description: "Shorter-residence household with foreign pension income and partial OAS dynamics.",
    input: britishColumbiaImmigrant as SimulationInput,
  },
  {
    id: "qc-couple-core",
    label: "Quebec Couple Core",
    description: "QPP and Quebec tax path scenario with province-specific retirement behavior.",
    input: quebecCoupleCore as SimulationInput,
  },
];

export const defaultUiPreset = uiPresets[0];
