"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, RefreshCw, MonitorSmartphone } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface WorkerInfo {
  alive: boolean;
  heartbeatAt: string | null;
  startedAt: string | null;
}

interface QueueInfo {
  pending: number;
  running: { account: string; claimedAt: string | null }[];
}

interface AccountHealth {
  id: string;
  email: string;
  accountType: string;
  isActive: boolean;
  lastSyncAt: string | null;
  tokenExpired: boolean;
  failures24h: number;
  lastError: string | null;
  lastErrorAt: string | null;
}

interface StatusResponse {
  worker: WorkerInfo;
  queue: QueueInfo;
  accounts: AccountHealth[];
  activeSessions: number;
}

interface SessionInfo {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

function shortUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/iphone|ipad/i.test(ua)) return "iOS device";
  if (/android/i.test(ua)) return "Android device";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return ua.slice(0, 40);
}

export function SystemPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, sessionsRes] = await Promise.all([
        fetch("/api/admin/status"),
        fetch("/api/auth/sessions"),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (sessionsRes.ok) setSessions((await sessionsRes.json()).sessions ?? []);
    } catch {
      // Leave whatever was rendered; the refresh button retries.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revokeOtherSessions() {
    setRevoking(true);
    try {
      const res = await fetch("/api/auth/sessions", { method: "DELETE" });
      if (res.ok) {
        const { revoked } = await res.json();
        toast({ message: `Signed out ${revoked} other session(s)`, variant: "success" });
        await load();
      } else {
        toast({ message: "Failed to revoke sessions", variant: "error" });
      }
    } finally {
      setRevoking(false);
    }
  }

  const unhealthyAccounts =
    status?.accounts.filter((a) => a.tokenExpired || a.failures24h > 0 || !a.isActive) ?? [];

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">System</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-slate-500"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {/* Worker status */}
        <div className="flex items-start gap-3 rounded-lg border bg-white px-4 py-3">
          <div className="mt-0.5 flex-shrink-0">
            {status?.worker.alive ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">
              Background worker{" "}
              {status === null ? "" : status.worker.alive ? "running" : "not responding"}
            </p>
            <p className="text-xs text-slate-500">
              {status === null
                ? "Checking…"
                : status.worker.alive
                  ? `Heartbeat ${relativeTime(status.worker.heartbeatAt!)} · started ${relativeTime(status.worker.startedAt!)}` +
                    (status.queue.pending > 0 ? ` · ${status.queue.pending} job(s) queued` : "") +
                    (status.queue.running.length > 0
                      ? ` · syncing ${status.queue.running.map((j) => j.account).join(", ")}`
                      : "")
                  : status.worker.heartbeatAt
                    ? `Last heartbeat ${relativeTime(status.worker.heartbeatAt)} — mail is not syncing. Check the worker container (docker compose logs worker).`
                    : "Never started — mail is not syncing. Check the worker container (docker compose logs worker)."}
            </p>
          </div>
        </div>

        {/* Account health — only shown when something needs attention */}
        {unhealthyAccounts.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{a.email}</p>
              <p className="text-xs text-amber-800">
                {a.tokenExpired && "Google token expired — reconnect to resume sync. "}
                {a.failures24h > 0 &&
                  `${a.failures24h} sync failure(s) in the last 24h${a.lastError ? `: ${a.lastError}` : ""}`}
                {!a.isActive && !a.tokenExpired && a.failures24h === 0 && "Account is disabled."}
              </p>
            </div>
            {a.accountType === "GMAIL" && a.tokenExpired && (
              <a href="/api/auth/connect" className="flex-shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Reconnect
                </Button>
              </a>
            )}
          </div>
        ))}

        {/* Sessions */}
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-800">
                Active sessions ({sessions.length})
              </p>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={revokeOtherSessions}
                disabled={revoking}
              >
                {revoking ? "Revoking…" : "Sign out other sessions"}
              </Button>
            )}
          </div>
          {sessions.length > 0 && (
            <ul className="mt-2 space-y-1">
              {sessions.map((s) => (
                <li key={s.id} className="text-xs text-slate-500">
                  {shortUserAgent(s.userAgent)}
                  {s.current && <span className="text-green-600"> · this device</span>}
                  {" · last active "}
                  {relativeTime(s.lastSeenAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
