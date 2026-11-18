import { wrapScenario, type Group, type Locale, type Model } from "./model";

export const presetIds = ["founders", "distributed", "delegates"] as const;
export type PresetId = typeof presetIds[number];
export const presetNames = {
  en: { founders: "Concentrated founders", distributed: "Broad ownership, low turnout", delegates: "Delegate-led participation" },
  de: { founders: "Konzentriertes Gründerteam", distributed: "Breiter Besitz, geringe Beteiligung", delegates: "Delegierten-geführte Beteiligung" },
};

export function preset(id: PresetId, locale: Locale): Model {
  const names = locale === "en" ? ["Founders", "Contributors", "Community", "Delegates"] : ["Gründerteam", "Mitwirkende", "Community", "Delegierte"];
  const group = (i: number, power: number, participation: number, yes: number, no: number, delegateTo: string | null = null): Group => ({
    id: `g${i + 1}`, name: names[i], power, participation, yes, no, abstain: 100 - yes - no, delegateTo,
  });
  const groups = id === "founders"
    ? [group(0, 550, 90, 90, 10), group(1, 200, 70, 40, 50), group(2, 200, 25, 30, 60), group(3, 50, 100, 70, 20)]
    : id === "distributed"
      ? [group(0, 150, 20, 80, 20), group(1, 250, 15, 60, 30), group(2, 500, 8, 55, 35), group(3, 100, 40, 70, 20)]
      : [group(0, 200, 60, 50, 40), group(1, 250, 50, 70, 20, "g4"), group(2, 450, 10, 40, 40, "g4"), group(3, 100, 85, 65, 25)];
  return wrapScenario({ title: presetNames[locale][id], notes: "", quorum: 20, quorumBasis: "all", approval: 50, groups });
}
