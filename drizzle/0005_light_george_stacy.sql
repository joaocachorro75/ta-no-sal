ALTER TABLE `establishments` MODIFY COLUMN `latitude` double;--> statement-breakpoint
ALTER TABLE `establishments` MODIFY COLUMN `longitude` double;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD `scheduledStartsAt` timestamp;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD `scheduledEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `payment_settings` ADD `dailyHighlightCapacity` int DEFAULT 5 NOT NULL;