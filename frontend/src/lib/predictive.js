function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toTimestamp(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

function diffHours(laterTs, earlierTs) {
  if (!laterTs || !earlierTs) return 0;
  return Math.max(0, (laterTs - earlierTs) / (1000 * 60 * 60));
}

function diffDays(laterTs, earlierTs) {
  if (!laterTs || !earlierTs) return 0;
  return Math.max(0, (laterTs - earlierTs) / (1000 * 60 * 60 * 24));
}

export function getLeadScoreMeta(score) {
  if (score >= 75) {
    return { band: "high", label: "High", tone: "success" };
  }

  if (score >= 45) {
    return { band: "medium", label: "Medium", tone: "warning" };
  }

  return { band: "low", label: "Low", tone: "danger" };
}

export function scoreLeadConversion(
  lead,
  { activities = [], responseSlaHours = 24, escalationHours = 48, nowTs = Date.now() } = {}
) {
  const status = String(lead.status || "").toLowerCase();
  if (status === "converted") {
    return {
      score: 100,
      ...getLeadScoreMeta(100),
      reasons: ["Already converted"],
    };
  }

  if (status === "lost") {
    return {
      score: 5,
      ...getLeadScoreMeta(5),
      reasons: ["Lead marked as lost"],
    };
  }

  let score = 50;
  const reasons = [];

  if (status === "qualified") {
    score += 26;
    reasons.push("Qualified lead stage");
  } else if (status === "contacted") {
    score += 14;
    reasons.push("Initial contact already made");
  }

  if (lead.assigned_to) {
    score += 10;
  } else {
    score -= 12;
    reasons.push("No owner assigned");
  }

  if (lead.email || lead.phone) {
    score += 8;
  } else {
    score -= 10;
    reasons.push("Missing contact method");
  }

  const estimatedValue = Number(lead.estimated_value || 0);
  if (estimatedValue >= 100000) {
    score += 10;
    reasons.push("High potential deal value");
  } else if (estimatedValue > 0) {
    score += 6;
  }

  const createdTs = toTimestamp(lead.created_at) || toTimestamp(lead.updated_at) || nowTs;
  const updatedTs = toTimestamp(lead.updated_at) || createdTs;
  const ageHours = diffHours(nowTs, createdTs);
  const ageDays = diffDays(nowTs, createdTs);

  const firstResponseTs = activities
    .map((activity) => toTimestamp(activity.created_at) || toTimestamp(activity.updated_at))
    .filter(Boolean)
    .sort((left, right) => left - right)[0] || null;

  const recentTouchpointTs = activities
    .map((activity) => toTimestamp(activity.updated_at) || toTimestamp(activity.created_at))
    .filter(Boolean)
    .sort((left, right) => right - left)[0] || null;

  if (firstResponseTs) {
    const responseHours = diffHours(firstResponseTs, createdTs);
    if (responseHours <= responseSlaHours) {
      score += 12;
    } else {
      score -= 8;
      reasons.push("Slow first response");
    }
  } else if (ageHours >= responseSlaHours) {
    score -= 14;
    reasons.push("No response within SLA");
  }

  if (recentTouchpointTs && diffDays(nowTs, recentTouchpointTs) <= 7) {
    score += 8;
  } else if (ageHours >= escalationHours) {
    score -= 10;
    reasons.push("No recent engagement");
  }

  const overdueTasks = activities.filter((activity) => {
    const dueTs = toTimestamp(activity.due_at);
    return (
      String(activity.type || "").toLowerCase() === "task" &&
      !activity.completed_at &&
      dueTs &&
      dueTs < nowTs
    );
  }).length;

  if (overdueTasks > 0) {
    score -= Math.min(18, overdueTasks * 6);
    reasons.push(`${overdueTasks} overdue task${overdueTasks > 1 ? "s" : ""}`);
  }

  if (ageDays > 30) {
    score -= 8;
    reasons.push("Lead aging without conversion");
  }

  if (diffDays(nowTs, updatedTs) > 14) {
    score -= 6;
    reasons.push("Record not updated recently");
  }

  const normalizedScore = Math.round(clamp(score, 0, 100));
  const meta = getLeadScoreMeta(normalizedScore);

  return {
    score: normalizedScore,
    ...meta,
    reasons: reasons.slice(0, 3),
  };
}

export function getDealRiskMeta(score) {
  if (score >= 75) {
    return { band: "critical", label: "Critical", tone: "danger" };
  }

  if (score >= 55) {
    return { band: "high", label: "High", tone: "danger" };
  }

  if (score >= 35) {
    return { band: "medium", label: "Medium", tone: "warning" };
  }

  return { band: "low", label: "Low", tone: "success" };
}

export function scoreDealSlipRisk(
  deal,
  { followUpSlaDays = 14, nowTs = Date.now() } = {}
) {
  const status = String(deal.status || "").toLowerCase();
  if (status === "won" || status === "lost") {
    return {
      score: 0,
      ...getDealRiskMeta(0),
      staleDays: 0,
      daysToClose: null,
      reasons: ["Closed deal"],
    };
  }

  let score = 20;
  const reasons = [];

  const updatedTs = toTimestamp(deal.updated_at) || toTimestamp(deal.created_at) || nowTs;
  const staleDays = diffDays(nowTs, updatedTs);

  if (staleDays >= followUpSlaDays) {
    score += 25;
    reasons.push(`Stale for ${Math.floor(staleDays)} days`);
  } else if (staleDays >= followUpSlaDays / 2) {
    score += 10;
  }

  const expectedCloseTs = toTimestamp(deal.expected_close_date);
  const daysToClose = expectedCloseTs ? diffDays(expectedCloseTs, nowTs) : null;
  const probability = Number(deal.probability || 0);
  const stage = String(deal.stage || "").toLowerCase();

  if (daysToClose === null) {
    score += 10;
    reasons.push("No expected close date");
  } else if (daysToClose < 0) {
    score += 25;
    reasons.push("Past expected close date");
  } else if (daysToClose <= 7 && probability < 60) {
    score += 20;
    reasons.push("Close date near with low confidence");
  } else if (daysToClose <= 14 && probability < 40) {
    score += 15;
  }

  if (stage === "negotiation" && probability < 55) {
    score += 15;
    reasons.push("Negotiation stage with weak confidence");
  }

  if (stage === "proposal" && probability < 35) {
    score += 10;
  }

  if (stage === "discovery" && probability > 80) {
    score += 10;
    reasons.push("Probability/stage mismatch");
  }

  if (!deal.owner_id) {
    score += 12;
    reasons.push("No deal owner assigned");
  }

  const value = Number(deal.value || 0);
  if (value >= 100000) {
    score += 8;
  }

  const normalizedScore = Math.round(clamp(score, 0, 100));
  const meta = getDealRiskMeta(normalizedScore);

  return {
    score: normalizedScore,
    ...meta,
    staleDays: Math.floor(staleDays),
    daysToClose: daysToClose === null ? null : Math.floor(daysToClose),
    reasons: reasons.slice(0, 3),
  };
}
