/**
 * Family Sharing Service
 * 
 * Provides API for family/friends subscription sharing functionality.
 * Wraps Supabase RPC functions for family group management.
 * 
 * Features:
 * - Create/manage family groups
 * - Invite members via email or link
 * - Shared AI credit pool
 * - Family-shared tasks and recipes
 */

import { supabase } from '@/api/supabaseClient';

/**
 * Get complete family information for the current user
 * Returns family group details, members, and active invites
 * 
 * @returns {Promise<Object>} Family info object:
 *   - success: boolean
 *   - has_family: boolean - Whether user is in a family group
 *   - is_owner: boolean - Whether user owns the family group
 *   - family_group: { id, name, share_all_lists, credits_used_this_month, created_date }
 *   - members: Array of { id, user_id, email, full_name, status, role, joined_date }
 *   - invites: Array of { id, invitee_email, token, expires_at, created_date } (owner only)
 *   - max_family_members: number - Tier limit
 */
export async function getFamilyInfo() {
  const { data, error } = await supabase.rpc('get_family_info');
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to get family info:', error);
    throw error;
  }
  
  return data;
}

/**
 * Create a new family group
 * Only available for Pro and Premium tier users
 * 
 * @param {string} name - Optional family group name (default: "My Family")
 * @returns {Promise<Object>} Result:
 *   - success: boolean
 *   - family_group_id: uuid (if success)
 *   - name: string (if success)
 *   - error: string (if !success) - 'not_authenticated', 'already_exists', 'tier_not_allowed'
 *   - message: string
 */
export async function createFamilyGroup(name = 'My Family') {
  const { data, error } = await supabase.rpc('create_family_group', {
    p_name: name
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to create family group:', error);
    throw error;
  }
  
  if (data.success) {
    console.log('👨‍👩‍👧‍👦 Family: Created family group:', data.family_group_id);
  }
  
  return data;
}

/**
 * Update family group settings
 * Only the owner can update settings
 * 
 * @param {Object} settings - Settings to update
 * @param {string} [settings.name] - New group name
 * @param {boolean} [settings.shareAllLists] - Auto-share new lists with family
 * @returns {Promise<Object>} Result with success boolean and message
 */
export async function updateFamilySettings({ name, shareAllLists } = {}) {
  const { data, error } = await supabase.rpc('update_family_settings', {
    p_name: name || null,
    p_share_all_lists: shareAllLists !== undefined ? shareAllLists : null
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to update settings:', error);
    throw error;
  }
  
  return data;
}

/**
 * Delete the family group
 * Only the owner can delete. Removes all members and invites.
 * 
 * @returns {Promise<Object>} Result with success boolean and message
 */
export async function deleteFamilyGroup() {
  const { data, error } = await supabase.rpc('delete_family_group');
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to delete family group:', error);
    throw error;
  }
  
  if (data.success) {
    console.log('👨‍👩‍👧‍👦 Family: Family group deleted');
  }
  
  return data;
}

/**
 * Generate an invite link for the family group
 * Creates a 7-day expiring token
 * 
 * @param {string} [inviteeEmail] - Optional: specific email for targeted invite
 * @returns {Promise<Object>} Result:
 *   - success: boolean
 *   - token: string - The invite token (if success)
 *   - invite_id: uuid (if success)
 *   - expires_at: timestamp (if success)
 *   - error: string (if !success) - 'not_authenticated', 'no_family_group'
 *   - message: string
 */
export async function generateInviteLink(inviteeEmail = null) {
  const { data, error } = await supabase.rpc('generate_family_invite', {
    p_invitee_email: inviteeEmail
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to generate invite:', error);
    throw error;
  }
  
  if (data.success) {
    console.log('👨‍👩‍👧‍👦 Family: Generated invite link, expires:', data.expires_at);
  }
  
  return data;
}

/**
 * Build the full invite URL from a token
 * 
 * @param {string} token - The invite token
 * @returns {string} Full invite URL
 */
export function buildInviteUrl(token) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join-family?token=${token}`;
}

/**
 * Validate a family invite token (can be called before authentication)
 * Used to show invite info on the join page
 * 
 * @param {string} token - The invite token to validate
 * @returns {Promise<Object>} Result:
 *   - valid: boolean
 *   - family_name: string (if valid)
 *   - owner_name: string (if valid)
 *   - message: string (if !valid)
 */
export async function validateInviteToken(token) {
  const { data, error } = await supabase.rpc('validate_family_invite_token', {
    invite_token: token
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to validate invite token:', error);
    return { valid: false, message: 'Unable to validate invite link' };
  }
  
  return data;
}

/**
 * Join a family group via invite token
 * Creates a pending membership request
 * 
 * @param {string} token - The invite token
 * @returns {Promise<Object>} Result:
 *   - success: boolean
 *   - status: 'pending' | 'already_pending' | 'already_approved' (if success)
 *   - family_group_id: uuid (if success)
 *   - family_name: string (if success)
 *   - error: string (if !success) - 'not_authenticated', 'invalid_token', 'is_owner', 'already_in_family', 'family_full'
 *   - message: string
 */
export async function joinFamilyViaToken(token) {
  const { data, error } = await supabase.rpc('join_family_via_token', {
    invite_token: token
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to join family:', error);
    throw error;
  }
  
  if (data.success) {
    console.log('👨‍👩‍👧‍👦 Family: Join request status:', data.status);
  }
  
  return data;
}

/**
 * Approve a pending family member
 * Only the owner can approve members
 * 
 * @param {string} memberId - The family_members record ID
 * @returns {Promise<Object>} Result:
 *   - success: boolean
 *   - member_id: uuid (if success)
 *   - member_name: string (if success)
 *   - error: string (if !success) - 'not_authenticated', 'not_found', 'not_owner'
 *   - message: string
 */
export async function approveMember(memberId) {
  const { data, error } = await supabase.rpc('approve_family_member', {
    p_member_id: memberId
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to approve member:', error);
    throw error;
  }
  
  if (data.success) {
    console.log('👨‍👩‍👧‍👦 Family: Approved member:', data.member_name);
  }
  
  return data;
}

/**
 * Remove a member from the family group
 * Only the owner can remove members
 * 
 * @param {string} memberId - The family_members record ID
 * @returns {Promise<Object>} Result:
 *   - success: boolean
 *   - member_name: string (if success)
 *   - error: string (if !success) - 'not_authenticated', 'not_found', 'not_owner', 'is_owner'
 *   - message: string
 */
export async function removeMember(memberId) {
  const { data, error } = await supabase.rpc('remove_family_member', {
    p_member_id: memberId
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to remove member:', error);
    throw error;
  }
  
  if (data.success) {
    console.log('👨‍👩‍👧‍👦 Family: Removed member:', data.member_name);
  }
  
  return data;
}

/**
 * Leave the current family group
 * Members can leave voluntarily; owners must delete the group instead
 * 
 * @returns {Promise<Object>} Result:
 *   - success: boolean
 *   - error: string (if !success) - 'not_authenticated', 'not_member', 'is_owner'
 *   - message: string
 */
export async function leaveFamily() {
  const { data, error } = await supabase.rpc('leave_family_group');
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to leave family:', error);
    throw error;
  }
  
  if (data.success) {
    console.log('👨‍👩‍👧‍👦 Family: Left family group');
  }
  
  return data;
}

/**
 * Get remaining credits for the user (uses family pool if applicable)
 * 
 * @param {string} userId - The user ID to check
 * @returns {Promise<Object>} Credits info:
 *   - is_family_pool: boolean
 *   - family_group_id: uuid (if family pool)
 *   - owner_id: uuid (if family pool)
 *   - monthly_credits: number
 *   - credits_used: number
 *   - credits_remaining: number
 */
export async function getFamilyCreditsRemaining(userId) {
  const { data, error } = await supabase.rpc('get_family_credits_remaining', {
    p_user_id: userId
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to get credits info:', error);
    throw error;
  }
  
  return data;
}

/**
 * Consume credits from the family pool or individual credits
 * 
 * @param {string} userId - The user ID consuming credits
 * @param {number} credits - Number of credits to consume
 * @param {string} [featureKey] - Optional feature key for tracking
 * @returns {Promise<Object>} Result:
 *   - success: boolean
 *   - credits_consumed: number (if success)
 *   - credits_remaining: number (if success)
 *   - error: string (if !success) - 'insufficient_credits'
 *   - message: string
 */
export async function consumeFamilyCredits(userId, credits, featureKey = null) {
  const { data, error } = await supabase.rpc('consume_family_credits', {
    p_user_id: userId,
    p_credits: credits,
    p_feature_key: featureKey
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to consume credits:', error);
    throw error;
  }
  
  if (data.success) {
    console.log(`👨‍👩‍👧‍👦 Family: Consumed ${credits} credits, ${data.credits_remaining} remaining`);
  }
  
  return data;
}

/**
 * Get all approved family member user IDs
 * Useful for querying shared content
 * 
 * @param {string} userId - The user ID to get family members for
 * @returns {Promise<string[]>} Array of user IDs
 */
export async function getFamilyMemberIds(userId) {
  const { data, error } = await supabase.rpc('get_family_member_ids', {
    p_user_id: userId
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to get family member IDs:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Deactivate an invite link
 * 
 * @param {string} inviteId - The invite ID to deactivate
 * @returns {Promise<void>}
 */
export async function deactivateInvite(inviteId) {
  const { error } = await supabase
    .from('family_invites')
    .update({ is_active: false, updated_date: new Date().toISOString() })
    .eq('id', inviteId);
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to deactivate invite:', error);
    throw error;
  }
  
  console.log('👨‍👩‍👧‍👦 Family: Deactivated invite:', inviteId);
}

/**
 * Check if user is in a family group
 * Quick check without full family info
 * 
 * @returns {Promise<boolean>}
 */
export async function isInFamilyGroup() {
  try {
    const info = await getFamilyInfo();
    return info.success && info.has_family;
  } catch {
    return false;
  }
}

/**
 * Check if current user is a family owner
 * 
 * @returns {Promise<boolean>}
 */
export async function isFamilyOwner() {
  try {
    const info = await getFamilyInfo();
    return info.success && info.has_family && info.is_owner;
  } catch {
    return false;
  }
}

/**
 * Get pending member count (for badge display)
 * 
 * @returns {Promise<number>}
 */
export async function getPendingMemberCount() {
  try {
    const info = await getFamilyInfo();
    if (!info.success || !info.has_family || !info.is_owner) {
      return 0;
    }
    return info.members?.filter(m => m.status === 'pending').length || 0;
  } catch {
    return 0;
  }
}

// Default export with all functions
export default {
  // Family info
  getFamilyInfo,
  isInFamilyGroup,
  isFamilyOwner,
  
  // Family group management
  createFamilyGroup,
  updateFamilySettings,
  deleteFamilyGroup,
  
  // Invites
  generateInviteLink,
  buildInviteUrl,
  validateInviteToken,
  deactivateInvite,
  
  // Joining
  joinFamilyViaToken,
  leaveFamily,
  
  // Members
  approveMember,
  removeMember,
  getFamilyMemberIds,
  getPendingMemberCount,
  
  // Credits
  getFamilyCreditsRemaining,
  consumeFamilyCredits,
  
  // Resource counts
  getUserResourceCounts
};

/**
 * Get resource counts including family-shared resources
 * Used for quota checking
 * 
 * @param {string} userId - The user ID to get counts for
 * @returns {Promise<Object>} Resource counts:
 *   - shopping_lists: number
 *   - total_items: number
 *   - tasks: number
 *   - custom_recipes: number
 */
export async function getUserResourceCounts(userId) {
  const { data, error } = await supabase.rpc('get_user_resource_counts', {
    p_user_id: userId
  });
  
  if (error) {
    console.error('👨‍👩‍👧‍👦 Family: Failed to get resource counts:', error);
    throw error;
  }
  
  return data;
}

