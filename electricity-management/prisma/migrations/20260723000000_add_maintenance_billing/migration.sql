-- CreateTable
CREATE TABLE `MaintenanceRate` (
    `id` VARCHAR(191) NOT NULL,
    `ratePerSqFt` DECIMAL(10, 2) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceBill` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `maintenanceRateId` VARCHAR(191) NOT NULL,
    `billNumber` VARCHAR(191) NOT NULL,
    `billDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `billingPeriodStart` DATETIME(3) NOT NULL,
    `billingPeriodEnd` DATETIME(3) NOT NULL,
    `unitArea` INTEGER NOT NULL,
    `ratePerSqFt` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `paidAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `interestCharge` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MaintenanceBill_billNumber_key`(`billNumber`),
    INDEX `MaintenanceBill_connectionId_fkey`(`connectionId`),
    INDEX `MaintenanceBill_maintenanceRateId_fkey`(`maintenanceRateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenancePayment` (
    `id` VARCHAR(191) NOT NULL,
    `maintenanceBillId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `method` ENUM('ONLINE', 'CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE') NOT NULL,
    `razorpayOrderId` VARCHAR(191) NULL,
    `razorpayPaymentId` VARCHAR(191) NULL,
    `razorpaySignature` VARCHAR(191) NULL,
    `status` ENUM('INITIATED', 'SUCCESS', 'FAILED') NOT NULL,
    `receiptNumber` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MaintenancePayment_receiptNumber_key`(`receiptNumber`),
    INDEX `MaintenancePayment_maintenanceBillId_fkey`(`maintenanceBillId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MaintenanceBill` ADD CONSTRAINT `MaintenanceBill_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `Connection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceBill` ADD CONSTRAINT `MaintenanceBill_maintenanceRateId_fkey` FOREIGN KEY (`maintenanceRateId`) REFERENCES `MaintenanceRate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenancePayment` ADD CONSTRAINT `MaintenancePayment_maintenanceBillId_fkey` FOREIGN KEY (`maintenanceBillId`) REFERENCES `MaintenanceBill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
