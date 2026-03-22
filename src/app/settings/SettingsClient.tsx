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
} from "lucide-react";
import { relativeTime } from "@/lib/utils";

interface Account {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  lastSyncAt: string | null;
  threadCount: number;
  lastSyncError: string | null;
}

interface TodoistStatus {
  configured: boolean;
  taskCount: number;
}

interface SettingsClientProps {
  accounts: Account[];
  todoist: TodoistStatus;
}

export function SettingsClient({ accounts: initialAccounts, todoist }: SettingsClientProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Account | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

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
                      account.lastSyncError?.includes("403");
                    return (
                      <p className="text-xs text-red-500 mt-0.5">
                        {isPermission
                          ? "Sync blocked — a Google Workspace admin must grant this app access to Gmail before this account can sync."
                          : "Account disconnected — re-authenticate to resume sync."}
                      </p>
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

          <div className="mt-3">
            <a href="/api/auth/connect">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Connect Google Account
              </Button>
            </a>
          </div>
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
