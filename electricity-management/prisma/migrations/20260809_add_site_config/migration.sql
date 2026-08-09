-- CreateTable SiteConfig
CREATE TABLE `SiteConfig` (
    `id` VARCHAR(191) NOT NULL,
    `maintenanceMode` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
