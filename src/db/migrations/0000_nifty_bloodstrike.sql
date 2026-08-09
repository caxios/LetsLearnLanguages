CREATE TABLE `daily_sentences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`korean_text` text NOT NULL,
	`difficulty` text NOT NULL,
	`date_assigned` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_input_id` integer NOT NULL,
	`naturalness_score` integer NOT NULL,
	`grammar_score` integer NOT NULL,
	`meaning_clarity_score` integer NOT NULL,
	`overall_score` integer NOT NULL,
	`feedback` text NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_input_id`) REFERENCES `user_inputs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evaluation_id` integer NOT NULL,
	`sentence` text NOT NULL,
	`context_and_nuance` text NOT NULL,
	`grammar_explanation` text NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evaluation_id` integer NOT NULL,
	`korean_text` text NOT NULL,
	`best_english` text NOT NULL,
	`ease_factor` real DEFAULT 2.5 NOT NULL,
	`interval_days` integer DEFAULT 1 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`next_review_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_inputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`korean_text` text NOT NULL,
	`english_input` text NOT NULL,
	`input_method` text NOT NULL,
	`audio_uri` text,
	`daily_sentence_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`daily_sentence_id`) REFERENCES `daily_sentences`(`id`) ON UPDATE no action ON DELETE no action
);
