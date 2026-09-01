-- A bill whose unpaid balance was rolled into a later bill's previousDues is no
-- longer separately payable. It gets status CARRIED_FORWARD (so it drops out of
-- every pending/overdue/outstanding query) and a link to the bill that absorbed
-- it (so the link can be undone if that later bill is deleted).
ALTER TABLE `Bill` MODIFY `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'PARTIAL', 'CARRIED_FORWARD') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `Bill` ADD COLUMN `carriedForwardToId` VARCHAR(191) NULL;

CREATE INDEX `Bill_carriedForwardToId_idx` ON `Bill`(`carriedForwardToId`);

ALTER TABLE `Bill` ADD CONSTRAINT `Bill_carriedForwardToId_fkey` FOREIGN KEY (`carriedForwardToId`) REFERENCES `Bill`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
