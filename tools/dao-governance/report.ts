import { copy, format, groupName } from "./copy";
import { sensitivity, tally } from "./engine";
import { manifest } from "./manifest";
import type { Locale, Model } from "./model";

/** Keep ordinary words together; split oversized unbroken text without clipping it. */
export function wrapReportText(text: string, measure: (value: string) => number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= maxWidth) { line = next; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const char of word) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = ""; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shared report facts keep the canvas export tied to the same model as the UI. */
export function reportLines(model: Model, locale: Locale): string[] {
  const t = copy[locale], s = model.scenario, r = tally(s), b = tally(model.baseline);
  const f = (n: number | null, percent = false) => format(n, locale, percent);
  return [
    `${manifest.title[locale]} · Block Consult`, t.printTitle,
    s.title || t.emptyTitle, `${t.scenario}: ${r.passed ? t.pass : t.fail} · ${t.baseline}: ${b.passed ? t.pass : t.fail}`,
    `${t.total}: ${f(r.total)} · ${t.cast}: ${f(r.cast)} · ${t.turnout}: ${f(r.turnout, true)}`,
    `${t.yes}: ${f(r.yes)} · ${t.no}: ${f(r.no)} · ${t.abstain}: ${f(r.abstain)}`,
    `${t.quorumResult}: ${f(r.quorumPercent, true)} / ${t.atLeast} ${f(s.quorum, true)} (${s.quorumBasis === "all" ? t.all : t.decisive}) · ${r.quorumMet ? t.met : t.missed}`,
    `${t.approvalResult}: ${f(r.approvalPercent, true)} / ${t.strict} ${f(s.approval, true)} · ${r.approvalMet ? t.met : t.missed}`,
    `${t.largest}: ${f(r.largestBefore, true)} → ${f(r.largestAfter, true)} · HHI: ${f(r.hhiBefore)} → ${f(r.hhiAfter)}`,
    `${t.transferred}: ${f(r.delegated)} · ${t.before} → ${t.after}`,
    t.distribution,
    ...r.groups.map((row, i) => `${groupName(s, i, locale)}: ${t.owned} ${f(row.group.power)}; ${t.effective} ${f(row.effectivePower)}; ${row.group.delegateTo ? `${t.delegate}: ${groupName(s, s.groups.findIndex((g) => g.id === row.group.delegateTo), locale)}` : `${t.participation} ${f(row.group.participation)}; ${t.ballot} ${f(row.group.yes)} / ${f(row.group.no)} / ${f(row.group.abstain)}`}; ${t.castShort} ${f(row.cast)}`),
    t.groupHint, t.delegateHint, t.boundary, t.limitation, t.versions,
  ];
}

export async function reportPng(model: Model, locale: Locale): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  const t = copy[locale], s = model.scenario, r = tally(s), baseline = tally(model.baseline);
  const f = (n: number | null, percent = false) => format(n, locale, percent);
  // A light, self-contained discussion sheet stays legible when shared or printed.
  const colors = { bg: "#f7f8fa", surface: "#fff", fg: "#0b0d10", muted: "#4d535c", line: "#cfd2d8", blue: "#2360bd" };
  const family = getComputedStyle(document.body).fontFamily;
  const width = 1200, pad = 56, inner = width - pad * 2;
  let y = pad;
  const commands: (() => void)[] = [];
  function text(value: string, x: number, top: number, maxWidth: number, size = 20, color = colors.fg, weight = 400) {
    const font = `${weight} ${size}px ${family}`;
    context!.font = font;
    const lines = wrapReportText(value, (line) => context!.measureText(line).width, maxWidth);
    commands.push(() => { context!.font = font; context!.fillStyle = color; context!.textBaseline = "top"; lines.forEach((line, i) => context!.fillText(line, x, top + i * size * 1.45)); });
    return lines.length * size * 1.45;
  }
  function paragraph(value: string, size = 20, color = colors.muted, weight = 400) { y += text(value, pad, y, inner, size, color, weight) + 12; }
  function line(top: number) { commands.push(() => { context!.strokeStyle = colors.line; context!.lineWidth = 1; context!.beginPath(); context!.moveTo(pad, top); context!.lineTo(width - pad, top); context!.stroke(); }); }
  function heading(value: string) { y += 24; line(y); y += 26; paragraph(value, 25, colors.fg, 500); }
  paragraph("BLOCK CONSULT / WEB3", 16, colors.blue, 500);
  paragraph(manifest.title[locale], 40, colors.fg, 500);
  paragraph(t.printTitle, 19);
  y += 16;
  paragraph(s.title || t.emptyTitle, 23, colors.fg, 500);
  paragraph(r.passed ? t.pass : t.fail, 38, colors.blue, 500);
  paragraph(`${t.baseline}: ${baseline.passed ? t.pass : t.fail}`, 18);
  y += 10; line(y); y += 24;
  const metrics = [[t.total, f(r.total)], [t.cast, f(r.cast)], [t.turnout, f(r.turnout, true)]];
  let metricHeight = 0;
  metrics.forEach(([label, value], i) => {
    const x = pad + i * inner / 3, col = inner / 3 - 28;
    const labelHeight = text(label, x, y, col, 17, colors.muted);
    metricHeight = Math.max(metricHeight, labelHeight + 10 + text(value, x, y + labelHeight + 10, col, 32, colors.fg, 500));
  });
  y += metricHeight + 26; line(y); y += 26;
  const quorumText = `${f(r.quorumPercent, true)} / ${t.atLeast} ${f(s.quorum, true)}`;
  const approvalText = `${f(r.approvalPercent, true)} / ${t.strict} ${f(s.approval, true)}`;
  const left = text(`${t.quorumResult}: ${r.quorumMet ? t.met : t.missed}`, pad, y, inner / 2 - 30, 22, colors.fg, 500);
  const right = text(`${t.approvalResult}: ${r.approvalMet ? t.met : t.missed}`, pad + inner / 2, y, inner / 2 - 16, 22, colors.fg, 500);
  y += Math.max(left, right) + 10;
  const qHeight = text(quorumText, pad, y, inner / 2 - 30, 20, colors.muted);
  const aHeight = text(approvalText, pad + inner / 2, y, inner / 2 - 16, 20, colors.muted);
  y += Math.max(qHeight, aHeight) + 8;
  const qBasis = text(`${f(r.quorumVotes)} / ${f(r.requiredQuorum)} ${t.required} · ${s.quorumBasis === "all" ? t.all : t.decisive}`, pad, y, inner / 2 - 30, 17, colors.muted);
  const aBasis = text(`${t.yes} / (${t.yes} + ${t.no})`, pad + inner / 2, y, inner / 2 - 16, 17, colors.muted);
  y += Math.max(qBasis, aBasis) + 28;
  paragraph(t.breakdown, 23, colors.fg, 500);
  const votes = [{ label: t.yes, value: r.yes, color: colors.blue }, { label: t.no, value: r.no, color: colors.fg }, { label: t.abstain, value: r.abstain, color: colors.muted }, { label: t.uncast, value: Math.max(0, r.total - r.cast), color: "#e4e7ec" }];
  const barY = y;
  commands.push(() => { let x = pad; for (const vote of votes) { const size = r.total ? vote.value / r.total * inner : 0; context.fillStyle = vote.color; context.fillRect(x, barY, size, 20); x += size; } });
  y += 36;
  let legendHeight = 0;
  votes.forEach((vote, i) => { const x = pad + i * inner / 4; const labelHeight = text(vote.label, x, y, inner / 4 - 20, 17, colors.muted); legendHeight = Math.max(legendHeight, labelHeight + 6 + text(f(vote.value), x, y + labelHeight + 6, inner / 4 - 20, 24, colors.fg, 500)); });
  y += legendHeight + 18;
  paragraph(t.resultNote, 16);
  heading(t.concentration);
  paragraph(`${t.largest}: ${f(r.largestBefore, true)} → ${f(r.largestAfter, true)} · HHI: ${f(r.hhiBefore)} → ${f(r.hhiAfter)}`, 20, colors.fg);
  paragraph(`${t.before} → ${t.after} · ${t.transferred}: ${f(r.delegated)}`, 17);
  heading(t.exercised);
  const columns = [pad, pad + 300, pad + 535, pad + 950];
  const widths = [275, 210, 390, 138];
  let headerHeight = 0;
  [t.group, `${t.owned} / ${t.effective}`, t.participation, t.castShort].forEach((label, i) => { headerHeight = Math.max(headerHeight, text(label, columns[i], y, widths[i], 16, colors.muted, 500)); });
  y += headerHeight + 12; line(y); y += 16;
  for (const row of r.groups) {
    const index = s.groups.indexOf(row.group);
    const behavior = row.group.delegateTo ? `${t.delegatesTo} ${groupName(s, s.groups.findIndex((g) => g.id === row.group.delegateTo), locale)}` : `${f(row.group.participation, true)} · ${t.ballot}: ${f(row.group.yes)} / ${f(row.group.no)} / ${f(row.group.abstain)}`;
    const values = [groupName(s, index, locale), `${f(row.group.power)} / ${f(row.effectivePower)}`, behavior, f(row.cast)];
    let rowHeight = 0;
    values.forEach((value, i) => { rowHeight = Math.max(rowHeight, text(value, columns[i], y, widths[i], 18, i === 0 ? colors.fg : colors.muted, i === 0 ? 500 : 400)); });
    y += rowHeight + 18; line(y); y += 18;
  }
  heading(t.sensitivity);
  paragraph(t.sensitivityHint, 17);
  const chartY = y + 40;
  const x = (n: number) => pad + 60 + n * (inner - 100) / 100;
  const cy = (n: number) => chartY + 260 - n * 2.1;
  text(t.quorumShare, pad, y, inner, 17, colors.muted);
  for (const n of [0, 20, 40, 60, 80, 100]) {
    commands.push(() => { context.strokeStyle = colors.line; context.lineWidth = 1; context.beginPath(); context.moveTo(x(0), cy(n)); context.lineTo(x(100), cy(n)); context.stroke(); });
    text(`${n}%`, pad, cy(n) - 10, 55, 16, colors.muted);
    text(`${n}%`, x(n) - 16, chartY + 280, 55, 16, colors.muted);
  }
  commands.push(() => {
    context.setLineDash([8, 5]); context.strokeStyle = colors.muted; context.beginPath(); context.moveTo(x(0), cy(s.quorum)); context.lineTo(x(100), cy(s.quorum)); context.stroke(); context.setLineDash([]);
    const points = sensitivity(s);
    context.strokeStyle = colors.blue; context.lineWidth = 3; context.beginPath();
    points.forEach((p, i) => { if (i) context.lineTo(x(p.participation), cy(p.result.quorumPercent)); else context.moveTo(x(p.participation), cy(p.result.quorumPercent)); }); context.stroke();
    for (const p of points) { const px = x(p.participation), py = cy(p.result.quorumPercent); context.beginPath(); if (p.result.passed) { context.fillStyle = colors.blue; context.arc(px, py, 5, 0, Math.PI * 2); context.fill(); } else { context.moveTo(px - 5, py - 5); context.lineTo(px + 5, py + 5); context.moveTo(px + 5, py - 5); context.lineTo(px - 5, py + 5); context.stroke(); } }
  });
  y = chartY + 320;
  paragraph(t.uniform, 17); paragraph(t.chartKey, 17);
  if (s.notes) { heading(t.notes); paragraph(s.notes, 18, colors.fg); }
  heading(t.methodology);
  paragraph(t.boundary, 16); paragraph(t.groupHint, 16); paragraph(t.delegateHint, 16); paragraph(t.hhiHint, 16); paragraph(t.limitation, 16);
  y += 12; paragraph(t.versions, 16, colors.blue);
  canvas.width = width; canvas.height = Math.ceil(y + pad);
  context.fillStyle = colors.bg; context.fillRect(0, 0, width, canvas.height);
  commands.forEach((draw) => draw());
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("png")), "image/png"));
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
