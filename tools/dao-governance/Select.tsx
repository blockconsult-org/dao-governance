"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePopup } from "@/simulator/components/fields/use-popup";
import { Chevron, Tick } from "@/simulator/components/fields/icons";
import controls from "@/simulator/components/fields/controls.module.css";
import styles from "./governance.module.css";

/** The simulator's select-only combobox pattern and shared tool presentation. */
export function Select<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = Math.max(0, options.findIndex((o) => o.value === value));
  const dismiss = useCallback(() => setOpen(false), []);
  usePopup({ open, onDismiss: dismiss, anchor, popup, align: "start", gap: 4, matchWidth: true });
  function move(index: number) {
    const next = Math.max(0, Math.min(options.length - 1, index));
    setActive(next);
    requestAnimationFrame(() => document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" }));
  }
  function choose() { if (options[active]) onChange(options[active].value); setOpen(false); typed.current = { text: "", at: 0 }; }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key === "Tab") { if (open) choose(); return; }
    if (key === "Escape") { event.preventDefault(); dismiss(); return; }
    if (["Enter", " ", "ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      if (!open) { setOpen(true); move(key === "Home" ? 0 : key === "End" ? options.length - 1 : chosen); }
      else if (key === "Enter" || key === " ") choose();
      else move(key === "Home" ? 0 : key === "End" ? options.length - 1 : active + (key === "ArrowDown" ? 1 : -1));
    } else if (key.length === 1) {
      const text = event.timeStamp - typed.current.at > 500 ? key : typed.current.text + key;
      typed.current = { text, at: event.timeStamp };
      const needle = [...text].every((c) => c === text[0]) ? text[0] : text;
      event.preventDefault();
      const repeated = needle.length === 1;
      const start = repeated ? (open ? active : chosen) + 1 : 0;
      const index = options.map((_, offset) => (start + offset) % options.length).find((i) => options[i].label.toLocaleLowerCase().startsWith(needle.toLocaleLowerCase())) ?? -1;
      if (index >= 0) { setOpen(true); move(index); }
    }
  }
  return <div className={styles.field}>
    <span id={`${id}-label`}>{label}</span>
    <button type="button" ref={anchor} role="combobox" aria-labelledby={`${id}-label`} aria-controls={`${id}-list`} aria-expanded={open} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled} className={controls.select} onKeyDown={keyboard} onBlur={dismiss} onClick={() => { setOpen(!open); setActive(chosen); }}>
      <span>{options[chosen]?.label}</span><Chevron className={controls.chevron} />
    </button>
    <div ref={popup} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} popover="manual" data-open={open} className={controls.popup} onMouseDown={(e) => e.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value} data-active={active === index} onPointerMove={() => setActive(index)} onClick={() => { onChange(option.value); dismiss(); }} className={controls.option}><span>{option.label}</span><span className={controls.mark} aria-hidden><Tick className={controls.tick} /></span></div>)}
    </div>
  </div>;
}
