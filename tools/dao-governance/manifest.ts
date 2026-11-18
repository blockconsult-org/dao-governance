export const manifest = {
  id: "dao-governance",
  practice: "web3",
  publicPath: "/tools/dao-governance",
  title: { en: "DAO Governance Simulator", de: "DAO-Governance-Simulator" },
  description: {
    en: "Explore how voting power, turnout, delegation and voting rules shape a proposal. Compare scenarios and share a governance discussion sheet.",
    de: "Erkunde, wie Stimmgewicht, Beteiligung, Delegation und Abstimmungsregeln einen Antrag beeinflussen. Vergleiche Szenarien und teile ein Diskussionsblatt.",
  },
  relatedServicePaths: ["/services/tokenomics", "/services/due-diligence"],
  schemaVersion: 1,
  methodologyVersion: 1,
} as const;
