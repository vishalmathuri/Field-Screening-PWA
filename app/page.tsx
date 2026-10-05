"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useScreeningDrafts } from "@/hooks/useScreeningDrafts";
import { useSubmissionSync } from "@/hooks/useSubmissionSync";
import ScreeningForm from "@/components/screening/ScreeningForm";
import DeviceQueue from "@/components/screening/DeviceQueue";
import ReviewDashboard, { ReviewDetails } from "@/components/screening/ReviewDashboard";
import { Badge } from "@/components/screening/shared";
import type { Submission } from "@/components/screening/types";


export default function Home() {
  const [tab, setTab] = useState("screening");
  const {
    ready,
    form,
    draftList,
    queueList,
    saveStatus,
    storageError,
    fields,
    busy,
    setStorageError,
    refreshDevice,
    change,
    newForm,
    resume,
    correct,
    submit: queueSubmission,
  } = useScreeningDrafts(() => setTab("screening"));
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
  const { online, syncing, sync } = useSubmissionSync({
    ready, refreshDevice, loadRecords, setStorageError,
  });
  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
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
      window.removeEventListener("beforeinstallprompt", installHandler);
      navigator.serviceWorker?.removeEventListener("message", swMessage);
    };
  }, []);
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
  async function submit(event: React.FormEvent) {
    if (await queueSubmission(event)) void sync();
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
