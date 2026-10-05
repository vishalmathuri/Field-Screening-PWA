"use client";

import type { FormEvent } from "react";
import {
  Plus,
  FileText,
  Save,
  ShieldCheck,
  CloudUpload,
  RefreshCw,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { outcomes, type Screening, type QueueItem } from "@/lib/screening.mjs";
import type { Draft } from "@/lib/device";
import { Badge, Choice, displayTime, today } from "./shared";

type ScreeningFormProps = {
  form: Screening | null;
  fields: Record<string, string>;
  saveStatus: string;
  ready: boolean;
  busy: boolean;
  storageError: string;
  online: boolean;
  syncing: boolean;
  offlineReady: boolean;
  draftList: Draft[];
  waiting: QueueItem[];
  synced: QueueItem[];
  change: (field: keyof Screening, value: string | boolean) => void;
  submit: (event: FormEvent) => Promise<void>;
  newForm: () => Promise<void>;
  resume: (draft: Draft) => Promise<void>;
  sync: () => Promise<void>;
};


export default function ScreeningForm({
  form,
  fields,
  saveStatus,
  ready,
  busy,
  storageError,
  online,
  syncing,
  offlineReady,
  draftList,
  waiting,
  synced,
  change,
  submit,
  newForm,
  resume,
  sync,
}: ScreeningFormProps) {
  const requiredKeys = [
    "participant",
    "age",
    "location",
    "worker",
    "date",
    "outcome",
    "consent",
  ] as const;
  const progress = form
    ? requiredKeys.filter((k) =>
      k === "consent" ? form[k] : String(form[k]).trim() !== "",
    ).length
    : 0;
  const input = (
    key: keyof Screening,
    label: string,
    placeholder: string,
    type = "text",
  ) => (
    <div className="field">
      <label htmlFor={key}>
        {label}
        <span> *</span>
      </label>
      <input
        id={key}
        className="control"
        type={type}
        value={String(form?.[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) => change(key, e.target.value)}
        maxLength={key === "participant" ? 40 : key === "worker" ? 80 : 100}
        min={type === "number" ? 0 : undefined}
        max={key === "age" ? 120 : key === "date" ? today() : undefined}
        aria-invalid={!!fields[key]}
        aria-describedby={fields[key] ? `${key}-error` : undefined}
      />
      {fields[key] && (
        <p className="field-error" id={`${key}-error`}>
          {fields[key]}
        </p>
      )}
    </div>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COLLECT IN THE FIELD</p>
          <h1>New screening</h1>
          <p>Capture a record. Your work stays with you, even offline.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => void newForm()}
          disabled={!ready || busy || !!storageError}
        >
          <Plus size={17} />
          New record
        </button>
      </div>
      <div className="form-layout">
        <section className="form-card">
          <div className="card-header">
            <span className="card-title">
              <FileText size={19} />
              Screening record
            </span>
            <span className="save-label" aria-live="polite">
              <Save size={14} />
              {saveStatus}
            </span>
          </div>
          {!form ? (
            <div className="form-body">
              <Skeleton className="h-12 mb-4" />
              <Skeleton className="h-48" />
            </div>
          ) : (
            <form noValidate onSubmit={submit}>
              <div className="form-body">
                <div className="section-title">
                  <span>01</span>
                  <div>
                    <h2>Participant & visit</h2>
                    <p>
                      Use a participant code, without personal
                      identifiers.
                    </p>
                  </div>
                </div>
                <div className="field-grid">
                  {input(
                    "participant",
                    "Participant code",
                    "e.g. DEMO-001",
                  )}
                  {input("age", "Age in years", "e.g. 32", "number")}
                  {input(
                    "location",
                    "Village / screening location",
                    "e.g. Community Centre, Ward 4",
                  )}
                  {input("worker", "Field worker code", "e.g. FW-01")}
                  {input("date", "Screening date", "", "date")}
                </div>
                <div className="section-title second">
                  <span>02</span>
                  <div>
                    <h2>Screening result</h2>
                    <p>Record the observed outcome and any next steps.</p>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="outcome">
                    Outcome<span> *</span>
                  </label>
                  <Choice
                    id="outcome"
                    label="Select an outcome"
                    value={form.outcome}
                    options={outcomes}
                    onChange={(v) => change("outcome", v)}
                  />
                  {fields.outcome && (
                    <p className="field-error">{fields.outcome}</p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="notes">
                    Field notes <small>Optional</small>
                  </label>
                  <textarea
                    id="notes"
                    className="control"
                    rows={4}
                    maxLength={1500}
                    value={form.notes}
                    placeholder="Relevant observations or follow-up information…"
                    onChange={(e) => change("notes", e.target.value)}
                  />
                  <span className="text-counter">
                    {form.notes.length} / 1,500
                  </span>
                </div>
                <div className="consent">
                  <Checkbox
                    id="consent"
                    checked={form.consent}
                    onCheckedChange={(v) => change("consent", v === true)}
                  />
                  <label htmlFor="consent">
                    The participant agreed to this screening and
                    collection of this record.
                  </label>
                </div>
                {fields.consent && (
                  <p className="field-error">{fields.consent}</p>
                )}
              </div>
              <div className="form-footer">
                <span>
                  <ShieldCheck size={16} />
                  Saved locally before sending
                </span>
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy || !ready || !!storageError}
                >
                  <CloudUpload size={18} />
                  {busy
                    ? "Queueing…"
                    : online
                      ? "Submit screening"
                      : "Queue screening"}
                </button>
              </div>
            </form>
          )}
        </section>
        <aside className="side-stack">
          <section className="session-card">
            <p className="eyebrow">ON THIS DEVICE</p>
            <div className="device-metrics">
              <div>
                <strong>{draftList.length}</strong>
                <span>Drafts</span>
              </div>
              <div>
                <strong>{waiting.length}</strong>
                <span>To sync</span>
              </div>
              <div>
                <strong>{synced.length}</strong>
                <span>Synced</span>
              </div>
            </div>
            <div className="status-line">
              <span
                className={
                  online ? "connection-dot" : "connection-dot offline"
                }
              />
              {syncing
                ? "Sending records…"
                : waiting.length
                  ? `${waiting.length} record${waiting.length === 1 ? "" : "s"} waiting to sync`
                  : "Queue is up to date"}
            </div>
            <button
              className="button secondary full"
              onClick={() => void sync()}
              disabled={!online || syncing || !waiting.length}
            >
              <RefreshCw size={16} className={syncing ? "spin" : ""} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </section>
          <section className="help-card">
            <div className="help-icon">
              <Smartphone size={23} />
            </div>
            <h2>Ready for the field</h2>
            <p>
              Drafts save as you type. Submitted records stay on this
              device until the server confirms receipt.
            </p>
            <div className="offline-ready">
              <CheckCircle2 size={16} />
              {offlineReady
                ? "App available offline"
                : "Offline access prepares after first online load"}
            </div>
            <p className="subtle">
              Keep this browser’s data to retain unsynced work.
            </p>
          </section>
          {draftList.length > 0 && (
            <section className="draft-card">
              <h2>Continue a draft</h2>
              {draftList.slice(0, 4).map((d) => (
                <button
                  key={d.id}
                  className="draft-row"
                  disabled={!!storageError || busy}
                  onClick={() => void resume(d)}
                >
                  <FileText size={18} />
                  <span>
                    <strong>
                      {d.record.participant || "Untitled screening"}
                    </strong>
                    <small>{displayTime(d.updatedAt)}</small>
                  </span>
                  {form?.id === d.id && <Badge>Open</Badge>}
                </button>
              ))}
            </section>
          )}
        </aside>
      </div>
      <div className="completion">
        <span>{progress} of 7 required fields complete</span>
        <div>
          <i style={{ width: `${(progress / 7) * 100}%` }} />
        </div>
      </div>
    </>
  );
}
