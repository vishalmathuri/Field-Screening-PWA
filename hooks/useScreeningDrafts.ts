"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { validateRecord, type Screening, type QueueItem } from "@/lib/screening.mjs";
import * as device from "@/lib/device";
import { today } from "@/components/screening/shared";

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

export function useScreeningDrafts(openForm: () => void) {
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<Screening | null>(null);
  const [draftList, setDraftList] = useState<device.Draft[]>([]);
  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [saveStatus, setSaveStatus] = useState("Not started");
  const [storageError, setStorageError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Draft writes run in order so rapid typing cannot overwrite a newer value.
  const saveChain = useRef(Promise.resolve());
  const current = useRef<Screening | null>(null);
  const refreshDevice = useCallback(async () => {
    const [d, q] = await Promise.all([device.drafts(), device.queue()]);
    setDraftList(d.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setQueueList(q);
  }, []);
  useEffect(() => {
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
      })
      .catch((e) => {
        if (!active) return;
        setStorageError(e.message);
        setReady(true);
        const f = blank();
        current.current = f;
        setForm(f);
      });
    return () => { active = false; };
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
    openForm();
  }
  async function resume(d: device.Draft) {
    await saveChain.current;
    current.current = d.record;
    setForm(d.record);
    setFields({});
    setSaveStatus("Saved on this device");
    openForm();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!current.current) return false;
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
      return true;
    } catch (e) {
      const err = e as Error & { fields?: Record<string, string> };
      if (err.fields) setFields(err.fields);
      toast.error(err.message);
      return false;
    } finally {
      setBusy(false);
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
  return {
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
    submit,
    correct,
  };
}
