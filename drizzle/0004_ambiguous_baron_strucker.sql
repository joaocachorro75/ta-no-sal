CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`establishmentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `favorites_user_establishment_unique` UNIQUE(`userId`,`establishmentId`)
);
--> statement-breakpoint
CREATE TABLE `payment_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`establishmentId` int NOT NULL,
	`requestedByUserId` int NOT NULL,
	`planId` int NOT NULL,
	`purpose` enum('assinatura','destaque') NOT NULL,
	`status` enum('aguardando_pagamento','em_analise','confirmado','recusado','cancelado') NOT NULL DEFAULT 'aguardando_pagamento',
	`amountCents` int NOT NULL,
	`pixProofUrl` varchar(1024),
	`ownerNote` text,
	`adminNote` text,
	`confirmedByUserId` int,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_settings` (
	`id` int NOT NULL,
	`pixKey` varchar(255),
	`recipientName` varchar(160),
	`instructions` text,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','owner','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `establishments` ADD `ownerId` int;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `confirmedByUserId` int;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_establishmentId_establishments_id_fk` FOREIGN KEY (`establishmentId`) REFERENCES `establishments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_establishmentId_establishments_id_fk` FOREIGN KEY (`establishmentId`) REFERENCES `establishments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_planId_commercial_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `commercial_plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_confirmedByUserId_users_id_fk` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_settings` ADD CONSTRAINT `payment_settings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `favorites_user_idx` ON `favorites` (`userId`);--> statement-breakpoint
CREATE INDEX `favorites_establishment_idx` ON `favorites` (`establishmentId`);--> statement-breakpoint
CREATE INDEX `payment_requests_establishment_idx` ON `payment_requests` (`establishmentId`);--> statement-breakpoint
CREATE INDEX `payment_requests_requester_idx` ON `payment_requests` (`requestedByUserId`);--> statement-breakpoint
CREATE INDEX `payment_requests_status_idx` ON `payment_requests` (`status`);--> statement-breakpoint
ALTER TABLE `establishments` ADD CONSTRAINT `establishments_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_confirmedByUserId_users_id_fk` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `establishments_owner_idx` ON `establishments` (`ownerId`);