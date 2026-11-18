import test from "node:test";
import assert from "node:assert/strict";
import { coalition, coalitionScenario, sensitivity, tally } from "../../../tools/dao-governance/engine.ts";
import { validateModel, wrapScenario } from "../../../tools/dao-governance/model.ts";
import { decodeShare, encodeShare, jsonFile, MAX_ENCODED_LENGTH, MAX_JSON_BYTES, readJson, shareModel } from "../../../tools/dao-governance/codec.ts";
import { preset, presetIds } from "../../../tools/dao-governance/presets.ts";
import { reportLines, wrapReportText } from "../../../tools/dao-governance/report.ts";

function fixture(yes, no, abstain, changes = {}) {
  return {
    title: "Test", notes: "", quorum: 20, quorumBasis: "all", approval: 50,
    groups: [
      { id: "yes", name: "Yes voters", power: yes, participation: 100, yes: 100, no: 0, abstain: 0, delegateTo: null },
      { id: "no", name: "No voters", power: no, participation: 100, yes: 0, no: 100, abstain: 0, delegateTo: null },
      { id: "abstain", name: "Abstainers", power: abstain, participation: 100, yes: 0, no: 0, abstain: 100, delegateTo: null },
      { id: "absent", name: "Absent", power: 1000 - yes - no - abstain, participation: 0, yes: 100, no: 0, abstain: 0, delegateTo: null },
    ], ...changes,
  };
}

test("hand-checked quorum and strict approval cases", () => {
  for (const [yes, no, abstain, quorumMet, approvalMet, passed] of [
    [120, 80, 0, true, true, true], [100, 100, 0, true, false, false], [120, 0, 0, false, true, false], [0, 0, 200, true, false, false],
  ]) {
    const r = tally(fixture(yes, no, abstain));
    assert.equal(r.total, 1000); assert.equal(r.quorumMet, quorumMet); assert.equal(r.approvalMet, approvalMet); assert.equal(r.passed, passed);
    assert.equal(r.cast, yes + no + abstain);
  }
});

test("zero power, abstentions, 0% and 100% thresholds, and low turnout", () => {
  const zero = fixture(0, 0, 0, { quorum: 0, approval: 0 }); zero.groups.forEach((g) => { g.power = 0; });
  assert.equal(tally(zero).passed, false); assert.equal(tally(zero).quorumMet, false); assert.equal(tally(zero).approvalPercent, null);
  assert.equal(tally(fixture(0, 0, 1000, { approval: 0 })).passed, false);
  assert.equal(tally(fixture(1000, 0, 0, { approval: 100 })).passed, false);
  assert.equal(tally(fixture(1000, 0, 0, { quorum: 100 })).passed, true);
  assert.equal(tally(fixture(1, 0, 0)).quorumMet, false);
  assert.equal(tally(fixture(1, 0, 0, { quorum: 0, approval: 0 })).passed, true);
});

test("thresholds retain full precision, including just below/above a boundary", () => {
  assert.equal(tally(fixture(100.00000001, 99.99999999, 0)).passed, true);
  assert.equal(tally(fixture(120, 79.99999999, 0)).quorumMet, false);
  assert.equal(tally(fixture(120, 80, 0, { approval: 60 })).approvalMet, false);
  const thirds = fixture(100, 200, 0, { approval: 100 / 3 });
  assert.equal(tally(thirds).approvalMet, false);
});

test("decimal arithmetic cannot turn exact quorum or approval boundaries into false outcomes", () => {
  const s = fixture(0, 0, 0, { quorum: 100, groups: [{ id: "g", name: "", power: 77.77, participation: 100, yes: 60.1, no: 39.9, abstain: 0, delegateTo: null }] });
  assert.equal(tally(s).passed, true); assert.equal(tally(s).quorumVotes, 77.77);
  s.groups.push({ ...s.groups[0], id: "g2", power: 13.44 });
  s.quorum = 20; s.groups.forEach((g) => { g.participation = 20; });
  assert.equal(tally(s).quorumMet, true);
  s.approval = 60.1; assert.equal(tally(s).approvalMet, false);
  s.approval = 60.09999999999999; assert.equal(tally(s).approvalMet, true);
  s.quorumBasis = "decisive"; assert.equal(tally(s).quorumMet, true);
  s.groups = [{ ...s.groups[0], power: Number.MIN_VALUE, participation: 20 }];
  assert.equal(tally(s).quorumMet, true); assert.equal(tally(s).turnout, 20);
});

test("quorum basis excludes abstentions but always uses total eligible denominator", () => {
  const all = tally(fixture(120, 0, 80));
  const decisive = tally(fixture(120, 0, 80, { quorumBasis: "decisive" }));
  assert.equal(all.passed, true); assert.equal(decisive.passed, false);
  assert.equal(decisive.quorumVotes, 120); assert.equal(decisive.quorumPercent, 12); assert.equal(decisive.total, all.total);
  assert.equal(decisive.approvalPercent, all.approvalPercent);
});

test("delegation conserves power and uses recipient turnout and ballot", () => {
  const s = fixture(200, 300, 0); s.groups[1].delegateTo = "yes"; s.groups[0].participation = 40;
  const r = tally(s);
  assert.equal(validateModel(wrapScenario(s)).ok, true);
  assert.equal(r.total, 1000); assert.equal(r.groups.reduce((sum, g) => sum + g.effectivePower, 0), 1000);
  assert.equal(r.groups[0].effectivePower, 500); assert.equal(r.groups[1].effectivePower, 0);
  assert.equal(r.yes, 200); assert.equal(r.no, 0); assert.equal(r.delegated, 300);
  s.groups[1].participation = 0; assert.equal(tally(s).yes, r.yes);
});

test("concentration measures ownership and exercised control before turnout", () => {
  const s = fixture(600, 400, 0); s.groups[1].delegateTo = "yes";
  const r = tally(s);
  assert.equal(r.largestBefore, 60); assert.equal(r.largestAfter, 100);
  assert.equal(r.hhiBefore, 5200); assert.equal(r.hhiAfter, 10000);
  s.groups[0].participation = 0; assert.equal(tally(s).hhiAfter, 10000); assert.equal(tally(s).cast, 0);
});

test("coalition and main tally agree for all behaviors and objectives", () => {
  for (const id of presetIds) for (const action of ["pass", "prevent"]) for (const others of ["opposed", "unchanged", "absent"]) {
    const s = preset(id, "en").scenario;
    const transformed = coalitionScenario(s, ["g1", "g4"], action, others);
    const analysis = coalition(s, ["g1", "g4"], action, others);
    assert.deepEqual(analysis.result, tally(transformed));
    assert.equal(analysis.succeeds, action === "pass" ? analysis.result.passed : !analysis.result.passed);
    assert.equal(validateModel(wrapScenario(transformed)).ok, true);
  }
  const s = fixture(100, 100, 0);
  const preventing = coalition(s, ["yes"], "prevent", "absent");
  assert.equal(preventing.result.quorumMet, false); assert.equal(preventing.succeeds, true);
  const winning = coalition(s, ["yes"], "pass", "absent");
  assert.equal(winning.result.approvalMet, true); assert.equal(winning.succeeds, false);
});

test("sensitivity endpoints are deterministic and never mutate input", () => {
  const s = preset("delegates", "de").scenario, before = structuredClone(s), points = sensitivity(s);
  assert.equal(points.length, 11); assert.equal(points[0].result.cast, 0); assert.equal(points[10].result.cast, 1000);
  assert.equal(points[10].result.quorumPercent, 100); assert.deepEqual(s, before);
});

test("every bilingual preset and JSON export round-trips the full baseline and scenario", () => {
  for (const locale of ["en", "de"]) for (const id of presetIds) {
    const m = preset(id, locale); assert.equal(validateModel(m).ok, true); assert.deepEqual(readJson(jsonFile(m)), m);
    assert.deepEqual(decodeShare(encodeShare(m, true)), m);
  }
});

test("default sharing strips authored text and identifiers, preserves arithmetic and delegation", () => {
  const m = preset("delegates", "en"); m.scenario.title = "Secret title"; m.scenario.notes = "https://example.org/private";
  m.scenario.groups[0].id = "secret-id"; m.scenario.groups[1].name = "Secret name";
  const result = decodeShare(encodeShare(m));
  assert.equal(JSON.stringify(result).includes("Secret"), false); assert.equal(JSON.stringify(result).includes("secret-id"), false);
  assert.equal(result.scenario.notes, ""); assert.equal(result.scenario.title, "");
  assert.equal(tally(result.scenario).yes, tally(m.scenario).yes);
  assert.deepEqual(result, shareModel(m)); assert.equal(m.scenario.title, "Secret title");
  m.scenario.notes = "ü日本語 🌍"; assert.deepEqual(decodeShare(encodeShare(m, true)), m);
});

test("malformed imports, versions, numbers, text, collection limits and unknown keys are rejected", () => {
  const mutations = [
    (m) => { m.tool = "token-simulator"; }, (m) => { m.schemaVersion = 2; }, (m) => { m.methodologyVersion = 2; },
    (m) => { delete m.baseline; }, (m) => { m.scenario.quorumBasis = "abstain"; }, (m) => { m.scenario.quorum = "20"; },
    (m) => { m.scenario.approval = NaN; }, (m) => { m.scenario.groups[0].power = Infinity; }, (m) => { m.scenario.groups[0].power = -1; }, (m) => { m.scenario.groups[0].power = 1e13; },
    (m) => { m.scenario.groups[0].yes = 101; }, (m) => { m.scenario.groups[0].no = 9; }, (m) => { m.scenario.groups[0].name = "x".repeat(61); },
    (m) => { m.scenario.title = "x".repeat(101); }, (m) => { m.scenario.notes = "x".repeat(2001); }, (m) => { m.scenario.groups = []; },
    (m) => { m.scenario.groups = Array.from({ length: 13 }, (_, i) => ({ ...m.scenario.groups[0], id: `g${i}` })); },
    (m) => { m.scenario.groups[1].id = m.scenario.groups[0].id; }, (m) => { m.scenario.groups[0].extra = "unknown"; },
    (m) => { m.scenario.notes = "\u0000"; }, (m) => { m.scenario.groups[0].delegateTo = false; },
  ];
  for (const mutate of mutations) { const m = preset("founders", "en"); mutate(m); assert.equal(validateModel(m).ok, false, mutate.toString()); assert.throws(() => readJson(JSON.stringify(m))); }
  for (const value of [null, 7, [], {}, "text"]) assert.equal(validateModel(value).ok, false);
  assert.throws(() => readJson('{"__proto__":{"polluted":true}}')); assert.equal({}.polluted, undefined);
});

test("self-delegation, cycles, chains and missing recipients are rejected", () => {
  for (const pairs of [[[0, "g1"]], [[0, "missing"]], [[0, "g2"], [1, "g1"]], [[0, "g2"], [1, "g3"]]]) {
    const m = preset("founders", "en"); for (const [index, target] of pairs) m.scenario.groups[index].delegateTo = target;
    assert.equal(validateModel(m).ok, false);
  }
});

test("share codec rejects malformed, truncated, oversized, wrong-tool and future-version payloads", () => {
  for (const bad of ["", "v1.", "v2.abc", "v1.%%%%", "v1.A", "v1.__8", "v1." + "A".repeat(MAX_ENCODED_LENGTH), encodeShare(preset("founders", "en")).slice(0, 80)]) assert.throws(() => decodeShare(bad));
  const encoded = (v) => "v1." + Buffer.from(JSON.stringify(v)).toString("base64url");
  const m = preset("founders", "en"); m.methodologyVersion = 2; assert.throws(() => decodeShare(encoded(m)));
  m.methodologyVersion = 1; m.tool = "other"; assert.throws(() => decodeShare(encoded(m)));
  assert.throws(() => readJson(" ".repeat(MAX_JSON_BYTES + 1)));
  const large = preset("founders", "de"); large.scenario.notes = "🌍".repeat(1000); large.baseline.notes = "🌍".repeat(1000);
  for (const side of [large.scenario, large.baseline]) side.groups = Array.from({ length: 12 }, (_, i) => ({ ...side.groups[0], id: `g${i}`, name: "界".repeat(60) }));
  assert.throws(() => encodeShare(large, true), /size/); assert.doesNotThrow(() => jsonFile(large));
  assert.doesNotThrow(() => encodeShare(large, false));
});

test("report facts agree with visible tally and localize labels", () => {
  const m = wrapScenario(fixture(120, 80, 0));
  assert.ok(reportLines(m, "en").includes("Yes: 120 · No: 80 · Abstain: 0"));
  assert.ok(reportLines(m, "en").some((line) => line.includes("Scenario: Proposal passes")));
  assert.ok(reportLines(m, "de").includes("Ja: 120 · Nein: 80 · Enthaltung: 0"));
});

test("report wrapping preserves words and bounds unbroken Unicode text", () => {
  const measure = (s) => Array.from(s).length;
  assert.deepEqual(wrapReportText("Delegate power stays conserved", measure, 16), ["Delegate power", "stays conserved"]);
  const text = "🌍".repeat(50);
  const lines = wrapReportText(text, measure, 12);
  assert.equal(lines.join(""), text); assert.ok(lines.every((line) => measure(line) <= 12));
});
