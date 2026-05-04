const defaultBrand = {
  appName: "NexCRM",
  eyebrow: "CRM Intelligence",
  tagline: "Revenue clarity, cleaner workflows, sharper follow-up.",
  authHeadline: "The modern Salesforce alternative for teams that hate friction.",
  authBody:
    "Track leads, drive pipeline momentum, surface conversion insights, and keep the whole revenue team aligned from one elegant workspace.",
};

const autoSalesBrand = {
  appName: "Auto Sales Portfolio",
  eyebrow: "Imported Sample Workspace",
  tagline: "Orders, accounts, follow-up risk, and deal movement from your auto sales sample data.",
  authHeadline: "Auto sales orders turned into a live CRM workspace.",
  authBody:
    "Explore imported customers, orders, activities, and lead opportunities from the sample automotive sales dataset in one connected CRM view.",
};

export const getBranding = (user) => {
  if (user?.email === "autosales@crm.local") {
    return autoSalesBrand;
  }

  return defaultBrand;
};
