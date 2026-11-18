import type { Group, Scenario } from "./model";

/** Compare thresholds as exact decimals, so floating addition cannot flip a boundary. */
function exactVotes(s: Scenario) {
  const values = [s.quorum, s.approval, ...s.groups.flatMap((g) => [g.power, g.participation, g.yes, g.no, g.abstain])];
  const parts = (n: number) => { const [coefficient, exponent = "0"] = n.toString().split("e"); return { coefficient, exponent: Number(exponent), decimals: (coefficient.split(".")[1] ?? "").length }; };
  const places = Math.max(...values.map((n) => { const p = parts(n); return Math.max(0, p.decimals - p.exponent); }));
  const unit = 10n ** BigInt(places);
  const scaled = (n: number) => { const p = parts(n); return BigInt(p.coefficient.replace(".", "")) * 10n ** BigInt(places + p.exponent - p.decimals); };
  const controlled = new Map(s.groups.map((g) => [g.id, 0n]));
  let total = 0n;
  for (const g of s.groups) {
    const power = scaled(g.power), target = g.delegateTo ?? g.id;
    total += power;
    controlled.set(target, (controlled.get(target) ?? 0n) + power);
  }
  let cast = 0n, yes = 0n, no = 0n, abstain = 0n;
  const groups = s.groups.map((group) => {
    const power = controlled.get(group.id) ?? 0n;
    const c = power * scaled(group.participation);
    const y = c * scaled(group.yes), n = c * scaled(group.no), a = c * scaled(group.abstain);
    cast += c; yes += y; no += n; abstain += a;
    return { group, effectivePower: decimal(power, places), cast: decimal(c, 2 * places + 2), yes: decimal(y, 3 * places + 4), no: decimal(n, 3 * places + 4), abstain: decimal(a, 3 * places + 4) };
  });
  const quorumRequired = total * scaled(s.quorum);
  const quorumMet = total > 0n && (s.quorumBasis === "all" ? cast >= quorumRequired : yes + no >= quorumRequired * 100n * unit);
  const approvalMet = yes + no > 0n && yes * 100n * unit > (yes + no) * scaled(s.approval);
  return {
    groups, total: decimal(total, places), cast: decimal(cast, 2 * places + 2), yes: decimal(yes, 3 * places + 4), no: decimal(no, 3 * places + 4), abstain: decimal(abstain, 3 * places + 4),
    quorumMet, approvalMet, turnout: percent(cast, total * 100n * unit),
    quorumPercent: s.quorumBasis === "all" ? percent(cast, total * 100n * unit) : percent(yes + no, total * 10000n * unit * unit),
    approvalPercent: yes + no > 0n ? percent(yes, yes + no) : null,
  };
}

function decimal(n: bigint, places: number): number { return Number(`${n}e-${places}`); }
function percent(n: bigint, d: bigint): number {
  if (d === 0n || n === 0n) return 0;
  const ns = n.toString(), ds = d.toString();
  return Number(`0.${ns}`) / Number(`0.${ds}`) * 10 ** (ns.length - ds.length) * 100;
}

export interface ExercisedGroup {
  group: Group;
  effectivePower: number;
  cast: number;
  yes: number;
  no: number;
  abstain: number;
}
export interface Tally {
  total: number;
  cast: number;
  yes: number;
  no: number;
  abstain: number;
  turnout: number;
  quorumVotes: number;
  quorumPercent: number;
  requiredQuorum: number;
  quorumMet: boolean;
  approvalPercent: number | null;
  approvalMet: boolean;
  passed: boolean;
  delegated: number;
  largestBefore: number;
  largestAfter: number;
  hhiBefore: number;
  hhiAfter: number;
  groups: ExercisedGroup[];
}

/** Accepts validated scenarios only. Each source's entire power is assigned exactly once. */
export function tally(s: Scenario): Tally {
  const { total, groups, cast, yes, no, abstain, turnout, quorumPercent, quorumMet, approvalPercent, approvalMet } = exactVotes(s);
  // Valid ballot splits total 100%. Counting all ballots therefore counts cast power.
  const quorumVotes = s.quorumBasis === "all" ? cast : yes + no;
  const requiredQuorum = total * (s.quorum / 100);
  const share = (value: number) => total > 0 ? value / total : 0;
  return {
    total, cast, yes, no, abstain, turnout, quorumVotes, quorumPercent,
    requiredQuorum, quorumMet, approvalPercent, approvalMet, passed: quorumMet && approvalMet,
    delegated: s.groups.reduce((n, g) => n + (g.delegateTo ? g.power : 0), 0),
    largestBefore: Math.max(...s.groups.map((g) => share(g.power))) * 100,
    largestAfter: Math.max(...groups.map((g) => share(g.effectivePower))) * 100,
    hhiBefore: s.groups.reduce((n, g) => n + share(g.power) ** 2, 0) * 10000,
    hhiAfter: groups.reduce((n, g) => n + share(g.effectivePower) ** 2, 0) * 10000,
    groups,
  };
}

/** Uniform absolute turnout, 0–100% at ten-point intervals; all other assumptions stay fixed. */
export function sensitivity(s: Scenario) {
  return Array.from({ length: 11 }, (_, index) => {
    const participation = index * 10;
    return { participation, result: tally({ ...s, groups: s.groups.map((g) => ({ ...g, participation })) }) };
  });
}

export type OtherBehavior = "opposed" | "unchanged" | "absent";
export type CoalitionAction = "pass" | "prevent";
/** Selected exercising groups vote unanimously at 100% turnout; delegation is unchanged. */
export function coalitionScenario(s: Scenario, selected: string[], action: CoalitionAction, others: OtherBehavior): Scenario {
  return { ...s, groups: s.groups.map((g) => {
    if (g.delegateTo) return { ...g };
    const included = selected.includes(g.id);
    if (!included && others === "unchanged") return { ...g };
    if (!included && others === "absent") return { ...g, participation: 0 };
    const yes = included ? action === "pass" : action === "prevent";
    return { ...g, participation: 100, yes: yes ? 100 : 0, no: yes ? 0 : 100, abstain: 0 };
  }) };
}

export function coalition(s: Scenario, selected: string[], action: CoalitionAction, others: OtherBehavior) {
  const result = tally(coalitionScenario(s, selected, action, others));
  const power = result.groups.reduce((sum, g) => sum + (selected.includes(g.group.id) ? g.effectivePower : 0), 0);
  return { result, power, succeeds: action === "pass" ? result.passed : !result.passed };
}
