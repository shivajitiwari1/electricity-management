-- Add tower and flatNo columns to TenantApplication
ALTER TABLE `TenantApplication` ADD COLUMN `tower` VARCHAR(191) NULL;
ALTER TABLE `TenantApplication` ADD COLUMN `flatNo` VARCHAR(191) NULL;