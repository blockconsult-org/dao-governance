"use client";

import { useId } from "react";
import { copy, format, groupName } from "./copy";
import { MAX_POWER, type Group, type Locale, type Scenario } from "./model";
import { Select } from "./Select";
import styles from "./governance.module.css";

export function NumberField({ label, value, onChange, max = 100, disabled = false, describedBy }: { label: string; value: number; onChange: (value: number) => void; max?: number; disabled?: boolean; describedBy?: string }) {
  const id = useId();
  const invalid = !Number.isFinite(value) || value < 0 || value > max;
  return <label className={styles.field} htmlFor={id}><span>{label}</span><input id={id} type="number" inputMode="decimal" step="any" min={0} max={max} value={Number.isFinite(value) ? value : ""} disabled={disabled} aria-invalid={invalid} aria-describedby={invalid ? "dao-errors" : describedBy} onChange={(event) => onChange(event.target.value === "" ? NaN : event.target.valueAsNumber)} /></label>;
}

export function GroupEditor({ scenario, group: g, index, locale, readOnly, expanded, invalid, onToggle, onEdit, onRemove }: {
  scenario: Scenario; group: Group; index: number; locale: Locale; readOnly: boolean; expanded: boolean; invalid: boolean;
  onToggle: () => void; onEdit: (patch: Partial<Group>) => void; onRemove: () => void;
}) {
  const t = copy[locale];
  const id = useId();
  const sum = g.yes + g.no + g.abstain;
  const recipient = scenario.groups.findIndex((group) => group.id === g.delegateTo);
  return <div className={styles.groupCard} data-invalid={invalid || undefined}>
    <h3 className={styles.groupTitle}><button id={`dao-group-${g.id}`} className={styles.groupToggle} aria-expanded={expanded} aria-controls={id} onClick={onToggle}>
      <span className={styles.groupNumber}>{String(index + 1).padStart(2, "0")}</span>
      <span className={styles.groupSummary}><strong>{groupName(scenario, index, locale)}</strong><span>{format(g.power, locale)} {t.units} · {g.delegateTo && recipient >= 0 ? `${t.delegatesTo} ${groupName(scenario, recipient, locale)}` : `${format(g.participation, locale, true)} ${(locale === "de" ? t.turnout : t.turnout.toLowerCase())}`}</span>{invalid && <span className={styles.inputIssue}>{t.checkGroup}</span>}</span>
      <span className={styles.expandIcon} aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button></h3>
    <div id={id} hidden={!expanded}>
      <fieldset className={styles.groupFields} disabled={readOnly} aria-describedby={`${id}-hint`}>
        <legend className={styles.srOnly}>{groupName(scenario, index, locale)}</legend>
        <label className={styles.field}><span>{t.groupName}</span><input value={g.name} maxLength={60} onChange={(event) => onEdit({ name: event.target.value })} /></label>
        <div className={styles.twoFields}><NumberField label={t.power} value={g.power} max={MAX_POWER} onChange={(power) => onEdit({ power })} /><NumberField label={t.participation} value={g.participation} disabled={Boolean(g.delegateTo)} onChange={(participation) => onEdit({ participation })} /></div>
        <div className={styles.threeFields}><NumberField label={t.yesInput} value={g.yes} disabled={Boolean(g.delegateTo)} describedBy={`${id}-hint`} onChange={(yes) => onEdit({ yes })} /><NumberField label={t.noInput} value={g.no} disabled={Boolean(g.delegateTo)} describedBy={`${id}-hint`} onChange={(no) => onEdit({ no })} /><NumberField label={t.abstainInput} value={g.abstain} disabled={Boolean(g.delegateTo)} describedBy={`${id}-hint`} onChange={(abstain) => onEdit({ abstain })} /></div>
        <p id={`${id}-hint`} className={`${styles.ballotHint} ${!g.delegateTo && Math.abs(sum - 100) > 1e-9 ? styles.inputIssue : ""}`}>{g.delegateTo ? t.delegatedHint : `${t.ballotTotal}: ${format(sum, locale, true)} / 100%`}</p>
        <Select label={t.delegate} value={g.delegateTo ?? ""} disabled={readOnly} options={[{ value: "", label: t.direct }, ...scenario.groups.filter((other) => other.id !== g.id && other.delegateTo === null && !scenario.groups.some((source) => source.delegateTo === g.id)).map((other) => ({ value: other.id, label: groupName(scenario, scenario.groups.indexOf(other), locale) }))]} onChange={(value) => onEdit({ delegateTo: value || null })} />
        <button className={styles.removeButton} disabled={scenario.groups.length <= 1} onClick={onRemove}><span aria-hidden="true">×</span> {t.remove}</button>
      </fieldset>
    </div>
  </div>;
}
