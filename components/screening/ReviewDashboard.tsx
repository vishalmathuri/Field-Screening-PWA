"use client";

import {
  RefreshCw,
  ClipboardList,
  Clock,
  ShieldCheck,
  AlertCircle,
  Check,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { reviewStatuses } from "@/lib/screening.mjs";
import { Badge, Choice, NoItems, displayTime } from "./shared";
import type { Submission } from "./types";

type ReviewDashboardProps = {
  records: Submission[];
  filter: string;
  loading: boolean;
  online: boolean;
  apiError: string;
  setFilter: (value: string) => void;
  loadRecords: () => Promise<void>;
  openReview: (record: Submission) => void;
};


export default function ReviewDashboard({
  records,
  filter,
  loading,
  online,
  apiError,
  setFilter,
  loadRecords,
  openReview,
}: ReviewDashboardProps) {
  const pending = records.filter(record => record.status === "Pending review");
  const visible = records.filter(record => filter === "All statuses" || record.status === filter);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REVIEW SUBMISSIONS</p>
          <h1>Review dashboard</h1>
          <p>Screening records received by the server.</p>
        </div>
        <button
          className="button secondary"
          disabled={loading || !online}
          onClick={() => void loadRecords()}
        >
          <RefreshCw size={17} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>
      <div className="stat-grid">
        <article>
          <ClipboardList />
          <strong>{records.length}</strong>
          <span>Loaded submissions</span>
        </article>
        <article>
          <Clock />
          <strong>{pending.length}</strong>
          <span>Pending review</span>
        </article>
        <article>
          <ShieldCheck />
          <strong>
            {records.filter((x) => x.status === "Needs follow-up").length}
          </strong>
          <span>Needs follow-up</span>
        </article>
      </div>
      {apiError && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          {apiError}
          <button onClick={() => void loadRecords()}>Retry</button>
        </div>
      )}
      <section className="list-card">
        <div className="card-header">
          <h2>Submissions</h2>
          <Choice
            label="Filter review status"
            value={filter}
            onChange={setFilter}
            options={["All statuses", ...reviewStatuses]}
          />
        </div>
        {loading ? (
          <div className="loading-rows">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : !visible.length ? (
          <NoItems
            title={
              records.length
                ? "No matching submissions"
                : "No submissions yet"
            }
            description={
              records.length
                ? "Choose a different review status."
                : "Submit a screening and sync it to begin reviewing."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <strong>{r.participant}</strong>
                    <span className="table-meta">
                      {r.worker} · Age {r.age}
                    </span>
                  </TableCell>
                  <TableCell>{r.location}</TableCell>
                  <TableCell>{r.outcome}</TableCell>
                  <TableCell className="nowrap">
                    {displayTime(r.received_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      kind={
                        r.status === "Reviewed"
                          ? "good"
                          : r.status === "Needs follow-up"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      className="button secondary small"
                      onClick={() => openReview(r)}
                    >
                      Review
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="list-footer">
          {visible.length} shown · Most recent 500 submissions ·{" "}
          {online
            ? "Live server records"
            : "Reconnect to refresh or save reviews"}
        </div>
      </section>
    </>
  );
}

// Kept outside the tab so closing or switching views does not reset the review panel.
type ReviewDetailsProps = {
  selected: Submission | null;
  reviewStatus: string;
  reviewNote: string;
  reviewBusy: boolean;
  reviewError: string;
  online: boolean;
  setSelected: (record: Submission | null) => void;
  setReviewStatus: (value: string) => void;
  setReviewNote: (value: string) => void;
  saveReview: () => Promise<void>;
};


export function ReviewDetails({
  selected,
  reviewStatus,
  reviewNote,
  reviewBusy,
  reviewError,
  online,
  setSelected,
  setReviewStatus,
  setReviewNote,
  saveReview,
}: ReviewDetailsProps) {
  return (
    <Sheet
      open={!!selected}
      onOpenChange={(v) => {
        if (!v && !reviewBusy) setSelected(null);
      }}
    >
      <SheetContent className="review-sheet">
        <SheetHeader>
          <p className="eyebrow">SCREENING DETAILS</p>
          <SheetTitle>{selected?.participant}</SheetTitle>
          <SheetDescription>
            Review this submission and record the next step.
          </SheetDescription>
        </SheetHeader>
        {selected && (
          <div className="review-body">
            <Badge kind={selected.status === "Reviewed" ? "good" : "neutral"}>
              {selected.status}
            </Badge>
            <dl>
              <dt>Location</dt>
              <dd>{selected.location}</dd>
              <dt>Age / field worker</dt>
              <dd>
                {selected.age} years · {selected.worker}
              </dd>
              <dt>Screening date</dt>
              <dd>{selected.date}</dd>
              <dt>Outcome</dt>
              <dd>{selected.outcome}</dd>
              <dt>Field notes</dt>
              <dd className="preserve">
                {selected.notes || "No notes added"}
              </dd>
              <dt>Consent</dt>
              <dd>Confirmed at submission</dd>
              <dt>Received</dt>
              <dd>{displayTime(selected.received_at)}</dd>
              {selected.reviewed_at && (
                <>
                  <dt>Last review update</dt>
                  <dd>{displayTime(selected.reviewed_at)}</dd>
                </>
              )}
            </dl>
            <div className="review-form">
              <h2>Review decision</h2>
              <label htmlFor="review-status">Status</label>
              <Choice
                id="review-status"
                label="Review status"
                options={reviewStatuses}
                value={reviewStatus}
                onChange={setReviewStatus}
              />
              <label htmlFor="review-note">Reviewer notes</label>
              <textarea
                id="review-note"
                className="control"
                rows={4}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                maxLength={1500}
                placeholder="Add context for the next step…"
              />
              {reviewError && (
                <p role="alert" className="field-error">
                  {reviewError}
                </p>
              )}
              <button
                className="button primary full"
                onClick={() => void saveReview()}
                disabled={!online || reviewBusy}
              >
                <Check size={17} />
                {reviewBusy ? "Saving…" : "Save review"}
              </button>
              {!online && (
                <p className="subtle">
                  Review changes need a connection. Your text stays open for
                  retry.
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
