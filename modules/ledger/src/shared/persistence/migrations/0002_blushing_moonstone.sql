CREATE TABLE `transaction_revision` (
	`transactionId` text NOT NULL,
	`effectiveFrom` text NOT NULL,
	`description` text NOT NULL,
	`categoryId` text,
	`accountId` text,
	`type` text NOT NULL,
	`amount` text NOT NULL,
	PRIMARY KEY(`transactionId`, `effectiveFrom`),
	FOREIGN KEY (`transactionId`) REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `transaction_settlement` (
	`transactionId` text NOT NULL,
	`occurrenceDate` text NOT NULL,
	`description` text NOT NULL,
	`categoryId` text,
	`accountId` text,
	`type` text NOT NULL,
	`amount` text NOT NULL,
	`settledAt` integer NOT NULL,
	PRIMARY KEY(`transactionId`, `occurrenceDate`),
	FOREIGN KEY (`transactionId`) REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`startDate` text NOT NULL,
	`frequency` text,
	`instalmentStartNumber` integer,
	`instalmentTotal` integer,
	`stopDate` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transaction_userId_idx` ON `transaction` (`userId`);