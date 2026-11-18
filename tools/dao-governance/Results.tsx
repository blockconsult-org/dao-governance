import { useId } from "react";
import { tally, sensitivity, type Tally } from "./engine";
import { copy, format, groupName } from "./copy";
import type { Locale, Model, Scenario } from "./model";
import styles from "./governance.module.css";

export function Outcome({ result: r, scenario: s, locale, compact = false }: { result: Tally; scenario: Scenario; locale: Locale; compact?: boolean }) {
  const t = copy[locale];
  const f = (n: number | null, percent = false) => format(n, locale, percent);
  return <div className={styles.outcome}>
    <p className={styles.outcomeTitle} data-testid={compact ? "coalition-outcome" : "outcome"}><span aria-hidden="true">{r.passed ? "↗" : "↘"}</span> {r.passed ? t.pass : t.fail}</p>
    <div className={styles.ruleResults}>
      <p><strong>{t.quorumResult}: {r.quorumMet ? t.met : t.missed}</strong><span>{f(r.quorumPercent, true)} / {t.atLeast} {f(s.quorum, true)}</span><span>{f(r.quorumVotes)} / {f(r.requiredQuorum)} {t.required}</span></p>
      <p><strong>{t.approvalResult}: {r.approvalMet ? t.met : t.missed}</strong><span>{r.approvalPercent === null ? t.noDecisive : f(r.approvalPercent, true)} / {t.strict} {f(s.approval, true)}</span><span>{t.yes} / ({t.yes} + {t.no})</span></p>
    </div>
    <p className={styles.hint}>{s.quorumBasis === "all" ? t.all : t.decisive} · {t.quorumResult}</p>
  </div>;
}

export function SensitivityChart({ scenario, locale }: { scenario: Scenario; locale: Locale }) {
  const t = copy[locale];
  const id = useId();
  const points = sensitivity(scenario);
  return <figure className={styles.chart}>
    <p className={styles.chartAxisTitle}>{t.quorumShare}</p>
    {([false, true] as const).map((narrow) => {
      const width = narrow ? 360 : 660, left = narrow ? 46 : 55, right = width - (narrow ? 24 : 55);
      const x = (value: number) => left + value * (right - left) / 100;
      const y = (value: number) => 200 - value * 1.7;
      const chartId = `${id}-${narrow ? "narrow" : "wide"}`;
      return <svg key={chartId} className={narrow ? styles.chartNarrow : styles.chartWide} viewBox={`0 0 ${width} 235`} role="img" aria-labelledby={`${chartId}-title ${chartId}-desc`}>
        <title id={`${chartId}-title`}>{t.sensitivity}</title><desc id={`${chartId}-desc`}>{t.sensitivityHint} {t.chartKey}</desc>
        {[0, 20, 40, 60, 80, 100].map((n) => <g key={n}><line x1={left} x2={right} y1={y(n)} y2={y(n)} className={styles.gridLine} /><text x={left - 9} y={y(n) + 4} textAnchor="end">{n}%</text><text x={x(n)} y="225" textAnchor="middle">{n}%</text></g>)}
        <line x1={left} x2={right} y1={y(scenario.quorum)} y2={y(scenario.quorum)} className={styles.threshold} />
        <polyline points={points.map((p) => `${x(p.participation)},${y(p.result.quorumPercent)}`).join(" ")} className={styles.chartLine} />
        {points.map((p) => p.result.passed ? <circle key={p.participation} cx={x(p.participation)} cy={y(p.result.quorumPercent)} r="4" className={styles.chartDot} /> : <path key={p.participation} d={`M${x(p.participation) - 4},${y(p.result.quorumPercent) - 4}l8,8m0,-8l-8,8`} className={styles.chartCross} />)}
      </svg>;
    })}
    <p className={styles.chartAxisLabel}>{t.uniform}</p>
    <figcaption>{t.chartKey}</figcaption>
    <details className={styles.sensitivityTable}><summary>{t.chartTable}</summary><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t.chartTable}>
      <table><caption>{t.sensitivity}</caption><thead><tr><th>{t.uniform}</th><th>{t.quorumShare}</th><th>{t.approvalResult}</th><th>{t.outcome}</th></tr></thead><tbody>{points.map((p) => <tr key={p.participation}><th scope="row">{p.participation}%</th><td>{format(p.result.quorumPercent, locale, true)}</td><td>{format(p.result.approvalPercent, locale, true)}</td><td>{p.result.passed ? t.pass : t.fail}</td></tr>)}</tbody></table>
    </div></details>
  </figure>;
}

export function Comparison({ model, locale }: { model: Model; locale: Locale }) {
  const t = copy[locale];
  const baseline = tally(model.baseline), scenario = tally(model.scenario);
  const rows: [string, (r: Tally) => string][] = [
    [t.total, (r) => format(r.total, locale)], [t.yes, (r) => format(r.yes, locale)], [t.no, (r) => format(r.no, locale)], [t.abstain, (r) => format(r.abstain, locale)],
    [t.cast, (r) => format(r.cast, locale)], [t.turnout, (r) => format(r.turnout, locale, true)], [t.quorumResult, (r) => `${format(r.quorumPercent, locale, true)} · ${r.quorumMet ? t.met : t.missed}`], [t.approvalResult, (r) => `${format(r.approvalPercent, locale, true)} · ${r.approvalMet ? t.met : t.missed}`], [t.outcome, (r) => r.passed ? t.pass : t.fail],
  ];
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t.comparison}><table data-testid="comparison" className={styles.comparisonTable}><caption className={styles.srOnly}>{t.comparison}</caption><thead><tr><th>{t.metric}</th><th>{t.baseline}</th><th>{t.scenario}</th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value(baseline)}</td><td>{value(scenario)}</td></tr>)}</tbody></table></div>;
}

export function Distribution({ scenario, locale, report = false }: { scenario: Scenario; locale: Locale; report?: boolean }) {
  const t = copy[locale];
  const result = tally(scenario);
  const f = (n: number) => format(n, locale);
  if (report) return <table className={styles.reportDistribution}><caption>{t.distribution}</caption><thead><tr><th>{t.group}</th><th>{t.owned} / {t.effective}</th><th>{t.participation} · {t.ballot}</th><th>{t.castShort}</th><th>{t.yes} / {t.no} / {t.abstain}</th></tr></thead><tbody>{result.groups.map((g, i) => <tr key={g.group.id}><th scope="row">{groupName(scenario, i, locale)}</th><td>{f(g.group.power)} / {f(g.effectivePower)}</td><td>{g.group.delegateTo ? `${t.delegatesTo} ${groupName(scenario, scenario.groups.findIndex((item) => item.id === g.group.delegateTo), locale)}` : `${f(g.group.participation)}% · ${f(g.group.yes)} / ${f(g.group.no)} / ${f(g.group.abstain)}`}</td><td>{f(g.cast)}</td><td>{f(g.yes)} / {f(g.no)} / {f(g.abstain)}</td></tr>)}</tbody></table>;
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t.distribution}><table className={styles.distributionTable}><caption className={styles.srOnly}>{t.distribution}</caption><thead><tr><th>{t.group}</th><th>{t.owned}</th><th>{t.delegate}</th><th>{t.effective}</th><th>{t.participation}</th><th>{t.ballot}</th><th>{t.castShort}</th><th>{t.yes}</th><th>{t.no}</th><th>{t.abstain}</th></tr></thead><tbody>{result.groups.map((g, i) => <tr key={g.group.id}><th scope="row">{groupName(scenario, i, locale)}</th><td>{f(g.group.power)}</td><td>{g.group.delegateTo ? groupName(scenario, scenario.groups.findIndex((item) => item.id === g.group.delegateTo), locale) : t.direct}</td><td>{f(g.effectivePower)}</td><td>{g.group.delegateTo ? "—" : f(g.group.participation)}</td><td>{g.group.delegateTo ? "—" : `${f(g.group.yes)} / ${f(g.group.no)} / ${f(g.group.abstain)}`}</td><td>{f(g.cast)}</td><td>{f(g.yes)}</td><td>{f(g.no)}</td><td>{f(g.abstain)}</td></tr>)}</tbody></table></div>;
}

export function Results({ model, locale, withConcentration = true }: { model: Model; locale: Locale; withConcentration?: boolean }) {
  const headingId = useId();
  const s = model.scenario;
  const t = copy[locale];
  const r = tally(s);
  const f = (n: number, percent = false) => format(n, locale, percent);
  const votes = [{ label: t.yes, value: r.yes, style: styles.yes }, { label: t.no, value: r.no, style: styles.no }, { label: t.abstain, value: r.abstain, style: styles.abstain }, { label: t.uncast, value: Math.max(0, r.total - r.cast), style: styles.uncast }];
  return <>
    <section className={styles.panel} aria-labelledby={headingId} data-large={r.total >= 1_000_000_000 || undefined}>
      <h2 id={headingId} className={styles.eyebrow}>{t.resultHeading}</h2>
      <Outcome result={r} scenario={s} locale={locale} />
      <dl className={styles.metrics} data-large={r.total >= 1_000_000_000 || undefined}><div><dt>{t.total}</dt><dd data-testid="total">{f(r.total)}</dd></div><div><dt>{t.cast}</dt><dd data-testid="cast">{f(r.cast)}</dd></div><div><dt>{t.turnout}</dt><dd>{f(r.turnout, true)}</dd></div></dl>
      <h3>{t.breakdown}</h3><div className={styles.voteBar} aria-hidden="true">{votes.map((v) => <span key={v.label} className={v.style} style={{ width: `${r.total ? v.value / r.total * 100 : 0}%` }} />)}</div>
      <dl className={styles.voteLegend}>{votes.map((v) => <div key={v.label}><dt><i className={v.style} aria-hidden="true" />{v.label}</dt><dd>{f(v.value)}</dd></div>)}</dl>
      <p className={styles.resultNote}>{t.resultNote}</p>
      {withConcentration ? <p className={styles.hint}>{t.boundary}</p> : <details className={styles.ruleDetails}><summary>{t.rulesDetail}</summary><p className={styles.hint}>{t.boundary}</p></details>}
    </section>
    {withConcentration && <section className={styles.panel}><h2>{t.concentration}</h2><Concentration scenario={s} locale={locale} /></section>}
  </>;
}

export function Concentration({ scenario, locale }: { scenario: Scenario; locale: Locale }) {
  const t = copy[locale], r = tally(scenario);
  const f = (n: number, percent = false) => format(n, locale, percent);
  return <><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t.concentration}><table className={styles.comparisonTable}><caption className={styles.srOnly}>{t.concentration}</caption><thead><tr><th>{t.metric}</th><th>{t.before}</th><th>{t.after}</th></tr></thead><tbody><tr><th scope="row">{t.largest}</th><td>{f(r.largestBefore, true)}</td><td>{f(r.largestAfter, true)}</td></tr><tr><th scope="row">{t.hhi}</th><td>{f(r.hhiBefore)}</td><td>{f(r.hhiAfter)}</td></tr></tbody></table></div><p>{t.transferred}: <strong>{f(r.delegated)}</strong></p><p className={styles.hint}>{t.hhiHint}</p></>;
}
