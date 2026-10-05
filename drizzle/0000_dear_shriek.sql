CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`participant` text NOT NULL,
	`age` integer NOT NULL,
	`location` text NOT NULL,
	`worker` text NOT NULL,
	`date` text NOT NULL,
	`outcome` text NOT NULL,
	`notes` text NOT NULL,
	`consent` integer NOT NULL,
	`status` text DEFAULT 'Pending review' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`received_at` text NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_submissions_received_at` ON `submissions` (`received_at`);