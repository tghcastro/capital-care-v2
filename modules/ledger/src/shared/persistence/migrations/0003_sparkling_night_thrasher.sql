-- CAP-8 child categories (AD-012): existing categories are test data and are deleted.
-- Transactions, revisions and settlements are kept with no category. The category is cleared
-- explicitly, so it does not depend on foreign_keys being on while this runs.
UPDATE `transaction_revision` SET `categoryId` = NULL WHERE `categoryId` IS NOT NULL;--> statement-breakpoint
UPDATE `transaction_settlement` SET `categoryId` = NULL WHERE `categoryId` IS NOT NULL;--> statement-breakpoint
DELETE FROM `category`;--> statement-breakpoint
DROP INDEX `category_userId_name_unique`;--> statement-breakpoint
CREATE TABLE `__new_category` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`parentId` text,
	`name` text NOT NULL,
	`nameKey` text NOT NULL,
	`description` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
DROP TABLE `category`;--> statement-breakpoint
ALTER TABLE `__new_category` RENAME TO `category`;--> statement-breakpoint
CREATE UNIQUE INDEX `category_userId_nameKey_unique` ON `category` (`userId`,`nameKey`);
