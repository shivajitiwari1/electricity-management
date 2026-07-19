-- CreateEnum
CREATE TYPE `ConnectionStatus` AS ENUM('ACTIVE', 'INACTIVE');
CREATE TYPE `BillStatus` AS ENUM('PENDING', 'PAID', 'OVERDUE', 'PARTIAL');
CREATE TYPE `PaymentMethod` AS ENUM('ONLINE', 'CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE');
CREATE TYPE `PaymentStatus` AS ENUM('INITIATED', 'SUCCESS', 'FAILED');
CREATE TYPE `User_role` AS ENUM('ADMIN', 'RESIDENT');

-- CreateTable User
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'RESIDENT') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Resident
CREATE TABLE `Resident` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `residentNumber` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Resident_userId_key`(`userId`),
    UNIQUE INDEX `Resident_residentNumber_key`(`residentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Connection
CREATE TABLE `Connection` (
    `id` VARCHAR(191) NOT NULL,
    `residentId` VARCHAR(191) NOT NULL,
    `tower` VARCHAR(191) NOT NULL,
    `floor` VARCHAR(191) NOT NULL,
    `flatNo` VARCHAR(191) NOT NULL,
    `unitType` VARCHAR(191) NOT NULL,
    `unitArea` INTEGER NOT NULL,
    `meterNo` VARCHAR(191),
    `sanctionedLoad` DECIMAL(65,30) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Connection_flatNo_key`(`flatNo`),
    INDEX `Connection_residentId_fkey`(`residentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Rate
CREATE TABLE `Rate` (
    `id` VARCHAR(191) NOT NULL,
    `ncplPerUnit` DECIMAL(65,30) NOT NULL,
    `dgFixed` DECIMAL(65,30) NOT NULL,
    `fixedPerKw` DECIMAL(65,30) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable MeterReading
CREATE TABLE `MeterReading` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `readingDate` DATETIME(3) NOT NULL,
    `ncplPrevious` DECIMAL(65,30) NOT NULL,
    `ncplCurrent` DECIMAL(65,30) NOT NULL,
    `ncplUnits` DECIMAL(65,30) NOT NULL,
    `dgPrevious` DECIMAL(65,30) NOT NULL DEFAULT 0,
    `dgCurrent` DECIMAL(65,30) NOT NULL DEFAULT 0,
    `dgUnits` DECIMAL(65,30) NOT NULL DEFAULT 0,
    `recordedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MeterReading_connectionId_key`(`connectionId`),
    INDEX `MeterReading_connectionId_fkey`(`connectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Bill
CREATE TABLE `Bill` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `meterReadingId` VARCHAR(191) NOT NULL,
    `billNumber` VARCHAR(191) NOT NULL,
    `billDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `billingPeriodStart` DATETIME(3) NOT NULL,
    `billingPeriodEnd` DATETIME(3) NOT NULL,
    `ncplUnits` DECIMAL(65,30) NOT NULL,
    `ratePerUnit` DECIMAL(65,30) NOT NULL,
    `ncplCharge` DECIMAL(65,30) NOT NULL,
    `dgCharge` DECIMAL(65,30) NOT NULL,
    `fixedCharge` DECIMAL(65,30) NOT NULL,
    `previousDues` DECIMAL(65,30) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(65,30) NOT NULL,
    `paidAmount` DECIMAL(65,30) NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Bill_meterReadingId_key`(`meterReadingId`),
    UNIQUE INDEX `Bill_billNumber_key`(`billNumber`),
    INDEX `Bill_connectionId_fkey`(`connectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Payment
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `billId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(65,30) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `method` ENUM('ONLINE', 'CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE') NOT NULL,
    `razorpayOrderId` VARCHAR(191),
    `razorpayPaymentId` VARCHAR(191),
    `razorpaySignature` VARCHAR(191),
    `status` ENUM('INITIATED', 'SUCCESS', 'FAILED') NOT NULL,
    `receiptNumber` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_receiptNumber_key`(`receiptNumber`),
    INDEX `Payment_billId_fkey`(`billId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable AuditLog
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `meta` JSON,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable FlatInfo
CREATE TABLE `FlatInfo` (
    `id` VARCHAR(191) NOT NULL,
    `flatNo` VARCHAR(191) NOT NULL,
    `tower` VARCHAR(191) NOT NULL,
    `floor` VARCHAR(191) NOT NULL,
    `unitType` VARCHAR(191) NOT NULL,
    `area` INTEGER NOT NULL,

    UNIQUE INDEX `FlatInfo_flatNo_key`(`flatNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Resident` ADD CONSTRAINT `Resident_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Connection` ADD CONSTRAINT `Connection_residentId_fkey` FOREIGN KEY (`residentId`) REFERENCES `Resident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeterReading` ADD CONSTRAINT `MeterReading_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `Connection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `Connection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_meterReadingId_fkey` FOREIGN KEY (`meterReadingId`) REFERENCES `MeterReading`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
