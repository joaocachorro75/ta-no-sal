CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(96) NOT NULL,
	`slug` varchar(112) NOT NULL,
	`icon` varchar(48) NOT NULL DEFAULT 'Store',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `commercial_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` enum('basico','dia','semana','mes') NOT NULL,
	`label` varchar(32) NOT NULL,
	`priceCents` int NOT NULL DEFAULT 0,
	`durationDays` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commercial_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `commercial_plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `establishment_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`establishmentId` int NOT NULL,
	`imageUrl` varchar(1024) NOT NULL,
	`altText` varchar(180),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `establishment_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `establishments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`streetAddress` varchar(255),
	`neighborhood` varchar(120),
	`city` varchar(120) NOT NULL DEFAULT 'Salinópolis',
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`isDeliveryOnly` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `establishments_id` PRIMARY KEY(`id`),
	CONSTRAINT `establishments_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `featured_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`establishmentId` int NOT NULL,
	`planId` int NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `featured_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`establishmentId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('pendente','pago','atrasado','cancelado') NOT NULL DEFAULT 'pendente',
	`amountCents` int NOT NULL,
	`dueAt` timestamp NOT NULL,
	`paidAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `establishment_images` ADD CONSTRAINT `establishment_images_establishmentId_establishments_id_fk` FOREIGN KEY (`establishmentId`) REFERENCES `establishments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `establishments` ADD CONSTRAINT `establishments_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `featured_slots` ADD CONSTRAINT `featured_slots_establishmentId_establishments_id_fk` FOREIGN KEY (`establishmentId`) REFERENCES `establishments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `featured_slots` ADD CONSTRAINT `featured_slots_planId_commercial_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `commercial_plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_establishmentId_establishments_id_fk` FOREIGN KEY (`establishmentId`) REFERENCES `establishments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_commercial_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `commercial_plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `establishment_images_establishment_idx` ON `establishment_images` (`establishmentId`);--> statement-breakpoint
CREATE INDEX `establishments_category_idx` ON `establishments` (`categoryId`);--> statement-breakpoint
CREATE INDEX `establishments_active_idx` ON `establishments` (`isActive`);--> statement-breakpoint
CREATE INDEX `featured_slots_active_window_idx` ON `featured_slots` (`isActive`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `subscriptions_establishment_idx` ON `subscriptions` (`establishmentId`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);