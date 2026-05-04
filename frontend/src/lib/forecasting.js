export const FORECAST_BUCKET_ORDER = ["commit", "best_case", "pipeline", "omitted"];

export const FORECAST_BUCKET_META = {
  commit: {
    key: "commit",
    label: "Commit",
    tone: "success",
    accent: "#22c55e",
    description: "High-confidence deals likely to close this cycle.",
  },
  best_case: {
    key: "best_case",
    label: "Best Case",
    tone: "warning",
    accent: "#f59e0b",
    description: "Strong upside opportunities that still need progression.",
  },
  pipeline: {
    key: "pipeline",
    label: "Pipeline",
    tone: "info",
    accent: "#38bdf8",
    description: "Early or medium-confidence opportunities still forming.",
  },
  omitted: {
    key: "omitted",
    label: "Omitted",
    tone: "neutral",
    accent: "#94a3b8",
    description: "Closed or low-confidence items excluded from forecast calls.",
  },
};

export function getForecastBucket(deal = {}) {
  const status = String(deal.status || "").toLowerCase();
  if (status === "won" || status === "lost") {
    return "omitted";
  }

  const stage = String(deal.stage || "").toLowerCase();
  const probability = Number(deal.probability || 0);

  if (probability >= 75 || stage === "negotiation") {
    return "commit";
  }

  if (probability >= 45 || stage === "proposal") {
    return "best_case";
  }

  return "pipeline";
}

export function getForecastBucketMeta(bucket) {
  return FORECAST_BUCKET_META[bucket] || FORECAST_BUCKET_META.pipeline;
}

export function buildForecastSummary(deals = []) {
  const seed = FORECAST_BUCKET_ORDER.reduce((result, key) => {
    result[key] = {
      bucket: key,
      ...getForecastBucketMeta(key),
      count: 0,
      value: 0,
      weightedValue: 0,
    };
    return result;
  }, {});

  for (const deal of deals) {
    const bucket = getForecastBucket(deal);
    const value = Number(deal.value || 0);
    const probability = Number(deal.probability || 0);

    seed[bucket].count += 1;
    seed[bucket].value += value;

    if (bucket !== "omitted") {
      seed[bucket].weightedValue += value * (probability / 100);
    }
  }

  return FORECAST_BUCKET_ORDER.map((bucket) => seed[bucket]);
}
