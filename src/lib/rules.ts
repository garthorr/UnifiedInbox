import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConditionField = "subject" | "from" | "snippet" | "hasAttachments" | "labelIds";
export type ConditionOperator = "contains" | "not_contains" | "equals" | "starts_with" | "ends_with";

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

// ─── Condition matching ──────────────────────────────────────────────────────

function matchCondition(
  cond: RuleCondition,
  thread: {
    subject: string;
    participantAddresses: string[];
    snippet: string;
    hasAttachments: boolean;
    gmailLabelIds: string[];
  }
): boolean {
  if (cond.field === "hasAttachments") {
    const want = cond.value.toLowerCase() === "true";
    return thread.hasAttachments === want;
  }

  let haystack: string;
  if (cond.field === "from") {
    haystack = thread.participantAddresses.join(" ").toLowerCase();
  } else if (cond.field === "labelIds") {
    haystack = thread.gmailLabelIds.join(" ").toLowerCase();
  } else {
    haystack = (thread[cond.field] ?? "").toLowerCase();
  }

  const needle = cond.value.toLowerCase();
  switch (cond.operator) {
    case "contains":     return haystack.includes(needle);
    case "not_contains": return !haystack.includes(needle);
    case "equals":       return haystack === needle;
    case "starts_with":  return haystack.startsWith(needle);
    case "ends_with":    return haystack.endsWith(needle);
  }
}

// ─── Apply rules to a thread ─────────────────────────────────────────────────

/**
 * Run all active rules against the given thread and apply matching actions.
 * Rules are evaluated in priority order (lowest number = highest priority).
 * Multiple rules can fire; each action type is applied at most once
 * (first match wins for domain assignment; flags always apply).
 */
export async function applyRulesToThread(threadId: string): Promise<void> {
  const thread = await prisma.threadMirror.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      accountId: true,
      subject: true,
      participantAddresses: true,
      snippet: true,
      hasAttachments: true,
      gmailLabelIds: true,
      workItemId: true,
      domainId: true,
      isFlagged: true,
    },
  });
  if (!thread) return;

  const rules = await prisma.rule.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" },
  });

  let domainAssigned = false;

  for (const rule of rules) {
    const conditions = (rule.conditions as unknown) as RuleCondition[];
    if (!conditions.every((c) => matchCondition(c, thread))) continue;

    if (
      (rule.action === "SUGGEST_DOMAIN" || rule.action === "AUTO_ASSIGN_DOMAIN") &&
      !domainAssigned &&
      rule.domainId &&
      !thread.domainId
    ) {
      await prisma.threadMirror.update({
        where: { id: threadId },
        data: { domainId: rule.domainId },
      });
      thread.domainId = rule.domainId; // reflect locally for subsequent rules
      domainAssigned = true;
      await prisma.activityLog.create({
        data: {
          eventType: "RULE_APPLIED",
          accountId: thread.accountId,
          description: `Rule "${rule.name}" assigned domain`,
          metadata: { ruleId: rule.id, action: rule.action, domainId: rule.domainId },
        },
      });
    } else if (rule.action === "SUGGEST_WORK_ITEM" && !thread.workItemId) {
      const workItem = await prisma.workItem.create({
        data: {
          title: thread.subject,
          status: "NEW",
          domainId: rule.domainId ?? thread.domainId ?? undefined,
        },
      });
      await prisma.threadMirror.update({
        where: { id: threadId },
        data: {
          workItemId: workItem.id,
          domainId: workItem.domainId ?? thread.domainId ?? undefined,
        },
      });
      thread.workItemId = workItem.id;
      await prisma.activityLog.create({
        data: {
          eventType: "RULE_APPLIED",
          accountId: thread.accountId,
          workItemId: workItem.id,
          description: `Rule "${rule.name}" created work item`,
          metadata: { ruleId: rule.id, action: rule.action },
        },
      });
    } else if (rule.action === "FLAG_FOR_REVIEW" && !thread.isFlagged) {
      await prisma.threadMirror.update({
        where: { id: threadId },
        data: { isFlagged: true },
      });
      thread.isFlagged = true;
      await prisma.activityLog.create({
        data: {
          eventType: "RULE_APPLIED",
          accountId: thread.accountId,
          description: `Rule "${rule.name}" flagged thread for review`,
          metadata: { ruleId: rule.id, action: rule.action },
        },
      });
    }
  }
}
