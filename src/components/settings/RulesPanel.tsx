"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RuleCondition, ConditionField, ConditionOperator } from "@/lib/rules";

// ─── Types ────────────────────────────────────────────────────────────────────

type RuleAction = "SUGGEST_DOMAIN" | "AUTO_ASSIGN_DOMAIN" | "SUGGEST_WORK_ITEM" | "FLAG_FOR_REVIEW";

interface RuleDomain { id: string; name: string; color: string }

interface Rule {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  conditions: RuleCondition[];
  action: RuleAction;
  domainId: string | null;
  domain: RuleDomain | null;
}

interface RulesPanelProps {
  initialRules: Rule[];
  domains: RuleDomain[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<ConditionField, string> = {
  subject: "Subject",
  from: "From",
  snippet: "Preview text",
  hasAttachments: "Has attachments",
  labelIds: "Label",
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  contains: "contains",
  not_contains: "does not contain",
  equals: "equals",
  starts_with: "starts with",
  ends_with: "ends with",
};

const ACTION_LABELS: Record<RuleAction, string> = {
  SUGGEST_DOMAIN: "Suggest domain",
  AUTO_ASSIGN_DOMAIN: "Auto-assign domain",
  SUGGEST_WORK_ITEM: "Create work item",
  FLAG_FOR_REVIEW: "Flag for review",
};

const ACTION_COLORS: Record<RuleAction, string> = {
  SUGGEST_DOMAIN: "bg-blue-100 text-blue-700",
  AUTO_ASSIGN_DOMAIN: "bg-indigo-100 text-indigo-700",
  SUGGEST_WORK_ITEM: "bg-green-100 text-green-700",
  FLAG_FOR_REVIEW: "bg-amber-100 text-amber-700",
};

const NEEDS_DOMAIN: RuleAction[] = ["SUGGEST_DOMAIN", "AUTO_ASSIGN_DOMAIN", "SUGGEST_WORK_ITEM"];

function conditionSummary(cond: RuleCondition): string {
  if (cond.field === "hasAttachments") return `Has attachments: ${cond.value}`;
  return `${FIELD_LABELS[cond.field]} ${OPERATOR_LABELS[cond.operator]} "${cond.value}"`;
}

function emptyCondition(): RuleCondition {
  return { field: "subject", operator: "contains", value: "" };
}

// ─── Rule form ────────────────────────────────────────────────────────────────

function RuleForm({
  initial,
  domains,
  onSave,
  onCancel,
}: {
  initial?: Partial<Rule>;
  domains: RuleDomain[];
  onSave: (data: Omit<Rule, "id" | "domain">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [action, setAction] = useState<RuleAction>(initial?.action ?? "SUGGEST_DOMAIN");
  const [domainId, setDomainId] = useState(initial?.domainId ?? "");
  const [priority, setPriority] = useState(String(initial?.priority ?? 100));
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initial?.conditions?.length ? initial.conditions : [emptyCondition()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setConditionField<K extends keyof RuleCondition>(
    i: number, key: K, value: RuleCondition[K]
  ) {
    setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, [key]: value } : c));
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (conditions.some((c) => c.field !== "hasAttachments" && !c.value.trim())) {
      setError("All condition values must be filled in"); return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: name.trim(),
        isActive: initial?.isActive ?? true,
        priority: parseInt(priority, 10) || 100,
        conditions,
        action,
        domainId: NEEDS_DOMAIN.includes(action) && domainId ? domainId : null,
      });
    } catch {
      setError("Failed to save rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-slate-50 p-4 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Rule name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Invoice emails → Finance domain"
          className="h-8 text-sm"
        />
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Conditions (all must match)</Label>
          <button
            className="text-xs text-indigo-600 hover:text-indigo-800"
            onClick={() => setConditions((p) => [...p, emptyCondition()])}
          >
            + Add condition
          </button>
        </div>
        {conditions.map((cond, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border text-xs px-2 bg-white flex-shrink-0"
              value={cond.field}
              onChange={(e) => setConditionField(i, "field", e.target.value as ConditionField)}
            >
              {(Object.keys(FIELD_LABELS) as ConditionField[]).map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
            </select>
            {cond.field === "hasAttachments" ? (
              <select
                className="h-8 rounded-md border text-xs px-2 bg-white"
                value={cond.value}
                onChange={(e) => setConditionField(i, "value", e.target.value)}
              >
                <option value="true">yes</option>
                <option value="false">no</option>
              </select>
            ) : (
              <>
                <select
                  className="h-8 rounded-md border text-xs px-2 bg-white flex-shrink-0"
                  value={cond.operator}
                  onChange={(e) => setConditionField(i, "operator", e.target.value as ConditionOperator)}
                >
                  {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
                    <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                  ))}
                </select>
                <Input
                  value={cond.value}
                  onChange={(e) => setConditionField(i, "value", e.target.value)}
                  placeholder="value"
                  className="h-8 text-xs flex-1"
                />
              </>
            )}
            {conditions.length > 1 && (
              <button
                className="text-slate-300 hover:text-red-400 flex-shrink-0"
                onClick={() => setConditions((p) => p.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <select
            className="w-full h-8 rounded-md border text-xs px-2 bg-white"
            value={action}
            onChange={(e) => setAction(e.target.value as RuleAction)}
          >
            {(Object.keys(ACTION_LABELS) as RuleAction[]).map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
        {NEEDS_DOMAIN.includes(action) && (
          <div className="space-y-1.5">
            <Label className="text-xs">Domain</Label>
            <select
              className="w-full h-8 rounded-md border text-xs px-2 bg-white"
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
            >
              <option value="">— none —</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Priority (lower = higher priority)</Label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-8 text-xs"
            min={1}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save rule"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function RulesPanel({ initialRules, domains }: RulesPanelProps) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function createRule(data: Omit<Rule, "id" | "domain">) {
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create");
    const rule: Rule = await res.json();
    setRules((p) => [...p, rule]);
    setCreating(false);
  }

  async function updateRule(id: string, data: Partial<Omit<Rule, "id" | "domain">>) {
    const res = await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update");
    const rule: Rule = await res.json();
    setRules((p) => p.map((r) => (r.id === id ? rule : r)));
    setEditingId(null);
  }

  async function deleteRule(id: string) {
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    setRules((p) => p.filter((r) => r.id !== id));
  }

  async function toggleActive(rule: Rule) {
    await updateRule(rule.id, { isActive: !rule.isActive });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Rules</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-assign domains, create work items, or flag threads when new email arrives.
          </p>
        </div>
        {!creating && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => { setCreating(true); setEditingId(null); }}
          >
            <Plus className="h-3 w-3" />
            New rule
          </Button>
        )}
      </div>

      {creating && (
        <div className="mb-3">
          <RuleForm
            domains={domains}
            onSave={createRule}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {rules.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed bg-white px-4 py-6 text-center">
          <p className="text-sm text-slate-400">No rules yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Rules run automatically when new threads are synced.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-lg border bg-white transition-opacity ${rule.isActive ? "" : "opacity-50"}`}
          >
            {editingId === rule.id ? (
              <div className="p-3">
                <RuleForm
                  initial={rule}
                  domains={domains}
                  onSave={(data) => updateRule(rule.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  {/* Toggle */}
                  <button
                    className={`mt-0.5 flex-shrink-0 w-8 h-4 rounded-full transition-colors ${rule.isActive ? "bg-indigo-500" : "bg-slate-200"}`}
                    onClick={() => toggleActive(rule)}
                    title={rule.isActive ? "Disable rule" : "Enable rule"}
                  >
                    <span
                      className={`block w-3 h-3 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${rule.isActive ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{rule.name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ACTION_COLORS[rule.action]}`}>
                        {ACTION_LABELS[rule.action]}
                      </span>
                      {rule.domain && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: rule.domain.color }} />
                          {rule.domain.name}
                        </span>
                      )}
                    </div>

                    {/* Conditions summary (expandable) */}
                    <button
                      className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => setExpandedId((p) => p === rule.id ? null : rule.id)}
                    >
                      {expandedId === rule.id
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />}
                      {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}
                    </button>
                    {expandedId === rule.id && (
                      <ul className="mt-1.5 space-y-0.5 pl-1">
                        {rule.conditions.map((c, i) => (
                          <li key={i} className="text-xs text-slate-500">
                            {conditionSummary(c)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1 rounded"
                      onClick={() => { setEditingId(rule.id); setCreating(false); }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-slate-300 hover:text-red-400 p-1 rounded"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
