"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  CloudUpload,
  Wifi,
  WifiOff,
  Plus,
  Smartphone,
  ShieldCheck,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  validateRecord,
  drainQueue,
  type Screening,
  type QueueItem,
} from "@/lib/screening.mjs";
import * as device from "@/lib/device";
import ScreeningForm from "@/components/screening/ScreeningForm";
import DeviceQueue from "@/components/screening/DeviceQueue";
import ReviewDashboard, { ReviewDetails } from "@/components/screening/ReviewDashboard";
import { Badge, today } from "@/components/screening/shared";
import type { Submission } from "@/components/screening/types";


function blank(): Screening {
  return {
    id: crypto.randomUUID(),
    participant: "",
    age: "",
    worker: "",
    location: "",
    date: today(),
    outcome: "",
    notes: "",
    consent: false,
  };
}

export default function Home() {
  const [tab, setTab] = useState("screening");
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<Screening | null>(null);
  const [draftList, setDraftList] = useState<device.Draft[]>([]);
  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [saveStatus, setSaveStatus] = useState("Not started");
  const [storageError, setStorageError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [records, setRecords] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reviewStatus, setReviewStatus] = useState("Pending review");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [offlineReady, setOfflineReady] = useState(false);
  const [install, setInstall] = useState<any>(null);
  // Serialize draft saves so rapid typing cannot overwrite a newer draft.
  const saveChain = useRef(Promise.resolve());
  const syncingRef = useRef(false);
  const current = useRef<Screening | null>(null);
  const refreshDevice = useCallback(async () => {
    const [d, q] = await Promise.all([device.drafts(), device.queue()]);
    setDraftList(d.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setQueueList(q);
  }, []);
  const loadRecords = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch("/api/submissions", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      const data = (await res.json()) as {
        error?: string;
        records: Submission[];
        record: Submission;
      };
      if (!res.ok)
        throw new Error(data.error || "Request failed. Please retry.");
      setRecords(data.records);
    } catch (e) {
      setApiError(
        e instanceof Error ? e.message : "Could not load submissions. Retry.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
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
  }, [refreshDevice, loadRecords]);
  useEffect(() => {
    setOnline(navigator.onLine);
    let active = true;
    Promise.all([device.drafts(), device.queue()])
      .then(([d, q]) => {
        if (!active) return;
        d.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setDraftList(d);
        setQueueList(q);
        const first = d[0]?.record ?? blank();
        current.current = first;
        setForm(first);
        setSaveStatus(d.length ? "Saved on this device" : "Not started");
        setReady(true);
        void sync();
      })
      .catch((e) => {
        setStorageError(e.message);
        setReady(true);
        const f = blank();
        current.current = f;
        setForm(f);
      });
    void loadRecords();
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
    const installHandler = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", installHandler);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          await navigator.serviceWorker.ready;
          const controller = navigator.serviceWorker.controller;
          if (controller) controller.postMessage({ type: "CACHE_SHELL" });
          else
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () =>
                navigator.serviceWorker.controller?.postMessage({
                  type: "CACHE_SHELL",
                }),
              { once: true },
            );
        })
        .catch(() => {
          setOfflineReady(false);
        });
    const swMessage = (e: MessageEvent) => {
      if (e.data?.type === "OFFLINE_READY") setOfflineReady(true);
    };
    navigator.serviceWorker?.addEventListener("message", swMessage);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("beforeinstallprompt", installHandler);
      navigator.serviceWorker?.removeEventListener("message", swMessage);
    };
  }, [sync, loadRecords]);
  // Expose only view navigation; completing records still uses the visible form.
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "open_screening_view",
            description:
              "Open the screening form, device queue, or review dashboard. Does not submit or change records.",
            inputSchema: {
              type: "object",
              properties: {
                view: {
                  type: "string",
                  enum: ["screening", "queue", "dashboard"],
                },
              },
              required: ["view"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input: any) => {
              if (
                !input ||
                Object.keys(input).length !== 1 ||
                !["screening", "queue", "dashboard"].includes(input.view)
              )
                throw new Error("Choose screening, queue, or dashboard.");
              setTab(input.view);
              return { view: input.view };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => { });
    } catch { }
    return () => lifecycle.abort();
  }, []);
  function change(key: keyof Screening, value: string | boolean) {
    if (!current.current) return;
    const next = { ...current.current, [key]: value };
    current.current = next;
    setForm(next);
    setFields((p) => ({ ...p, [key]: "" }));
    setSaveStatus("Saving…");
    saveChain.current = saveChain.current
      .catch(() => { })
      .then(async () => {
        await device.saveDraft({
          id: next.id,
          record: next,
          updatedAt: new Date().toISOString(),
        });
        setStorageError("");
        setSaveStatus("Saved on this device");
        await refreshDevice();
      })
      .catch((e) => {
        setSaveStatus("Not saved");
        setStorageError(e.message);
      });
  }
  async function newForm() {
    await saveChain.current;
    const next = blank();
    current.current = next;
    setForm(next);
    setFields({});
    setSaveStatus("Not started");
    setTab("screening");
  }
  async function resume(d: device.Draft) {
    await saveChain.current;
    current.current = d.record;
    setForm(d.record);
    setFields({});
    setSaveStatus("Saved on this device");
    setTab("screening");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!current.current) return;
    setBusy(true);
    try {
      const raw = current.current;
      if (raw.date > today()) {
        setFields({ date: "Screening date cannot be in the future." });
        throw new Error("Check the highlighted fields.");
      }
      const clean = validateRecord(raw);
      await saveChain.current;
      // Draft removal and queue insertion commit in one IndexedDB transaction.
      await device.submitDraft(clean);
      setStorageError("");
      await refreshDevice();
      await newForm();
      toast.success(
        navigator.onLine
          ? "Record queued. Syncing now."
          : "Record queued on this device.",
      );
      void sync();
    } catch (e) {
      const err = e as Error & { fields?: Record<string, string> };
      if (err.fields) setFields(err.fields);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  function openReview(record: Submission) {
    setSelected(record);
    setReviewStatus(record.status);
    setReviewNote(record.review_note);
    setReviewError("");
  }
  async function saveReview() {
    if (!selected) return;
    setReviewBusy(true);
    setReviewError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status: reviewStatus,
          reviewNote,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const data = (await res.json()) as {
        error?: string;
        records: Submission[];
        record: Submission;
      };
      if (!res.ok)
        throw new Error(data.error || "Request failed. Please retry.");
      setSelected(data.record);
      setRecords((r) =>
        r.map((x) => (x.id === data.record.id ? data.record : x)),
      );
      toast.success("Review saved");
    } catch (e) {
      setReviewError(
        e instanceof Error ? e.message : "Could not save review. Retry.",
      );
    } finally {
      setReviewBusy(false);
    }
  }
  async function correct(item: QueueItem) {
    try {
      await saveChain.current;
      await device.editBlocked(item);
      await refreshDevice();
      await resume({
        id: item.id,
        record: item.record,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const waiting = queueList.filter((x) => x.state !== "synced"),
    synced = queueList.filter((x) => x.state === "synced");
  return (
    <>
      <Toaster richColors position="top-right" />
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <ClipboardList size={23} />
          </div>
          <div>
            Field Screening<span>FIELDWORK WORKSPACE</span>
          </div>
        </div>
        <div className="header-actions">
          {install && (
            <button
              className="button secondary"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
            >
              <Smartphone size={16} />
              Install app
            </button>
          )}
          <Badge kind={online ? "good" : "warning"}>
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
            {online ? "Connected" : "Offline"}
          </Badge>
          <div className="avatar" aria-label="Field workspace">
            FS
          </div>
        </div>
      </header>
      <main className="workspace">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="nav-row">
            <TabsList className="workspace-tabs" variant="line">
              <TabsTrigger value="screening">
                <Plus />
                New screening
              </TabsTrigger>
              <TabsTrigger value="queue">
                <CloudUpload />
                Device queue <span className="count">{waiting.length}</span>
              </TabsTrigger>
              <TabsTrigger value="dashboard">
                <LayoutDashboard />
                Review dashboard
              </TabsTrigger>
            </TabsList>
            <span className="demo-label">
              Portfolio demo · fictional data only
            </span>
          </div>
          {storageError && (
            <div className="error-banner" role="alert">
              <AlertCircle size={19} />
              {storageError}
              <button
                onClick={() =>
                  refreshDevice()
                    .then(() => setStorageError(""))
                    .catch((e) => setStorageError(e.message))
                }
              >
                Retry storage
              </button>
            </div>
          )}
          {!online && (
            <div className="offline-banner">
              <WifiOff size={18} />
              You’re offline. Keep collecting; records will sync when you
              reconnect with the app open.
            </div>
          )}
          <TabsContent value="screening">
            <ScreeningForm
              form={form}
              fields={fields}
              saveStatus={saveStatus}
              ready={ready}
              busy={busy}
              storageError={storageError}
              online={online}
              syncing={syncing}
              offlineReady={offlineReady}
              draftList={draftList}
              waiting={waiting}
              synced={synced}
              change={change}
              submit={submit}
              newForm={newForm}
              resume={resume}
              sync={sync}
            />
          </TabsContent>
          <TabsContent value="queue">
            <DeviceQueue
              draftList={draftList}
              queueList={queueList}
              waiting={waiting}
              synced={synced}
              online={online}
              syncing={syncing}
              storageError={storageError}
              busy={busy}
              sync={sync}
              resume={resume}
              correct={correct}
            />
          </TabsContent>
          <TabsContent value="dashboard">
            <ReviewDashboard
              records={records}
              filter={filter}
              loading={loading}
              online={online}
              apiError={apiError}
              setFilter={setFilter}
              loadRecords={loadRecords}
              openReview={openReview}
            />
          </TabsContent>
        </Tabs>
        <footer className="workspace-footer">
          <span>
            <ShieldCheck size={15} />
            Field Screening
          </span>
          <span>Draft → Queue → Sync → Review</span>
        </footer>
      </main>
      <ReviewDetails
        selected={selected}
        reviewStatus={reviewStatus}
        reviewNote={reviewNote}
        reviewBusy={reviewBusy}
        reviewError={reviewError}
        online={online}
        setSelected={setSelected}
        setReviewStatus={setReviewStatus}
        setReviewNote={setReviewNote}
        saveReview={saveReview}
      />
    </>
  );
}
