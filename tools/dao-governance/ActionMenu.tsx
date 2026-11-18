"use client";
import { ActionMenu as SharedMenu, ActionMenuItem } from "@/simulator/components/actions/menu";
import styles from "./governance.module.css";
type Action = { label: string; run: () => void; disabled?: boolean; destructive?: boolean };
export function ActionMenu({ label, actions }: { label: string; actions: Action[] }) {
  return <SharedMenu label={label} className={styles.actionMenu}>{actions.map(action => <ActionMenuItem key={action.label} disabled={action.disabled} destructive={action.destructive} onClick={action.run}>{action.label}</ActionMenuItem>)}</SharedMenu>;
}
