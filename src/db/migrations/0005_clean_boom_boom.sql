CREATE TABLE `grammar_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`term` text NOT NULL,
	`summary` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_notes_term_unique` ON `grammar_notes` (`term`);