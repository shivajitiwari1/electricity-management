-- AlterTable User
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('ADMIN', 'MANAGER', 'RESIDENT') NOT NULL;
ALTER TABLE `User` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable Permission
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'RESIDENT') NOT NULL,
    `page` VARCHAR(191) NOT NULL,
    `canRead` BOOLEAN NOT NULL DEFAULT false,
    `canWrite` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Permission_role_page_key`(`role`, `page`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
