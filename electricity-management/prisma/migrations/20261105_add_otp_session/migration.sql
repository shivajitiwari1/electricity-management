-- CreateTable
CREATE TABLE `OtpSession` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `purpose` ENUM('APPLICATION_REGISTRATION', 'APPLICATION_LOGIN') NOT NULL DEFAULT 'APPLICATION_REGISTRATION',
    `otpHash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `expiresAt` DATETIME(3) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpSession_phone_idx`(`phone`),
    INDEX `OtpSession_expiresAt_idx`(`expiresAt`),
    INDEX `OtpSession_verified_idx`(`verified`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;