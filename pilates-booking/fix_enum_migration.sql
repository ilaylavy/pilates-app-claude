-- Fix enum values to match the code
-- Add missing enum values to userpackagepaymentstatus

-- First, let's see what we currently have
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userpackagepaymentstatus') ORDER BY enumsortorder;

-- Add the missing enum values
ALTER TYPE userpackagepaymentstatus ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE userpackagepaymentstatus ADD VALUE IF NOT EXISTS 'payment_confirmed';

-- Check approvalstatus enum too
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'approvalstatus') ORDER BY enumsortorder;

-- Add missing values to approvalstatus enum if they don't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approvalstatus') THEN
        -- Add missing enum values if they don't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid WHERE pt.typname = 'approvalstatus' AND pe.enumlabel = 'authorized') THEN
            ALTER TYPE approvalstatus ADD VALUE 'authorized';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid WHERE pt.typname = 'approvalstatus' AND pe.enumlabel = 'payment_confirmed') THEN
            ALTER TYPE approvalstatus ADD VALUE 'payment_confirmed';
        END IF;
    ELSE
        -- Create the enum if it doesn't exist
        CREATE TYPE approvalstatus AS ENUM (
            'pending',
            'in_review', 
            'authorized',
            'payment_confirmed',
            'rejected',
            'expired'
        );
    END IF;
END$$;

-- Add approvalstatus column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_status') THEN
        ALTER TABLE user_packages ADD COLUMN approval_status approvalstatus DEFAULT 'pending' NOT NULL;
    END IF;
END$$;

-- Add other missing columns that the code expects
DO $$
BEGIN
    -- authorized_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'authorized_by') THEN
        ALTER TABLE user_packages ADD COLUMN authorized_by INTEGER REFERENCES users(id);
    END IF;
    
    -- authorized_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'authorized_at') THEN
        ALTER TABLE user_packages ADD COLUMN authorized_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- payment_confirmed_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmed_by') THEN
        ALTER TABLE user_packages ADD COLUMN payment_confirmed_by INTEGER REFERENCES users(id);
    END IF;
    
    -- payment_confirmed_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmed_at') THEN
        ALTER TABLE user_packages ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- payment_confirmation_reference column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmation_reference') THEN
        ALTER TABLE user_packages ADD COLUMN payment_confirmation_reference VARCHAR;
    END IF;
    
    -- version column (for optimistic locking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'version') THEN
        ALTER TABLE user_packages ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
    END IF;
    
    -- approval_deadline column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_deadline') THEN
        ALTER TABLE user_packages ADD COLUMN approval_deadline TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- idempotency_key column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'idempotency_key') THEN
        ALTER TABLE user_packages ADD COLUMN idempotency_key VARCHAR UNIQUE;
    END IF;
    
    -- last_approval_attempt_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'last_approval_attempt_at') THEN
        ALTER TABLE user_packages ADD COLUMN last_approval_attempt_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- approval_attempt_count column  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_attempt_count') THEN
        ALTER TABLE user_packages ADD COLUMN approval_attempt_count INTEGER DEFAULT 0 NOT NULL;
    END IF;
END$$;

-- Update existing data to use the new enum values
-- Map 'approved' to 'payment_confirmed' 
UPDATE user_packages 
SET payment_status = 'payment_confirmed'
WHERE payment_status = 'approved';

-- Set approval_status for existing records to match payment_status
UPDATE user_packages 
SET approval_status = (CASE 
    WHEN payment_status = 'pending_approval' THEN 'pending'
    WHEN payment_status = 'rejected' THEN 'rejected'
    WHEN payment_status = 'payment_confirmed' THEN 'payment_confirmed'
    WHEN payment_status = 'authorized' THEN 'authorized'
    ELSE 'pending'
END)::approvalstatus;

-- Show final state
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userpackagepaymentstatus') ORDER BY enumsortorder;
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'approvalstatus') ORDER BY enumsortorder;