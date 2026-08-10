CREATE TABLE `daily_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date_assigned` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_messages_date_assigned_unique` ON `daily_messages` (`date_assigned`);