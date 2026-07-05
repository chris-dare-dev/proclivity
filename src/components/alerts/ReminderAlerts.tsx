import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { PendingAlert } from "@/types";
import { dismissAlert, readAlerts, subscribeAlerts } from "@/storage/alerts";
import { SNOOZE_ALARM_PREFIX } from "@/storage/constants";

/**
 * ReminderAlerts — renders the pending-alert queue as persistent toasts.
 *
 * This is the in-app replacement for chrome.notifications (which the OS
 * suppresses invisibly on both macOS and Windows). The service worker
 * enqueues a PendingAlert when a reminder alarm fires; this component mirrors
 * the queue into sonner toasts with `duration: Infinity` so a due reminder
 * stays on screen until explicitly dismissed or snoozed. Every new-tab open
 * is a delivery point — alerts fired while no tab was open (badge-only)
 * surface here on the next open.
 *
 * Renders nothing itself; the toast host is App's <Toaster>.
 */

const canAlarm =
  typeof chrome !== "undefined" && !!chrome.alarms;

function fireTimeLabel(alert: PendingAlert): string {
  const at = new Date(alert.firedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return alert.missed ? `${at} — while you were away` : at;
}

export function ReminderAlerts({ snoozeMinutes }: { snoozeMinutes: number }) {
  // Toast action closures capture at creation time; route the current
  // setting through a ref so a Settings change applies to already-shown
  // alerts too.
  const snoozeRef = useRef(snoozeMinutes);
  snoozeRef.current = snoozeMinutes;

  // alert.id → firedAt of the occurrence already rendered, so unrelated
  // queue updates don't re-issue identical toasts.
  const shownRef = useRef(new Map<string, number>());

  useEffect(() => {
    const snooze = (alert: PendingAlert) => {
      const minutes = snoozeRef.current;
      if (canAlarm) {
        chrome.alarms.create(`${SNOOZE_ALARM_PREFIX}${alert.reminderId}`, {
          when: Date.now() + minutes * 60_000,
        });
      }
      void dismissAlert(alert.id);
      toast.success(`Snoozed — back in ${minutes} min`);
    };

    const sync = (alerts: PendingAlert[]) => {
      const pendingIds = new Set(alerts.map((a) => a.id));

      // Retract toasts whose alert was consumed elsewhere (another tab
      // dismissed it, or the reminder was deleted).
      for (const id of shownRef.current.keys()) {
        if (!pendingIds.has(id)) {
          toast.dismiss(id);
          shownRef.current.delete(id);
        }
      }

      for (const alert of alerts) {
        if (shownRef.current.get(alert.id) === alert.firedAt) continue;
        shownRef.current.set(alert.id, alert.firedAt);
        toast(alert.title, {
          id: alert.id,
          duration: Infinity,
          description: fireTimeLabel(alert),
          action: {
            label: `Snooze ${snoozeRef.current}m`,
            onClick: () => snooze(alert),
          },
          // Close-button dismissal consumes the alert so it doesn't
          // resurface on the next new-tab open.
          onDismiss: () => void dismissAlert(alert.id),
        });
      }
    };

    void readAlerts().then(sync);
    return subscribeAlerts(sync);
  }, []);

  return null;
}
