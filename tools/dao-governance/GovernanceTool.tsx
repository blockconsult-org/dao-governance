"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { localeHref } from "@/content/i18n";
import { coalition, type CoalitionAction, type OtherBehavior } from "./engine";
import { DataError, decodeShare, encodeShare, HASH_PREFIX, jsonFile, MAX_JSON_BYTES, readJson, shareModel, STORAGE_KEY } from "./codec";
import { copy, errorText, format, groupName } from "./copy";
import { validateModel, MAX_GROUPS, type Group, type Locale, type Model, type Scenario } from "./model";
import { preset, presetIds, presetNames, type PresetId } from "./presets";
import { manifest } from "./manifest";
import { Comparison, Concentration, Distribution, Outcome, Results, SensitivityChart } from "./Results";
import { ActionMenu } from "./ActionMenu";
import { GroupEditor, NumberField } from "./GroupEditor";
import { Select } from "./Select";
import { download, reportPng } from "./report";
import styles from "./governance.module.css";

function clearHash() { window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); }

export function GovernanceTool({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = copy[locale];
  const [draft, setDraft] = useState<Model>(() => preset("founders", locale));
  const [snapshot, setSnapshot] = useState<Model | null>(null);
  const [ready, setReady] = useState(false);
  const [presetId, setPresetId] = useState<PresetId>("founders");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [includeText, setIncludeText] = useState(false);
  const [link, setLink] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<CoalitionAction>("pass");
  const [others, setOthers] = useState<OtherBehavior>("opposed");
  const file = useRef<HTMLInputElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const shareButton = useRef<HTMLButtonElement>(null);
  const shareLink = useRef<HTMLTextAreaElement>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>("g1");
  const [analysisTab, setAnalysisTab] = useState<"participation" | "coalition">("participation");
  const [exporting, setExporting] = useState(false);
  const model = snapshot ?? draft, scenario = model.scenario;
  const validation = validateModel(model);
  const valid = validation.ok;
  const readOnly = snapshot !== null || !ready;

  useEffect(() => {
    let active = true;
    const read = () => {
      if (!active) return;
      setReady(true);
      const hash = window.location.hash;
      if (hash === "#main") return;
      if (!hash) { setSnapshot(null); return; }
      try {
        if (!hash.startsWith(HASH_PREFIX)) throw new DataError("encoding");
        setSnapshot(decodeShare(hash.slice(HASH_PREFIX.length)));
        setError(""); setNotice(""); setShowShare(false); setLink(""); setSelected([]);
      } catch { setError(copy[locale].invalidLink); }
    };
    queueMicrotask(read);
    window.addEventListener("hashchange", read);
    return () => { active = false; window.removeEventListener("hashchange", read); };
  }, [locale]);

  useEffect(() => {
    const dialog = shareDialog.current;
    if (showShare && dialog && !dialog.open) dialog.showModal();
    else if (!showShare && dialog?.open) dialog.close();
  }, [showShare]);

  function jump(id: string) {
    requestAnimationFrame(() => {
      const section = document.getElementById(id);
      const target = section?.matches("aside") ? section.querySelector("h2") : section;
      if (target && !target.matches("button")) target.tabIndex = -1;
      target?.focus({ preventScroll: true });
      section?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function closeShare() { setShowShare(false); shareButton.current?.focus(); }
  async function exportPng() {
    setExporting(true);
    try { download(await reportPng(model, locale), `dao-governance-${locale}.png`); message(t.exported); }
    catch { setError(t.exportError); }
    finally { setExporting(false); }
  }
  function message(text: string) { setNotice(text); setError(""); }
  function change(next: Model) { setDraft(next); setLink(""); setNotice(""); setError(""); }
  function edit(patch: Partial<Scenario>) { change({ ...draft, scenario: { ...draft.scenario, ...patch } }); }
  function editGroup(id: string, patch: Partial<Group>) { edit({ groups: draft.scenario.groups.map((g) => g.id === id ? { ...g, ...patch } : g) }); }
  function replace(next: Model) { change(next); setSelected([]); setExpandedGroup(next.scenario.groups[0]?.id ?? null); }
  function handleError(caught: unknown) { setError(caught instanceof DataError ? errorText(caught.code, locale) : t.errorEncoding); setNotice(""); }
  function save() {
    if (!valid || readOnly) return;
    try { window.localStorage.setItem(STORAGE_KEY, jsonFile(model)); message(t.saved); } catch (caught) { if (caught instanceof DataError) handleError(caught); else setError(t.storageError); }
  }
  function load() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) { message(t.noSave); return; }
      replace(readJson(saved)); message(t.loaded);
    } catch (caught) { if (caught instanceof DataError) handleError(caught); else setError(t.storageError); }
  }
  function removeSave() { try { window.localStorage.removeItem(STORAGE_KEY); message(t.deleted); } catch { setError(t.storageError); } }
  function exportJson() {
    try { download(new Blob([jsonFile(model)], { type: "application/json" }), "dao-governance.json"); message(t.exported); } catch (caught) { handleError(caught); }
  }
  async function importFile(upload: File) {
    try {
      if (upload.size > MAX_JSON_BYTES) throw new DataError("size");
      const next = readJson(await upload.text());
      replace(next); message(t.imported);
    } catch (caught) { handleError(caught); }
  }
  function createLink() {
    try { setLink(`${"https://www.blockconsult.org"}${localeHref(locale, manifest.publicPath)}${HASH_PREFIX}${encodeShare(model, includeText)}`); message(""); requestAnimationFrame(() => { shareLink.current?.focus(); shareLink.current?.select(); }); } catch (caught) { handleError(caught); }
  }
  function switchLanguage() {
    try { router.push(`${localeHref(locale === "en" ? "de" : "en", manifest.publicPath)}${HASH_PREFIX}${encodeShare(model, true)}`); } catch (caught) { handleError(caught); }
  }
  const fieldNames: Record<string, string> = { quorum: t.quorum, approval: t.approval, name: t.groupName, title: t.name, notes: t.notes, power: t.power, participation: t.participation, yes: t.yesInput, no: t.noInput, abstain: t.abstainInput, delegateTo: t.delegate };
  const selectedCurrent = selected.filter((id) => scenario.groups.some((g) => g.id === id && !g.delegateTo));
  const analysis = valid ? coalition(scenario, selectedCurrent, action, others) : null;
  const shared = valid ? shareModel(model, includeText) : null;

  return <div className={styles.workspace} aria-label={t.workspace} data-testid="governance-tool" onFocusCapture={(event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest("[popover], dialog")) return;
    requestAnimationFrame(() => {
      if (!target.isConnected) return;
      const bounds = target.getBoundingClientRect();
      const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
      const nav = document.getElementById("dao-workspace-nav")?.getBoundingClientRect();
      const top = (nav && nav.height && nav.top <= header + 1 ? nav.bottom : header) + 12;
      const chat = document.querySelector(".bc-chat-launcher")?.getBoundingClientRect();
      if (bounds.top < top) window.scrollBy({ top: bounds.top - top, behavior: "instant" });
      else if (chat && bounds.right > chat.left && bounds.left < chat.right && bounds.bottom > chat.top && bounds.top < chat.bottom) window.scrollBy({ top: bounds.bottom - chat.top + 12, behavior: "instant" });
    });
  }}>
    <div className={styles.screenOnly}>
      <div className={styles.toolbar}>
        <div className={styles.actions}>
          <button onClick={save} disabled={readOnly || !valid}>{t.save}</button>
          <ActionMenu label={t.files} actions={[
            { label: t.load, run: load, disabled: readOnly },
            { label: t.importJson, run: () => file.current?.click(), disabled: readOnly },
            { label: t.exportJson, run: exportJson, disabled: !ready || !valid },
            { label: t.delete, run: removeSave, disabled: readOnly, destructive: true },
          ]} />
        </div>
        <p className={styles.localHint}>{t.localHint}</p>
        <button ref={shareButton} className={styles.primary} onClick={() => { setShowShare(true); setLink(""); setError(""); setNotice(""); }} disabled={!ready || !valid} aria-haspopup="dialog">{t.share} <span aria-hidden="true">↗</span></button>
        <input ref={file} type="file" accept=".json,application/json" aria-label={t.importJson} hidden onChange={(event) => { const upload = event.target.files?.[0]; event.target.value = ""; if (upload) void importFile(upload); }} />
      </div>
      <div role="status" className={styles.notice}>{!showShare && notice}</div>
      {!showShare && error && <p role="alert" className={styles.error}>{error}</p>}
      {snapshot && <aside className={styles.snapshot}><div><strong>{t.snapshot}</strong><p>{t.snapshotHint}</p></div><div className={styles.actions}><button className={styles.primary} onClick={() => { replace(structuredClone(snapshot)); setSnapshot(null); clearHash(); message(t.copiedSnapshot); jump("dao-setup-heading"); }}>{t.makeCopy}</button><button onClick={() => { setSnapshot(null); clearHash(); setLink(""); message(""); jump("dao-setup-heading"); }}>{t.returnDraft}</button></div></aside>}
      <dialog ref={shareDialog} className={styles.shareDialog} aria-labelledby="dao-share-heading" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled)"));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} onCancel={closeShare} onClose={() => setShowShare(false)} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeShare(); } }}>
        {showShare && shared && <>
          <div className={styles.sectionHeading}><h2 id="dao-share-heading">{t.shareTitle}</h2><button className={styles.closeButton} aria-label={t.closeShare} onClick={closeShare}>×</button></div>
          <p className={styles.hint}>{t.shareHint}</p><label className={styles.checkbox}><input type="checkbox" checked={includeText} onChange={(event) => { setIncludeText(event.target.checked); setLink(""); }} />{t.includeText}</label>
          <div className={styles.sharePreview}><h3>{t.preview}</h3><div className={styles.previewGrid}>{(["baseline", "scenario"] as const).map((side) => <div key={side}><p className={styles.eyebrow}>{t[side]}</p><strong>{shared[side].title || t.emptyTitle}</strong><p>{shared[side].groups.map((_, i) => groupName(shared[side], i, locale)).join(" · ")}</p><p>{t.quorumResult} ≥ {format(shared[side].quorum, locale, true)}<br />{t.approvalResult} &gt; {format(shared[side].approval, locale, true)}</p>{shared[side].notes && <p className={styles.notes}>{shared[side].notes}</p>}</div>)}</div></div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}><button className={styles.primary} onClick={createLink}>{t.generate}</button></div>
          {link && <div className={styles.shareLink}><label className={styles.field}><span>{t.link}</span><textarea ref={shareLink} readOnly value={link} onFocus={(event) => event.target.select()} rows={3} /></label><button onClick={async () => { try { await navigator.clipboard.writeText(link); message(t.copied); } catch { message(t.copyFallback); shareLink.current?.focus(); shareLink.current?.select(); } }}>{t.copy}</button></div>}
          <p className={styles.notice} role="status">{notice}</p>
        </>}
      </dialog>
      {!valid && <div id="dao-errors" role="alert" className={styles.error}><strong>{t.invalid}</strong><ul>{validation.issues.slice(0, 20).map((issue, i) => { const bits = issue.path.split("."); return <li key={`${issue.path}-${i}`}>{bits[0] === "baseline" ? t.baseline : t.scenario}{bits[1] === "groups" && bits[2] ? ` · ${t.group} ${Number(bits[2]) + 1}` : ""}{fieldNames[bits.at(-1)!] ? ` · ${fieldNames[bits.at(-1)!]}` : ""}: {errorText(issue.code, locale)}</li>; })}</ul></div>}

      <nav id="dao-workspace-nav" className={styles.workspaceNav} aria-label={t.workspace}><button onClick={() => jump("dao-setup-heading")}>{t.inputNav}</button><button onClick={() => jump("dao-results")} >{t.resultNav}</button><button onClick={() => jump("dao-explore-heading")}>{t.analysisNav}</button></nav>
      <div className={styles.workbench}>
        <div className={styles.inputsColumn}>
          <section className={styles.setupSection} aria-labelledby="dao-setup-heading">
            <div className={styles.sectionHeading}><h2 id="dao-setup-heading" tabIndex={-1}>{t.setup}</h2><span className={styles.sectionNumber} aria-hidden="true">01</span></div>
            <div className={styles.presetRow}><Select label={t.preset} value={presetId} options={presetIds.map((id) => ({ value: id, label: presetNames[locale][id] }))} disabled={readOnly} onChange={(id) => { setPresetId(id); replace(preset(id, locale)); }} /><button className={styles.resetButton} title={t.reset} aria-label={t.reset} disabled={readOnly} onClick={() => replace(preset(presetId, locale))}>↺</button></div>
            <label className={styles.field}><span>{t.name}</span><input value={scenario.title} maxLength={100} disabled={readOnly} onChange={(event) => edit({ title: event.target.value })} /></label>
            <div className={styles.twoFields}><NumberField label={t.quorum} value={scenario.quorum} disabled={readOnly} onChange={(quorum) => edit({ quorum })} /><NumberField label={t.approval} value={scenario.approval} disabled={readOnly} onChange={(approval) => edit({ approval })} /></div>
            <Select label={t.quorumBasis} value={scenario.quorumBasis} options={[{ value: "all", label: t.all }, { value: "decisive", label: t.decisive }]} disabled={readOnly} onChange={(quorumBasis) => edit({ quorumBasis })} />
          </section>
          <section className={styles.groupSection} aria-labelledby="dao-groups-heading">
            <div className={styles.sectionHeading}><h2 id="dao-groups-heading">{t.groupsHeading}</h2><span className={styles.counter}>{scenario.groups.length} / {MAX_GROUPS}</span></div>
            <details className={styles.groupHelp}><summary>{t.groupHelp}</summary><p className={styles.hint}>{t.groupHint}</p><p className={styles.hint}>{t.delegateHint}</p></details>
            <div className={styles.groupList}>{scenario.groups.map((g, index) => <GroupEditor key={g.id} scenario={scenario} group={g} index={index} locale={locale} readOnly={readOnly} expanded={expandedGroup === g.id} invalid={!valid && validation.issues.some((issue) => (issue.path === `scenario.groups.${index}` || issue.path.startsWith(`scenario.groups.${index}.`)))} onToggle={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)} onEdit={(patch) => { editGroup(g.id, patch); if ("delegateTo" in patch) setSelected([]); }} onRemove={() => { const groups = scenario.groups.filter((item) => item.id !== g.id).map((item) => item.delegateTo === g.id ? { ...item, delegateTo: null } : item); edit({ groups }); setSelected(selected.filter((id) => id !== g.id)); const next = groups[Math.min(index, groups.length - 1)].id; setExpandedGroup(next); jump(`dao-group-${next}`); }} />)}</div>
            <button className={styles.addButton} disabled={readOnly || scenario.groups.length >= MAX_GROUPS} onClick={() => { let index = 1; while (scenario.groups.some((g) => g.id === `g${index}`)) index++; const id = `g${index}`; edit({ groups: [...scenario.groups, { id, name: "", power: 100, participation: 50, yes: 60, no: 30, abstain: 10, delegateTo: null }] }); setExpandedGroup(id); jump(`dao-group-${id}`); }}>+ {t.add}</button>
          </section>
          <details className={styles.disclosure}><summary>{t.notes}{scenario.notes && <span aria-hidden="true"> ·</span>}</summary><div className={styles.disclosureBody}><label className={styles.field}><span>{t.notes}</span><textarea value={scenario.notes} maxLength={2000} rows={4} disabled={readOnly} onChange={(event) => edit({ notes: event.target.value })} /></label><p className={styles.hint}>{t.notesHint}</p></div></details>
        </div>
        <aside className={styles.resultsColumn} id="dao-results" tabIndex={-1} aria-label={t.resultNav}>
          {valid ? <><Results model={model} locale={locale} withConcentration={false} />
            <details className={styles.disclosure}><summary>{t.comparison}</summary><div className={styles.disclosureBody}><p className={styles.hint}>{t.baselineHint}</p><div className={styles.baselineActions}><button disabled={readOnly} onClick={() => change({ ...draft, baseline: structuredClone(draft.scenario) })}>{t.setBaseline}</button><button disabled={readOnly} onClick={() => { change({ ...draft, scenario: structuredClone(draft.baseline) }); setSelected([]); setExpandedGroup(draft.baseline.groups[0].id); }}>{t.restoreBaseline}</button></div><Comparison model={model} locale={locale} /></div></details>
            <details className={styles.disclosure}><summary>{t.concentration}</summary><div className={styles.disclosureBody}><Concentration scenario={scenario} locale={locale} /></div></details>
          </> : <div className={styles.panel}><h2>{t.resultHeading}</h2><p>{t.invalid}</p></div>}
        </aside>
      </div>

      <section className={styles.exploreSection} aria-labelledby="dao-explore-heading">
        <div className={styles.sectionHeading}><h2 id="dao-explore-heading" tabIndex={-1}>{t.explore}</h2><span className={styles.sectionNumber} aria-hidden="true">02</span></div>
        {valid ? <>
          <div className={styles.tabs} role="tablist" aria-label={t.explore}>{(["participation", "coalition"] as const).map((tab, index) => <button key={tab} id={`dao-${tab}-tab`} role="tab" aria-selected={analysisTab === tab} aria-controls={`dao-${tab}-panel`} tabIndex={analysisTab === tab ? 0 : -1} onClick={() => setAnalysisTab(tab)} onKeyDown={(event) => { if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "participation" : event.key === "End" ? "coalition" : index === 0 ? "coalition" : "participation"; setAnalysisTab(next); document.getElementById(`dao-${next}-tab`)?.focus(); } }}>{tab === "participation" ? t.participationTab : t.coalitionTab}</button>)}</div>
          <div id="dao-participation-panel" role="tabpanel" aria-labelledby="dao-participation-tab" hidden={analysisTab !== "participation"} tabIndex={0}>
            <div className={styles.analysisLayout}><div className={styles.analysisIntro}><h3>{t.sensitivity}</h3><p className={styles.hint}>{t.sensitivityHint}</p></div><SensitivityChart scenario={scenario} locale={locale} /></div>
          </div>
          <div id="dao-coalition-panel" role="tabpanel" aria-labelledby="dao-coalition-tab" hidden={analysisTab !== "coalition"} tabIndex={0}>
            <div className={styles.coalitionLayout}><div><h3>{t.coalition}</h3><p className={styles.hint}>{t.coalitionHint}</p><div className={styles.coalitionGroups}>{scenario.groups.filter((g) => !g.delegateTo).map((g) => <label key={g.id} className={styles.checkbox}><input type="checkbox" checked={selectedCurrent.includes(g.id)} onChange={(event) => setSelected(event.target.checked ? [...selectedCurrent, g.id] : selectedCurrent.filter((id) => id !== g.id))} />{groupName(scenario, scenario.groups.indexOf(g), locale)}</label>)}</div>
              <Select label={t.aim} value={action} options={[{ value: "pass", label: t.aimPass }, { value: "prevent", label: t.aimPrevent }]} onChange={setAction} /><Select label={t.others} value={others} options={[{ value: "opposed", label: t.opposed }, { value: "unchanged", label: t.unchanged }, { value: "absent", label: t.absent }]} onChange={setOthers} />
            </div><div className={styles.coalitionResult} aria-live="polite">{analysis && selectedCurrent.length > 0 ? <><p className={styles.eyebrow}>{t.coalitionOutcome}</p><h3>{analysis.succeeds ? t.coalitionSuccess : t.coalitionFailure}</h3><p>{t.coalitionPower}: <strong>{format(analysis.power, locale)}</strong></p><Outcome result={analysis.result} scenario={scenario} locale={locale} compact /></> : <><p className={styles.eyebrow}>{t.coalitionOutcome}</p><h3>{t.emptyCoalition}</h3><p className={styles.hint}>{t.selectCoalition}</p></>}<p className={styles.hint}>{t.coalitionWarning}</p></div></div>
          </div>
          <details className={styles.disclosure}><summary>{t.exercised}</summary><div className={styles.disclosureBody}><p className={styles.hint}>{t.distributionHint}</p><Distribution scenario={scenario} locale={locale} /></div></details>
        </> : <p className={styles.hint}>{t.invalid}</p>}
      </section>
      <section className={styles.reportActions} aria-label={t.reports}><div><h2>{t.reports}</h2><div className={styles.actions}><button disabled={!ready || !valid} onClick={() => window.print()}>{t.print}</button><button disabled={!ready || !valid || exporting} aria-busy={exporting} onClick={() => void exportPng()}>{exporting ? t.exporting : t.exportPng}</button></div></div><div className={styles.language}><button disabled={!ready || !valid} onClick={switchLanguage}>{t.language}</button><p className={styles.hint}>{t.languageHint}</p></div></section>
    </div>
    {valid && <article className={styles.printOnly} aria-label={t.printTitle}>
      <p>Block Consult · {t.versions}</p><h1>{manifest.title[locale]}</h1><h2>{t.printTitle}</h2><p>{t.limitation}</p>
      <h2>{scenario.title || t.emptyTitle}</h2><Results model={model} locale={locale} /><p>{t.groupHint} {t.delegateHint}</p><Distribution scenario={scenario} locale={locale} report />
      {scenario.notes && <p className={styles.notes}>{scenario.notes}</p>}
      <section className={styles.printSection}><h2>{t.sensitivity}</h2><p>{t.sensitivityHint}</p><SensitivityChart scenario={scenario} locale={locale} /></section>
      <Comparison model={model} locale={locale} />
      <h2>{t.baseline}: {model.baseline.title || t.emptyTitle}</h2><p>{t.quorumResult}: ≥ {format(model.baseline.quorum, locale, true)} ({model.baseline.quorumBasis === "all" ? t.all : t.decisive}) · {t.approvalResult}: &gt; {format(model.baseline.approval, locale, true)}</p><Distribution scenario={model.baseline} locale={locale} report />{model.baseline.notes && <p className={styles.notes}>{model.baseline.notes}</p>}
      <h2>{t.methodology}</h2><p>{t.methodologyText}</p>
    </article>}
  </div>;
}
