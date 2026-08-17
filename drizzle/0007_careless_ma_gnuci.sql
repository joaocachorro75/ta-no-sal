CREATE TABLE `mural_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`muralPostId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`status` enum('pendente','aprovado','recusado') NOT NULL DEFAULT 'pendente',
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mural_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mural_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`muralPostId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mural_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `mural_likes_unique` UNIQUE(`muralPostId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `mural_post_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`muralPostId` int NOT NULL,
	`imageUrl` varchar(1024) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mural_post_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mural_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`caption` text NOT NULL,
	`allowsComments` boolean NOT NULL DEFAULT true,
	`latitude` double,
	`longitude` double,
	`locationLabel` varchar(180),
	`status` enum('pendente','aprovado','recusado') NOT NULL DEFAULT 'pendente',
	`adminNote` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mural_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `property_listing_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyListingId` int NOT NULL,
	`imageUrl` varchar(1024) NOT NULL,
	`altText` varchar(180),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `property_listing_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `property_listing_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` enum('semana','mes') NOT NULL,
	`label` varchar(48) NOT NULL,
	`priceCents` int NOT NULL DEFAULT 0,
	`durationDays` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `property_listing_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `property_listing_plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `property_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int,
	`title` varchar(180) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`listingType` enum('aluguel_fixo','temporada','venda') NOT NULL,
	`description` text NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`propertyPriceCents` int,
	`streetAddress` varchar(255),
	`neighborhood` varchar(120),
	`city` varchar(120) NOT NULL DEFAULT 'Salinópolis',
	`latitude` double,
	`longitude` double,
	`bedrooms` int,
	`bathrooms` int,
	`parkingSpaces` int,
	`status` enum('pendente_pagamento','em_analise','ativo','rejeitado','inativo') NOT NULL DEFAULT 'pendente_pagamento',
	`activeUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `property_listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `property_listings_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `property_payment_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyListingId` int NOT NULL,
	`requestedByUserId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('aguardando_pagamento','em_analise','confirmado','recusado','cancelado') NOT NULL DEFAULT 'aguardando_pagamento',
	`amountCents` int NOT NULL,
	`pixProofUrl` varchar(1024),
	`ownerNote` text,
	`adminNote` text,
	`confirmedByUserId` int,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `property_payment_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mural_comments` ADD CONSTRAINT `mural_comments_muralPostId_mural_posts_id_fk` FOREIGN KEY (`muralPostId`) REFERENCES `mural_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mural_comments` ADD CONSTRAINT `mural_comments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mural_comments` ADD CONSTRAINT `mural_comments_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mural_likes` ADD CONSTRAINT `mural_likes_muralPostId_mural_posts_id_fk` FOREIGN KEY (`muralPostId`) REFERENCES `mural_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mural_likes` ADD CONSTRAINT `mural_likes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mural_post_images` ADD CONSTRAINT `mural_post_images_muralPostId_mural_posts_id_fk` FOREIGN KEY (`muralPostId`) REFERENCES `mural_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mural_posts` ADD CONSTRAINT `mural_posts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mural_posts` ADD CONSTRAINT `mural_posts_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_listing_images` ADD CONSTRAINT `pli_listing_fk` FOREIGN KEY (`propertyListingId`) REFERENCES `property_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_listings` ADD CONSTRAINT `pl_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_listings` ADD CONSTRAINT `pl_plan_fk` FOREIGN KEY (`planId`) REFERENCES `property_listing_plans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_payment_requests` ADD CONSTRAINT `ppr_listing_fk` FOREIGN KEY (`propertyListingId`) REFERENCES `property_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_payment_requests` ADD CONSTRAINT `ppr_user_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_payment_requests` ADD CONSTRAINT `ppr_plan_fk` FOREIGN KEY (`planId`) REFERENCES `property_listing_plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_payment_requests` ADD CONSTRAINT `ppr_confirmer_fk` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mural_comments_post_idx` ON `mural_comments` (`muralPostId`);--> statement-breakpoint
CREATE INDEX `mural_comments_status_idx` ON `mural_comments` (`status`);--> statement-breakpoint
CREATE INDEX `mural_likes_post_idx` ON `mural_likes` (`muralPostId`);--> statement-breakpoint
CREATE INDEX `mural_post_images_post_idx` ON `mural_post_images` (`muralPostId`);--> statement-breakpoint
CREATE INDEX `mural_posts_user_idx` ON `mural_posts` (`userId`);--> statement-breakpoint
CREATE INDEX `mural_posts_status_idx` ON `mural_posts` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `property_listing_images_property_idx` ON `property_listing_images` (`propertyListingId`);--> statement-breakpoint
CREATE INDEX `property_listings_user_idx` ON `property_listings` (`userId`);--> statement-breakpoint
CREATE INDEX `property_listings_status_idx` ON `property_listings` (`status`);--> statement-breakpoint
CREATE INDEX `property_payment_requests_property_idx` ON `property_payment_requests` (`propertyListingId`);--> statement-breakpoint
CREATE INDEX `property_payment_requests_status_idx` ON `property_payment_requests` (`status`);
