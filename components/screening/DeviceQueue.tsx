"use client";

import { RefreshCw, FileText, CloudUpload, CheckCircle2, Check } from "lucide-react";
import type { QueueItem } from "@/lib/screening.mjs";
import type { Draft } from "@/lib/device";
import { Badge, NoItems, displayTime } from "./shared";

type DeviceQueueProps = {
  draftList: Draft[];
  queueList: QueueItem[];
  waiting: QueueItem[];
  synced: QueueItem[];
  online: boolean;
  syncing: boolean;
  storageError: string;
  busy: boolean;
  sync: () => Promise<void>;
  resume: (draft: Draft) => Promise<void>;
  correct: (item: QueueItem) => Promise<void>;
};


export default function DeviceQueue({
  draftList,
  queueList,
  waiting,
  synced,
  online,
  syncing,
  storageError,
  busy,
  sync,
  resume,
  correct,
}: DeviceQueueProps) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LOCAL RECORDS</p>
          <h1>Device queue</h1>
          <p>Drafts and submissions saved in this browser.</p>
        </div>
        <button
          className="button primary"
          onClick={() => void sync()}
          disabled={!online || syncing || !waiting.length}
        >
          <RefreshCw size={17} className={syncing ? "spin" : ""} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
      <div className="stat-grid">
        <article>
          <FileText />
          <strong>{draftList.length}</strong>
          <span>Saved drafts</span>
        </article>
        <article>
          <CloudUpload />
          <strong>{waiting.length}</strong>
          <span>Waiting for sync</span>
        </article>
        <article>
          <CheckCircle2 />
          <strong>{synced.length}</strong>
          <span>Server confirmed</span>
        </article>
      </div>
      <section className="list-card">
        <div className="card-header">
          <h2>Saved drafts</h2>
          <span className="subtle">Incomplete records</span>
        </div>
        {!draftList.length ? (
          <NoItems
            title="No saved drafts"
            description="Start a screening. Your changes will save here automatically."
          />
        ) : (
          draftList.map((d) => (
            <div className="queue-row" key={d.id}>
              <div className="record-icon">
                <FileText />
              </div>
              <div className="record-copy">
                <strong>
                  {d.record.participant || "Untitled screening"}
                </strong>
                <p>
                  {d.record.location || "Location not entered"} ·{" "}
                  {displayTime(d.updatedAt)}
                </p>
              </div>
              <button
                className="button secondary"
                disabled={!!storageError || busy}
                onClick={() => void resume(d)}
              >
                Continue
              </button>
            </div>
          ))
        )}
      </section>
      <section className="list-card">
        <div className="card-header">
          <h2>Submitted from this device</h2>
          <span className="subtle">Device copies retained</span>
        </div>
        {!queueList.length ? (
          <NoItems
            title="Your queue is empty"
            description="Completed screenings appear here when you submit them."
          />
        ) : (
          queueList.map((q) => (
            <div className="queue-row" key={q.id}>
              <div className="record-icon">
                {q.state === "synced" ? <Check /> : <CloudUpload />}
              </div>
              <div className="record-copy">
                <strong>{q.record.participant}</strong>
                <p>
                  {q.record.location} · {q.record.date}
                </p>
                {q.error && <p className="field-error">{q.error}</p>}
              </div>
              <Badge
                kind={
                  q.state === "synced"
                    ? "good"
                    : q.state === "blocked"
                      ? "danger"
                      : "warning"
                }
              >
                {q.state === "synced"
                  ? "Synced"
                  : q.state === "blocked"
                    ? "Needs correction"
                    : q.state === "retry"
                      ? "Retry needed"
                      : "Waiting to sync"}
              </Badge>
              {q.state === "blocked" && (
                <button
                  className="button secondary"
                  onClick={() => void correct(q)}
                >
                  Correct record
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}
