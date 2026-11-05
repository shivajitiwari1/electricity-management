-- CreateTable
CREATE TABLE `TenantVehicle` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `vehicleType` VARCHAR(191) NULL,
    `registrationNo` VARCHAR(191) NULL,
    `stickerRfidNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TenantVehicle_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantNotificationLog` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `template` VARCHAR(191) NOT NULL,
    `recipientReference` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `errorCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TenantNotificationLog_applicationId_idx`(`applicationId`),
    INDEX `TenantNotificationLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TenantVehicle` ADD CONSTRAINT `TenantVehicle_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `TenantApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantNotificationLog` ADD CONSTRAINT `TenantNotificationLog_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `TenantApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;