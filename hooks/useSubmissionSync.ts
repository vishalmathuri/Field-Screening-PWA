"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { drainQueue } from "@/lib/screening.mjs";
import * as device from "@/lib/device";
import type { Submission } from "@/components/screening/types";

type SyncOptions = {
  ready: boolean;
  refreshDevice: () => Promise<void>;
  loadRecords: () => Promise<void>;
  setStorageError: (message: string) => void;
};

export function useSubmissionSync({
  ready, refreshDevice, loadRecords, setStorageError,
}: SyncOptions) {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const run = async () =>
        drainQueue(await device.queue(), {
          send: async (record) => {
            const res = await fetch("/api/submissions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(record),
              signal: AbortSignal.timeout(12000),
            });
            const data = (await res.json()) as {
              error?: string;
              records: Submission[];
              record: Submission;
            };
            if (!res.ok) {
              const e = new Error(
                data.error || "Server unavailable. Retry shortly.",
              ) as Error & { permanent?: boolean };
              e.permanent = [400, 409, 413, 422].includes(res.status);
              throw e;
            }
            return { id: data.record.id };
          },
          save: device.saveQueue,
          notify: () => {
            void refreshDevice().catch((e) => setStorageError(e.message));
          },
        });
      const sent = navigator.locks
        ? await navigator.locks.request("field-screening-sync", run)
        : await run();
      await refreshDevice();
      if (sent) {
        toast.success(`${sent} ${sent === 1 ? "record" : "records"} synced`);
        void loadRecords();
      }
    } catch (e) {
      setStorageError(
        e instanceof Error ? e.message : "Could not read the device queue.",
      );
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshDevice, loadRecords, setStorageError]);
  useEffect(() => {
    if (ready) void sync();
  }, [ready, sync]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const connected = () => {
      setOnline(true);
      void sync();
      void loadRecords();
    };
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    const interval = setInterval(() => {
      if (navigator.onLine) void sync();
    }, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [sync, loadRecords]);

  return { online, syncing, sync };
}
