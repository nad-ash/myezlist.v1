-- Allow admin users to share their plan with up to 3 family members
UPDATE subscription_tiers 
SET max_family_members = 3 
WHERE tier_name = 'admin';

-- Also set for premium tier (if applicable)
UPDATE subscription_tiers 
SET max_family_members = 3 
WHERE tier_name = 'premium';

-- Set pro tier to allow 1 family member
UPDATE subscription_tiers 
SET max_family_members = 1 
WHERE tier_name = 'pro';


