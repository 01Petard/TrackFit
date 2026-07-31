CREATE TABLE `app_settings` (
	`id` int NOT NULL DEFAULT 1,
	`height_cm` decimal(5,2),
	`default_date_range` enum('24h','7d','30d','90d','all') NOT NULL DEFAULT '30d',
	`theme` enum('system','light','dark') NOT NULL DEFAULT 'system',
	`data_version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurement_session` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`measured_at` datetime NOT NULL,
	`height_cm_snapshot` decimal(5,2),
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measurement_session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurement_value` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`metric_id` bigint unsigned NOT NULL,
	`value` decimal(12,3) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measurement_value_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_measurement_value_session_metric` UNIQUE(`session_id`,`metric_id`)
);
--> statement-breakpoint
CREATE TABLE `metric_definition` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(40) NOT NULL,
	`unit` varchar(12) NOT NULL,
	`decimal_places` int NOT NULL DEFAULT 1,
	`minimum_value` decimal(12,3),
	`maximum_value` decimal(12,3),
	`metric_type` enum('core','custom') NOT NULL DEFAULT 'custom',
	`enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 100,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metric_definition_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_metric_definition_code` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `measurement_value` ADD CONSTRAINT `measurement_value_session_id_measurement_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `measurement_session`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `measurement_value` ADD CONSTRAINT `measurement_value_metric_id_metric_definition_id_fk` FOREIGN KEY (`metric_id`) REFERENCES `metric_definition`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_measurement_session_measured_id` ON `measurement_session` (`measured_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_measurement_value_metric_session` ON `measurement_value` (`metric_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `idx_metric_definition_enabled_sort` ON `metric_definition` (`enabled`,`sort_order`);--> statement-breakpoint
INSERT INTO `app_settings` (`id`, `default_date_range`, `theme`, `data_version`)
VALUES (1, '30d', 'system', 1);--> statement-breakpoint
INSERT INTO `metric_definition`
  (`code`, `name`, `unit`, `decimal_places`, `minimum_value`, `maximum_value`, `metric_type`, `enabled`, `sort_order`)
VALUES
  ('weight', '体重', 'kg', 2, 20, 400, 'core', true, 10),
  ('body_fat', '体脂率', '%', 1, 1, 75, 'core', true, 20),
  ('waist', '腰围', 'cm', 1, 30, 300, 'core', true, 30),
  ('hip', '臀围', 'cm', 1, 30, 300, 'core', true, 40),
  ('chest', '胸围', 'cm', 1, 30, 300, 'core', true, 50),
  ('upper_arm', '上臂围', 'cm', 1, 10, 150, 'core', true, 60),
  ('thigh', '大腿围', 'cm', 1, 10, 200, 'core', true, 70),
  ('calf', '小腿围', 'cm', 1, 10, 150, 'core', true, 80);
