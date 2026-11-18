export const TOOL_ID = "dao-governance" as const;
export const SCHEMA_VERSION = 1 as const;
export const METHODOLOGY_VERSION = 1 as const;
export const MAX_GROUPS = 12;
export const MAX_POWER = 1e12;

export type Locale = "en" | "de";
export type QuorumBasis = "all" | "decisive";
export interface Group {
  id: string;
  name: string;
  power: number;
  participation: number;
  yes: number;
  no: number;
  abstain: number;
  delegateTo: string | null;
}
export interface Scenario {
  title: string;
  notes: string;
  quorum: number;
  quorumBasis: QuorumBasis;
  approval: number;
  groups: Group[];
}
export interface Model {
  tool: typeof TOOL_ID;
  schemaVersion: typeof SCHEMA_VERSION;
  methodologyVersion: typeof METHODOLOGY_VERSION;
  baseline: Scenario;
  scenario: Scenario;
}
export type IssueCode = "structure" | "version" | "text" | "range" | "groups" | "id" | "split" | "delegation" | "size" | "encoding";
export interface Issue { path: string; code: IssueCode }
export type Validation = { ok: true; model: Model } | { ok: false; issues: Issue[] };

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Strict validation: incoming data is never coerced, clamped, or merged with defaults. */
export function validateModel(input: unknown): Validation {
  const issues: Issue[] = [];
  const fail = (path: string, code: IssueCode) => issues.push({ path, code });
  const keys = (v: Record<string, unknown>, allowed: string[], path: string) => {
    if (Object.keys(v).some((key) => !allowed.includes(key))) fail(path, "structure");
  };
  const text = (v: unknown, max: number, path: string) => {
    if (typeof v !== "string" || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) fail(path, "text");
  };
  const number = (v: unknown, max: number, path: string) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) fail(path, "range");
  };
  if (!record(input)) return { ok: false, issues: [{ path: "model", code: "structure" }] };
  keys(input, ["tool", "schemaVersion", "methodologyVersion", "baseline", "scenario"], "model");
  if (input.tool !== TOOL_ID || input.schemaVersion !== SCHEMA_VERSION || input.methodologyVersion !== METHODOLOGY_VERSION) fail("model", "version");
  for (const side of ["baseline", "scenario"] as const) {
    const s = input[side];
    if (!record(s)) { fail(side, "structure"); continue; }
    keys(s, ["title", "notes", "quorum", "quorumBasis", "approval", "groups"], side);
    text(s.title, 100, `${side}.title`);
    text(s.notes, 2000, `${side}.notes`);
    number(s.quorum, 100, `${side}.quorum`);
    number(s.approval, 100, `${side}.approval`);
    if (s.quorumBasis !== "all" && s.quorumBasis !== "decisive") fail(`${side}.quorumBasis`, "structure");
    if (!Array.isArray(s.groups) || s.groups.length < 1 || s.groups.length > MAX_GROUPS) { fail(`${side}.groups`, "groups"); continue; }
    const ids = new Set<string>();
    for (const [index, g] of s.groups.entries()) {
      const path = `${side}.groups.${index}`;
      if (!record(g)) { fail(path, "structure"); continue; }
      keys(g, ["id", "name", "power", "participation", "yes", "no", "abstain", "delegateTo"], path);
      if (typeof g.id !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(g.id) || ids.has(g.id)) fail(`${path}.id`, "id");
      else ids.add(g.id);
      text(g.name, 60, `${path}.name`);
      number(g.power, MAX_POWER, `${path}.power`);
      for (const key of ["participation", "yes", "no", "abstain"]) number(g[key], 100, `${path}.${key}`);
      // Tolerance applies only to input decimal addition, never to outcome thresholds.
      if (typeof g.yes === "number" && typeof g.no === "number" && typeof g.abstain === "number" && Math.abs(g.yes + g.no + g.abstain - 100) > 1e-9) fail(path, "split");
      if (g.delegateTo !== null && (typeof g.delegateTo !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(g.delegateTo))) fail(`${path}.delegateTo`, "delegation");
    }
    for (const [index, g] of s.groups.entries()) {
      if (!record(g) || g.delegateTo === null) continue;
      const target = s.groups.find((other) => record(other) && other.id === g.delegateTo);
      // A recipient must exercise directly. This excludes chains, cycles and self-delegation.
      if (!record(target) || g.delegateTo === g.id || target.delegateTo !== null) fail(`${side}.groups.${index}.delegateTo`, "delegation");
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, model: structuredClone(input) as unknown as Model };
}

export function wrapScenario(scenario: Scenario): Model {
  return { tool: TOOL_ID, schemaVersion: SCHEMA_VERSION, methodologyVersion: METHODOLOGY_VERSION, baseline: structuredClone(scenario), scenario: structuredClone(scenario) };
}
