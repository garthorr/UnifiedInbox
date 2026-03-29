"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  LogOut,
  ExternalLink,
  Server,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { relativeTime } from "@/lib/utils";

interface Account {
  id: string;
  email: string;
  displayName: string;
  accountType: string;
  isActive: boolean;
  lastSyncAt: string | null;
  threadCount: number;
  lastSyncError: string | null;
}

interface Domain {
  id: string;
  name: string;
  color: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  workItemCount: number;
}

interface TodoistStatus {
  configured: boolean;
  taskCount: number;
}

interface SettingsClientProps {
  accounts: Account[];
  todoist: TodoistStatus;
  domains: Domain[];
}

const IMAP_DEFAULTS: Record<string, { imap: string; imapPort: number; smtp: string; smtpPort: number }> = {
  "gmail.com": { imap: "imap.gmail.com", imapPort: 993, smtp: "smtp.gmail.com", smtpPort: 587 },
  "outlook.com": { imap: "outlook.office365.com", imapPort: 993, smtp: "smtp.office365.com", smtpPort: 587 },
  "hotmail.com": { imap: "outlook.office365.com", imapPort: 993, smtp: "smtp.office365.com", smtpPort: 587 },
  "yahoo.com": { imap: "imap.mail.yahoo.com", imapPort: 993, smtp: "smtp.mail.yahoo.com", smtpPort: 587 },
};

export function SettingsClient({ accounts: initialAccounts, todoist, domains: initialDomains }: SettingsClientProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [domains, setDomains] = useState(initialDomains);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Account | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // IMAP connect form
  const [imapOpen, setImapOpen] = useState(false);
  const [imapEmail, setImapEmail] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [imapError, setImapError] = useState("");
  const [imapLoading, setImapLoading] = useState(false);

  function handleImapEmailChange(email: string) {
    setImapEmail(email);
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const def = IMAP_DEFAULTS[domain];
    if (def) {
      setImapHost(def.imap);
      setImapPort(String(def.imapPort));
      setSmtpHost(def.smtp);
      setSmtpPort(String(def.smtpPort));
    }
  }

  async function handleImapConnect() {
    if (!imapEmail || !imapPassword || !imapHost) {
      setImapError("Email, password, and IMAP host are required.");
      return;
    }
    setImapLoading(true);
    setImapError("");
    try {
      const res = await fetch("/api/accounts/imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: imapEmail,
          password: imapPassword,
          imapHost,
          imapPort: parseInt(imapPort) || 993,
          smtpHost: smtpHost || undefined,
          smtpPort: parseInt(smtpPort) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      setImapOpen(false);
      setImapEmail(""); setImapPassword(""); setImapHost("");
      setImapPort("993"); setSmtpHost(""); setSmtpPort("587");
      router.refresh();
    } catch (err) {
      setImapError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setImapLoading(false);
    }
  }

  // Domain state
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainColor, setNewDomainColor] = useState("#6366f1");
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  async function createDomain() {
    if (!newDomainName.trim()) return;
    setDomainError("");
    setAddingDomain(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDomainName.trim(), color: newDomainColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create domain");
      setDomains((prev) => [...prev, { ...data, workItemCount: 0 }]);
      setNewDomainName("");
      setNewDomainColor("#6366f1");
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Failed to create domain");
    } finally {
      setAddingDomain(false);
    }
  }

  async function saveDomain() {
    if (!editingDomain || !editName.trim()) return;
    setDomainError("");
    try {
      const res = await fetch(`/api/domains/${editingDomain.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update domain");
      setDomains((prev) => prev.map((d) => (d.id === editingDomain.id ? { ...d, name: data.name, color: data.color } : d)));
      setEditingDomain(null);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Failed to update domain");
    }
  }

  async function deleteDomain(id: string) {
    setDeletingDomain(id);
    setDomainError("");
    try {
      const res = await fetch(`/api/domains/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete domain");
      setDomains((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Failed to delete domain");
    } finally {
      setDeletingDomain(null);
    }
  }

  async function syncAccount(id: string) {
    setSyncing(id);
    try {
      await fetch(`/api/accounts/${id}/sync`, { method: "POST" });
      // Fire and forget — refresh after a short delay
      setTimeout(() => {
        router.refresh();
        setSyncing(null);
      }, 2000);
    } catch {
      setSyncing(null);
    }
  }

  async function removeAccount(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setRemoving(null);
      setConfirmRemove(null);
    }
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-slate-900">Settings</h1>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-slate-500"
          onClick={logout}
          disabled={loggingOut}
        >
          <LogOut className="h-3 w-3" />
          {loggingOut ? "Signing out..." : "Sign out"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl space-y-8">
        {/* Connected accounts */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Connected Accounts
          </h2>

          {accounts.some((a) => a.accountType === "GMAIL" && a.isActive) && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              <span>
                Gmail permissions were recently updated to enable reply, archive, and trash.
                If these actions return errors, disconnect and reconnect your Google account to grant the new permissions.
              </span>
            </div>
          )}

          {accounts.length === 0 && (
            <p className="text-sm text-slate-400 mb-4">
              No accounts connected yet. Add a Gmail account to get started.
            </p>
          )}

          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-start gap-3 rounded-lg border bg-white px-4 py-3"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {account.isActive ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {account.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    {account.threadCount.toLocaleString()} threads synced
                    {account.lastSyncAt
                      ? ` · Last sync ${relativeTime(account.lastSyncAt)}`
                      : " · Never synced"}
                  </p>
                  {!account.isActive && (() => {
                    const isPermission =
                      account.lastSyncError?.includes("Insufficient Permission") ||
                      account.lastSyncError?.includes("insufficientPermissions") ||
                      account.lastSyncError?.includes("403");
                    const isPersonalGmail = account.email.endsWith("@gmail.com");
                    let errorMsg: string;
                    if (isPermission && !isPersonalGmail) {
                      errorMsg =
                        "Sync blocked — a Google Workspace admin must authorize this app for your organization before it can access Gmail.";
                    } else if (isPermission && isPersonalGmail) {
                      errorMsg =
                        "Gmail access denied — remove this account and reconnect, making sure to allow Gmail access when prompted.";
                    } else {
                      errorMsg = "Account disconnected — remove and reconnect to resume sync.";
                    }
                    return (
                      <p className="text-xs text-red-500 mt-0.5">{errorMsg}</p>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={syncing === account.id}
                    onClick={() => syncAccount(account.id)}
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${syncing === account.id ? "animate-spin" : ""}`}
                    />
                    {syncing === account.id ? "Syncing..." : "Sync Now"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-400 hover:text-red-500"
                    disabled={removing === account.id}
                    onClick={() => setConfirmRemove(account)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <a href="/api/auth/connect">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Connect Google Account
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setImapOpen(true)}
            >
              <Server className="h-3 w-3" />
              Connect via IMAP
            </Button>
          </div>

          {/* IMAP connect dialog */}
          <Dialog open={imapOpen} onOpenChange={setImapOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Connect IMAP Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email address</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={imapEmail}
                    onChange={(e) => handleImapEmailChange(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Password / App password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">IMAP host</Label>
                    <Input
                      placeholder="imap.example.com"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Port</Label>
                    <Input
                      placeholder="993"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">
                      SMTP host <span className="font-normal text-slate-400">(optional)</span>
                    </Label>
                    <Input
                      placeholder="smtp.example.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Port</Label>
                    <Input
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                {imapError && <p className="text-xs text-red-500">{imapError}</p>}
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setImapOpen(false)} disabled={imapLoading}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleImapConnect} disabled={imapLoading}>
                  {imapLoading ? "Connecting…" : "Connect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        {/* Domains */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Domains</h2>
          <div className="space-y-1">
            {domains.map((domain) =>
              editingDomain?.id === domain.id ? (
                <div key={domain.id} className="flex items-center gap-2 py-1">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-7 w-8 cursor-pointer rounded border border-slate-200 p-0.5"
                  />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") saveDomain(); if (e.key === "Escape") setEditingDomain(null); }}
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={saveDomain}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDomain(null)}>Cancel</Button>
                </div>
              ) : (
                <div key={domain.id} className="flex items-center gap-2 py-1 group">
                  <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
                  <span className="text-sm flex-1">{domain.name}</span>
                  <span className="text-xs text-slate-400">{domain.workItemCount} work item{domain.workItemCount !== 1 ? "s" : ""}</span>
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditingDomain(domain); setEditName(domain.name); setEditColor(domain.color); setDomainError(""); }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 text-xs text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={deletingDomain === domain.id}
                    onClick={() => deleteDomain(domain.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            )}
          </div>

          {/* Add domain row */}
          <div className="flex items-center gap-2 mt-3">
            <input
              type="color"
              value={newDomainColor}
              onChange={(e) => setNewDomainColor(e.target.value)}
              className="h-7 w-8 cursor-pointer rounded border border-slate-200 p-0.5"
            />
            <Input
              placeholder="New domain name…"
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createDomain(); }}
              className="h-7 text-sm flex-1"
            />
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1"
              disabled={!newDomainName.trim() || addingDomain}
              onClick={createDomain}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>
          {domainError && <p className="mt-1.5 text-xs text-red-500">{domainError}</p>}
        </section>

        {/* Todoist integration */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Integrations
          </h2>
          <div className="rounded-lg border bg-white px-4 py-3 flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {todoist.configured ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-slate-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">Todoist</p>
              {todoist.configured ? (
                <p className="text-xs text-slate-500">
                  Connected · {todoist.taskCount.toLocaleString()} task
                  {todoist.taskCount !== 1 ? "s" : ""} linked
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Not configured. Set the{" "}
                  <code className="font-mono bg-slate-100 px-1 rounded">
                    TODOIST_API_KEY
                  </code>{" "}
                  environment variable to enable Todoist integration.
                </p>
              )}
            </div>
            {!todoist.configured && (
              <a
                href="https://app.todoist.com/app/settings/integrations/developer"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Get API token
                </Button>
              </a>
            )}
          </div>
        </section>
      </div>

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <Dialog open onOpenChange={() => setConfirmRemove(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Account</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Are you sure you want to remove{" "}
              <span className="font-medium">{confirmRemove.email}</span>? This
              will delete all synced threads for this account. Work items and
              their attachments will be detached but not deleted.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmRemove(null)}
                disabled={removing === confirmRemove.id}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeAccount(confirmRemove.id)}
                disabled={removing === confirmRemove.id}
              >
                {removing === confirmRemove.id ? "Removing..." : "Remove Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
