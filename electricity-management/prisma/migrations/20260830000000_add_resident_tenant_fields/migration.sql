-- Optional tenant details on a resident. Nullable and with no default, so
-- existing rows are untouched and every current read/write keeps working.
ALTER TABLE `Resident` ADD COLUMN `tenantName` VARCHAR(191) NULL;
ALTER TABLE `Resident` ADD COLUMN `tenantPhone` VARCHAR(191) NULL;
