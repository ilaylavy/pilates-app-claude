-- Add new enum values for two-step approval process

-- Add new PaymentStatus enum values
ALTER TYPE userpackagepaymentstatus ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE userpackagepaymentstatus ADD VALUE IF NOT EXISTS 'payment_confirmed';

-- Add new ApprovalStatus enum values  
ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'payment_confirmed';

-- Recreate the dropped indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_packages_approval_status ON user_packages (approval_status);
CREATE INDEX IF NOT EXISTS idx_user_packages_payment_status_approval ON user_packages (payment_status, approval_status);
CREATE INDEX IF NOT EXISTS idx_user_packages_approval_deadline ON user_packages (approval_deadline);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_ip_address ON payment_approvals (ip_address);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_bulk_operation ON payment_approvals (bulk_operation_id);