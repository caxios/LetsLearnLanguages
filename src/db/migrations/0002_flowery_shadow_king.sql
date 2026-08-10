CREATE TABLE `app_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visit_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_visits_visit_date_unique` ON `app_visits` (`visit_date`);--> statement-breakpoint
CREATE TABLE `review_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`review_card_id` integer NOT NULL,
	`english_input` text NOT NULL,
	`naturalness_score` integer NOT NULL,
	`grammar_score` integer NOT NULL,
	`meaning_clarity_score` integer NOT NULL,
	`overall_score` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`review_card_id`) REFERENCES `review_cards`(`id`) ON UPDATE no action ON DELETE no action
);
