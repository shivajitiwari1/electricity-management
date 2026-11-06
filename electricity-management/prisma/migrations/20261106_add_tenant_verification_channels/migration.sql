-- Tenant verification: let the admin choose how a tenant verifies (email / phone / both),
-- store the Fast2SMS API key used to deliver phone OTPs, and allow OTP sessions to cover
-- an email address as well as a phone number.

ALTER TABLE `SiteConfig`
    ADD COLUMN `tenantVerificationMethod` ENUM('EMAIL', 'PHONE', 'BOTH') NOT NULL DEFAULT 'PHONE',
    ADD COLUMN `fast2smsApiKey` VARCHAR(191) NULL;

ALTER TABLE `OtpSession`
    MODIFY COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `channel` ENUM('PHONE', 'EMAIL') NOT NULL DEFAULT 'PHONE',
    ADD COLUMN `email` VARCHAR(191) NULL;

CREATE INDEX `OtpSession_email_idx` ON `OtpSession`(`email`);
