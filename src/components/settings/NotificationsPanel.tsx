"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, BellOff, CheckCircle, AlertCircle, Send } from "lucide-react";

interface Prefs {
  newMailEnabled: boolean;
  reminderEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

// Convert a base64url VAPID public key to the Uint8Array the Push API wants.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
function hourLabel(h: number): string {
  const am = h < 12;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${am ? "AM" : "PM"}`;
}

export function NotificationsPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(true);

  // Load server config + current subscription state on mount.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      setConfigured(false);
      return;
    }
    setPermission(Notification.permission);

    (async () => {
      try {
        const [vapidRes, prefsRes] = await Promise.all([
          fetch("/api/notifications/vapid"),
          fetch("/api/notifications/preferences"),
        ]);
        const vapid = await vapidRes.json();
        setConfigured(Boolean(vapid.configured));
        setPublicKey(vapid.publicKey ?? "");
        setPrefs(await prefsRes.json());

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(Boolean(sub));
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setMessage("Notification permission was not granted.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("Failed to register subscription");
      setSubscribed(true);
      setMessage("Notifications enabled on this device.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Notifications disabled on this device.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setMessage(`Test sent to ${data.delivered} device(s).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const updatePrefs = useCallback(async (patch: Partial<Prefs>) => {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : prev));
    await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Notifications</h2>

      <div className="rounded-lg border bg-white px-4 py-3 space-y-4">
        {/* Status row */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            {configured && subscribed ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-slate-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Push notifications</p>
            {!supported ? (
              <p className="text-xs text-slate-500">
                This browser does not support push notifications.
              </p>
            ) : configured === false ? (
              <p className="text-xs text-slate-500">
                Not configured. Generate VAPID keys with{" "}
                <code className="font-mono bg-slate-100 px-1 rounded">npx web-push generate-vapid-keys</code>{" "}
                and set <code className="font-mono bg-slate-100 px-1 rounded">VAPID_PUBLIC_KEY</code> /{" "}
                <code className="font-mono bg-slate-100 px-1 rounded">VAPID_PRIVATE_KEY</code> in your environment.
              </p>
            ) : subscribed ? (
              <p className="text-xs text-slate-500">
                Enabled on this device. New mail and task reminders will appear as notifications.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {permission === "denied"
                  ? "Notifications are blocked in your browser settings for this site."
                  : "Enable to get new-mail alerts and task reminders on this device."}
              </p>
            )}
          </div>
          {configured && supported && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {subscribed ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={busy}
                    onClick={sendTest}
                  >
                    <Send className="h-3 w-3" />
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-slate-500"
                    disabled={busy}
                    onClick={disable}
                  >
                    <BellOff className="h-3 w-3" />
                    Disable
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={busy || permission === "denied"}
                  onClick={enable}
                >
                  <Bell className="h-3 w-3" />
                  Enable
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Preferences (only meaningful once configured) */}
        {configured && prefs && (
          <div className="border-t pt-3 space-y-2.5">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={prefs.newMailEnabled}
                onChange={(e) => updatePrefs({ newMailEnabled: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              New-mail notifications
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={prefs.reminderEnabled}
                onChange={(e) => updatePrefs({ reminderEnabled: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Task reminders
            </label>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 w-28">Quiet hours</span>
              <Select
                value={prefs.quietHoursStart === null ? "off" : String(prefs.quietHoursStart)}
                onValueChange={(v) =>
                  updatePrefs({ quietHoursStart: v === "off" ? null : Number(v) })
                }
              >
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue placeholder="Off" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off" className="text-xs">Off</SelectItem>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)} className="text-xs">
                      From {hourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={prefs.quietHoursEnd === null ? "off" : String(prefs.quietHoursEnd)}
                onValueChange={(v) =>
                  updatePrefs({ quietHoursEnd: v === "off" ? null : Number(v) })
                }
              >
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue placeholder="Off" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off" className="text-xs">Off</SelectItem>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)} className="text-xs">
                      Until {hourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-slate-400">
              Quiet hours suppress new-mail alerts. Task reminders you set still fire.
            </p>
          </div>
        )}

        {message && <p className="text-xs text-slate-500">{message}</p>}
      </div>
    </section>
  );
}
