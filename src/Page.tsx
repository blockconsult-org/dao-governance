import { ToolHeader } from "@/components/tools/ToolHeader";
import Link from "next/link";
import { localeHref } from "@/content/i18n";
import { GovernanceTool } from "@/tools/dao-governance/GovernanceTool";
import { copy } from "@/tools/dao-governance/copy";
import { manifest } from "@/tools/dao-governance/manifest";
import styles from "@/tools/dao-governance/governance.module.css";


export default function Page({ locale }: { locale: 'en' | 'de' }) {
  const t = copy[locale];
  return <><ToolHeader tool="dao-governance" locale={locale} title={manifest.title[locale]} lead={t.intro} note={t.fictional} /><div className={styles.page}>
    <GovernanceTool locale={locale} />
    <div className={styles.screenOnly}><details className={styles.methodology}><summary>{t.methodology}</summary><p>{t.methodologyText}</p><p>{t.delegateHint}</p><p>{t.hhiHint}</p><p>{t.coalitionWarning}</p><p>{t.limitation}</p></details>
      <aside className={styles.service}><div><p className={styles.eyebrow}>Block Consult / Web3</p><h2>{t.serviceTitle}</h2><p>{t.serviceBody}</p></div><div className={styles.serviceLinks}><Link href={localeHref(locale, "/services/tokenomics")}>{t.tokenomics} ↗</Link><Link href={localeHref(locale, "/services/due-diligence")}>{t.diligence} ↗</Link></div></aside>
    </div>
  </div></>;
}
