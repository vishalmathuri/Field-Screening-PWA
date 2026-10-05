import type { Screening } from "@/lib/screening.mjs";

export type Submission = Screening & {
  status: string;
  review_note: string;
  received_at: string;
  reviewed_at: string | null;
};
