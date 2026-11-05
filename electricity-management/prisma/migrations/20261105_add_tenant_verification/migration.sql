-- CreateTable
CREATE TABLE `TenantApplication` (
    `id` VARCHAR(191) NOT NULL,
    `applicationNumber` VARCHAR(191) NOT NULL,
    `residentId` VARCHAR(191) NULL,
    `connectionId` VARCHAR(191) NULL,
    `tenantName` VARCHAR(191) NOT NULL,
    `tenantPhone` VARCHAR(191) NOT NULL,
    `tenantEmail` VARCHAR(191) NULL,
    `tenantIdProof` VARCHAR(191) NULL,
    `moveInDate` DATETIME(3) NULL,
    `moveOutDate` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'DOCUMENTS_SUBMITTED', 'OWNER_APPROVED', 'OWNER_REJECTED', 'POLICE_VERIFICATION_PENDING', 'POLICE_VERIFIED', 'POLICE_VERIFICATION_FAILED', 'MANAGEMENT_APPROVED', 'MANAGEMENT_REJECTED', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'PENDING',
    `ownerApprovedAt` DATETIME(3) NULL,
    `ownerApprovedBy` VARCHAR(191) NULL,
    `managementApprovedAt` DATETIME(3) NULL,
    `managementApprovedBy` VARCHAR(191) NULL,
    `policeVerifiedAt` DATETIME(3) NULL,
    `policeVerificationRef` VARCHAR(191) NULL,
    `applicationToken` VARCHAR(191) NOT NULL,
    `otpExpiresAt` DATETIME(3) NULL,
    `otpVerified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TenantApplication_applicationNumber_key`(`applicationNumber`),
    UNIQUE INDEX `TenantApplication_applicationToken_key`(`applicationToken`),
    INDEX `TenantApplication_status_idx`(`status`),
    INDEX `TenantApplication_connectionId_idx`(`connectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantDocument` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('ID_PROOF', 'ADDRESS_PROOF', 'RENT_AGREEMENT', 'NOC', 'PHOTO', 'OTHER') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedBy` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `uploadedBy` VARCHAR(191) NULL,

    INDEX `TenantDocument_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantFamilyMember` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(191) NOT NULL,
    `age` INTEGER NULL,
    `idProof` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TenantFamilyMember_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantApplicationAudit` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('PENDING', 'DOCUMENTS_SUBMITTED', 'OWNER_APPROVED', 'OWNER_REJECTED', 'POLICE_VERIFICATION_PENDING', 'POLICE_VERIFIED', 'POLICE_VERIFICATION_FAILED', 'MANAGEMENT_APPROVED', 'MANAGEMENT_REJECTED', 'ACTIVE', 'INACTIVE') NULL,
    `toStatus` ENUM('PENDING', 'DOCUMENTS_SUBMITTED', 'OWNER_APPROVED', 'OWNER_REJECTED', 'POLICE_VERIFICATION_PENDING', 'POLICE_VERIFIED', 'POLICE_VERIFICATION_FAILED', 'MANAGEMENT_APPROVED', 'MANAGEMENT_REJECTED', 'ACTIVE', 'INACTIVE') NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TenantApplicationAudit_applicationId_idx`(`applicationId`),
    INDEX `TenantApplicationAudit_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add the Tenant Verification module flag separately so existing production SiteConfig keeps working.
ALTER TABLE `SiteConfig` ADD COLUMN `tenantVerificationEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `TenantApplication` ADD CONSTRAINT `TenantApplication_residentId_fkey` FOREIGN KEY (`residentId`) REFERENCES `Resident`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantApplication` ADD CONSTRAINT `TenantApplication_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `Connection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantDocument` ADD CONSTRAINT `TenantDocument_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `TenantApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantFamilyMember` ADD CONSTRAINT `TenantFamilyMember_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `TenantApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantApplicationAudit` ADD CONSTRAINT `TenantApplicationAudit_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `TenantApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantApplicationAudit` ADD CONSTRAINT `TenantApplicationAudit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
