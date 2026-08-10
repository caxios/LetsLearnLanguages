PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_review_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`review_card_id` integer,
	`english_input` text NOT NULL,
	`naturalness_score` integer NOT NULL,
	`grammar_score` integer NOT NULL,
	`meaning_clarity_score` integer NOT NULL,
	`overall_score` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`review_card_id`) REFERENCES `review_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_review_attempts`("id", "review_card_id", "english_input", "naturalness_score", "grammar_score", "meaning_clarity_score", "overall_score", "created_at") SELECT "id", "review_card_id", "english_input", "naturalness_score", "grammar_score", "meaning_clarity_score", "overall_score", "created_at" FROM `review_attempts`;--> statement-breakpoint
DROP TABLE `review_attempts`;--> statement-breakpoint
ALTER TABLE `__new_review_attempts` RENAME TO `review_attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;