CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_entry_created` ON `comments` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_author_created` ON `comments` (`author_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`scene` text DEFAULT 'wine' NOT NULL,
	`note` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'finish' NOT NULL,
	`conversation` text DEFAULT '[]' NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_entries_owner_created` ON `entries` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_entries_visibility_created` ON `entries` (`visibility`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`name` text DEFAULT '마음에 머무는 사람' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_subject_unique` ON `profiles` (`subject`);