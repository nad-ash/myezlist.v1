/**
 * Family Sharing Settings Component
 * 
 * Allows Pro/Premium users to:
 * - Create/manage a family group
 * - Invite members via email or link
 * - Approve/remove members
 * - Toggle auto-share lists setting
 * - View shared credit pool
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  UserPlus,
  Link2,
  Copy,
  Check,
  X,
  Crown,
  Clock,
  Mail,
  Trash2,
  LogOut,
  Loader2,
  AlertCircle,
  Share2,
  Sparkles,
  UserCheck,
  UserX
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import familyService from '@/services/familyService';
import { User } from '@/api/entities';

export default function FamilySharing({ userTier = 'free', maxFamilyMembers = 0 }) {
  const [loading, setLoading] = useState(true);
  const [familyInfo, setFamilyInfo] = useState(null);
  const [creditsInfo, setCreditsInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // UI State
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  // Action State
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  
  // Form State
  const [familyName, setFamilyName] = useState('My Family');
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState(null);

  const canCreateFamily = ['pro', 'premium', 'admin'].includes(userTier);

  // Watch for dark mode changes
  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const loadFamilyInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await familyService.getFamilyInfo();
      setFamilyInfo(info);
      
      // If user is in a family, also fetch their credits info
      if (info?.has_family) {
        try {
          const user = await User.me();
          const credits = await familyService.getFamilyCreditsRemaining(user.id);
          setCreditsInfo(credits);
        } catch (creditsErr) {
          console.error('Failed to load credits info:', creditsErr);
          // Non-fatal, continue without credits info
        }
      }
    } catch (err) {
      console.error('Failed to load family info:', err);
      setError('Failed to load family information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFamilyInfo();
  }, [loadFamilyInfo]);

  const handleCreateFamily = async () => {
    try {
      setCreating(true);
      const result = await familyService.createFamilyGroup(familyName);
      if (result.success) {
        setShowCreateDialog(false);
        await loadFamilyInfo();
      } else {
        setError(result.message || 'Failed to create family group');
      }
    } catch (err) {
      console.error('Failed to create family:', err);
      setError('Failed to create family group');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    try {
      setInviting(true);
      const result = await familyService.generateInviteLink(inviteEmail || null);
      if (result.success) {
        const fullUrl = familyService.buildInviteUrl(result.token);
        setGeneratedLink({ token: result.token, url: fullUrl, expires: result.expires_at });
        await loadFamilyInfo();
      } else {
        setError(result.message || 'Failed to generate invite');
      }
    } catch (err) {
      console.error('Failed to generate invite:', err);
      setError('Failed to generate invite link');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async (url, token) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleApproveMember = async (memberId) => {
    try {
      setUpdating(true);
      const result = await familyService.approveMember(memberId);
      if (result.success) {
        await loadFamilyInfo();
      } else {
        setError(result.message || 'Failed to approve member');
      }
    } catch (err) {
      console.error('Failed to approve member:', err);
      setError('Failed to approve member');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      setUpdating(true);
      const result = await familyService.removeMember(memberId);
      if (result.success) {
        setShowRemoveMemberConfirm(null);
        await loadFamilyInfo();
      } else {
        setError(result.message || 'Failed to remove member');
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member');
    } finally {
      setUpdating(false);
    }
  };

  const handleLeaveFamily = async () => {
    try {
      setUpdating(true);
      const result = await familyService.leaveFamily();
      if (result.success) {
        setShowLeaveConfirm(false);
        await loadFamilyInfo();
      } else {
        setError(result.message || 'Failed to leave family');
      }
    } catch (err) {
      console.error('Failed to leave family:', err);
      setError('Failed to leave family');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteFamily = async () => {
    try {
      setUpdating(true);
      const result = await familyService.deleteFamilyGroup();
      if (result.success) {
        setShowDeleteConfirm(false);
        await loadFamilyInfo();
      } else {
        setError(result.message || 'Failed to delete family group');
      }
    } catch (err) {
      console.error('Failed to delete family:', err);
      setError('Failed to delete family group');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleShareAllLists = async (enabled) => {
    try {
      setUpdating(true);
      const result = await familyService.updateFamilySettings({ shareAllLists: enabled });
      if (result.success) {
        await loadFamilyInfo();
      } else {
        setError(result.message || 'Failed to update settings');
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
      setError('Failed to update settings');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeactivateInvite = async (inviteId) => {
    try {
      setUpdating(true);
      await familyService.deactivateInvite(inviteId);
      await loadFamilyInfo();
    } catch (err) {
      console.error('Failed to deactivate invite:', err);
      setError('Failed to deactivate invite');
    } finally {
      setUpdating(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card 
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span 
            className="ml-2"
            style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
          >
            Loading family info...
          </span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card 
        style={{
          backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.2)' : 'rgb(254 242 242)',
          borderColor: isDarkMode ? 'rgb(153 27 27)' : 'rgb(254 202 202)'
        }}
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span style={{ color: isDarkMode ? 'rgb(252 165 165)' : 'rgb(185 28 28)' }}>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => { setError(null); loadFamilyInfo(); }}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No family and can't create (free/adfree tier)
  if (!familyInfo?.has_family && !canCreateFamily) {
    return (
      <Card 
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader>
          <CardTitle 
            className="flex items-center gap-2"
            style={{ color: isDarkMode ? 'rgb(241 245 249)' : 'rgb(30 41 59)' }}
          >
            <Users className="w-5 h-5" />
            Family Sharing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-start gap-3 p-4 rounded-lg"
            style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(241 245 249)' }}
          >
            <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p 
                className="font-medium"
                style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(30 41 59)' }}
              >
                Upgrade to Pro or Premium
              </p>
              <p 
                className="text-sm mt-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
              >
                Share your subscription with family and friends. Pool AI credits together and share recipes and tasks.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No family yet, but can create
  if (!familyInfo?.has_family && canCreateFamily) {
    return (
      <>
        <Card 
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <CardHeader>
            <CardTitle 
              className="flex items-center gap-2"
              style={{ color: isDarkMode ? 'rgb(241 245 249)' : 'rgb(30 41 59)' }}
            >
              <Users className="w-5 h-5" />
              Family Sharing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgb(219 234 254)' }}
              >
                <Users style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }} className="w-8 h-8" />
              </div>
              <h3 
                className="text-lg font-semibold mb-2"
                style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(30 41 59)' }}
              >
                Create a Family Group
              </h3>
              <p 
                className="text-sm mb-4 max-w-md mx-auto"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
              >
                Share your {userTier} subscription with up to {maxFamilyMembers} family member{maxFamilyMembers > 1 ? 's' : ''}. 
                Pool AI credits together and share recipes and tasks.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Create Family Group
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Create Family Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <DialogHeader>
              <DialogTitle style={{ color: isDarkMode ? 'rgb(241 245 249)' : '' }}>
                Create Family Group
              </DialogTitle>
              <DialogDescription style={{ color: isDarkMode ? 'rgb(148 163 184)' : '' }}>
                Give your family group a name. You can invite members after creating.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label 
                htmlFor="family-name"
                style={{ color: isDarkMode ? 'rgb(203 213 225)' : '' }}
              >
                Family Name
              </Label>
              <Input
                id="family-name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="My Family"
                className="mt-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                  borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                  color: isDarkMode ? 'rgb(241 245 249)' : ''
                }}
                maxLength={50}
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                  borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                  color: isDarkMode ? 'rgb(226 232 240)' : ''
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateFamily} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Has family - show full interface
  const { family_group, members = [], invites = [], is_owner, max_family_members } = familyInfo;
  const approvedMembers = members.filter(m => m.status === 'approved');
  const pendingMembers = members.filter(m => m.status === 'pending');
  const memberCount = approvedMembers.filter(m => m.role !== 'owner').length;
  const canInviteMore = memberCount < (max_family_members || 0);

  return (
    <>
      <Card 
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle 
              className="flex items-center gap-2"
              style={{ color: isDarkMode ? 'rgb(241 245 249)' : 'rgb(30 41 59)' }}
            >
              <Users className="w-5 h-5" />
              {family_group?.name || 'Family Sharing'}
            </CardTitle>
            {is_owner && (
              <Badge 
                variant="outline" 
                className="gap-1"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                  borderColor: isDarkMode ? 'rgb(251 191 36)' : 'rgb(245 158 11)',
                  color: isDarkMode ? 'rgb(251 191 36)' : 'rgb(180 83 9)'
                }}
              >
                <Crown className="w-3 h-3" />
                Owner
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credit Pool */}
          <div 
            className="rounded-lg p-4"
            style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(241 245 249)' }}
          >
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm font-medium"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
              >
                Family Credit Pool
              </span>
              <span 
                className="text-sm font-bold"
                style={{ color: isDarkMode ? 'rgb(34 197 94)' : 'rgb(22 163 74)' }}
              >
                {creditsInfo?.credits_remaining ?? '—'} remaining
              </span>
            </div>
            {creditsInfo && (
              <div className="mb-2">
                <Progress 
                  value={creditsInfo.monthly_credits > 0 
                    ? ((creditsInfo.credits_remaining / creditsInfo.monthly_credits) * 100) 
                    : 0
                  } 
                  className="h-2" 
                />
                <p 
                  className="text-xs mt-1"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                >
                  {creditsInfo.credits_used} of {creditsInfo.monthly_credits} used this month
                </p>
              </div>
            )}
            <p 
              className="text-xs"
              style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
            >
              AI credits are pooled across all family members
            </p>
          </div>

          {/* What's Shared Info */}
          <div 
            className="rounded-lg p-4 space-y-3"
            style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(241 245 249)' }}
          >
            <h4 
              className="text-sm font-medium"
              style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(30 41 59)' }}
            >
              What's Shared
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: isDarkMode ? 'rgb(34 197 94)' : 'rgb(22 163 74)' }} />
                <p 
                  className="text-sm"
                  style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                >
                  <strong>Custom Recipes</strong> — Your AI-generated recipes are automatically shared with family members
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: isDarkMode ? 'rgb(34 197 94)' : 'rgb(22 163 74)' }} />
                <p 
                  className="text-sm"
                  style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                >
                  <strong>Tasks</strong> — Individual tasks can be shared selectively using the share toggle when creating
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: isDarkMode ? 'rgb(34 197 94)' : 'rgb(22 163 74)' }} />
                <p 
                  className="text-sm"
                  style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                >
                  <strong>AI Credits</strong> — Your family shares a combined credit pool for AI features
                </p>
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 
                className="font-medium"
                style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(30 41 59)' }}
              >
                Members ({memberCount}/{max_family_members || 0})
              </h4>
              {is_owner && canInviteMore && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowInviteDialog(true)} 
                  className="gap-1"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                    borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                    color: isDarkMode ? 'rgb(226 232 240)' : ''
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  Invite
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {approvedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)' }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgb(219 234 254)' }}
                    >
                      {member.role === 'owner' ? (
                        <Crown className="w-4 h-4 text-amber-500" />
                      ) : (
                        <span 
                          className="text-sm font-medium"
                          style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }}
                        >
                          {(member.full_name || member.email || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p 
                        className="font-medium"
                        style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(30 41 59)' }}
                      >
                        {member.full_name || member.email}
                      </p>
                      {member.full_name && (
                        <p 
                          className="text-xs"
                          style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                        >
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role === 'owner' ? (
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        style={{
                          backgroundColor: isDarkMode ? 'rgb(71 85 105)' : '',
                          color: isDarkMode ? 'rgb(203 213 225)' : ''
                        }}
                      >
                        Owner
                      </Badge>
                    ) : is_owner ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => setShowRemoveMemberConfirm(member)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}

              {/* Pending Members */}
              {pendingMembers.length > 0 && is_owner && (
                <div className="mt-4">
                  <h5 
                    className="text-sm font-medium mb-2"
                    style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                  >
                    Pending Approval ({pendingMembers.length})
                  </h5>
                  {pendingMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.1)' : 'rgb(255 251 235)',
                        borderColor: isDarkMode ? 'rgb(180 83 9)' : 'rgb(253 230 138)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.2)' : 'rgb(254 243 199)' }}
                        >
                          <Clock className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p 
                            className="font-medium"
                            style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(30 41 59)' }}
                          >
                            {member.full_name || member.email}
                          </p>
                          <p 
                            className="text-xs"
                            style={{ color: isDarkMode ? 'rgb(251 191 36)' : 'rgb(217 119 6)' }}
                          >
                            Awaiting approval
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                          onClick={() => handleApproveMember(member.id)}
                          disabled={updating}
                        >
                          <UserCheck className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => setShowRemoveMemberConfirm(member)}
                          disabled={updating}
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Invites (Owner only) */}
          {is_owner && invites.length > 0 && (
            <div>
              <h4 
                className="font-medium mb-3"
                style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(30 41 59)' }}
              >
                Active Invites
              </h4>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)' }}
                  >
                    <div className="flex items-center gap-3">
                      <Link2 style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(156 163 175)' }} className="w-4 h-4" />
                      <div>
                        <p 
                          className="text-sm"
                          style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                        >
                          {invite.invitee_email || 'Anyone with link'}
                        </p>
                        <p 
                          className="text-xs"
                          style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(156 163 175)' }}
                        >
                          Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyLink(familyService.buildInviteUrl(invite.token), invite.token)}
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : '' }}
                      >
                        {copiedToken === invite.token ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeactivateInvite(invite.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings (Owner only) */}
          {is_owner && (
            <div 
              className="pt-4 border-t"
              style={{ borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <Label 
                    htmlFor="share-all-lists" 
                    className="font-medium"
                    style={{ color: isDarkMode ? 'rgb(226 232 240)' : '' }}
                  >
                    Auto-share all shopping lists
                  </Label>
                  <p 
                    className="text-xs mt-1"
                    style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                  >
                    Automatically share all shopping lists with family members
                  </p>
                </div>
                <Switch
                  id="share-all-lists"
                  checked={family_group?.share_all_lists || false}
                  onCheckedChange={handleToggleShareAllLists}
                  disabled={updating}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div 
            className="pt-4 border-t flex justify-end gap-2"
            style={{ borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)' }}
          >
            {is_owner ? (
              <Button
                variant="outline"
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  borderColor: isDarkMode ? 'rgb(239 68 68)' : ''
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Family Group
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                onClick={() => setShowLeaveConfirm(true)}
                style={{
                  borderColor: isDarkMode ? 'rgb(239 68 68)' : ''
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave Family
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDarkMode ? 'rgb(241 245 249)' : '' }}>
              Invite to Family
            </DialogTitle>
            <DialogDescription style={{ color: isDarkMode ? 'rgb(148 163 184)' : '' }}>
              Generate an invite link to share with family members.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label 
                htmlFor="invite-email"
                style={{ color: isDarkMode ? 'rgb(203 213 225)' : '' }}
              >
                Email (optional)
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="family@example.com"
                className="mt-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                  borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                  color: isDarkMode ? 'rgb(241 245 249)' : ''
                }}
                maxLength={100}
              />
              <p 
                className="text-xs mt-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
              >
                Leave empty to create a link anyone can use
              </p>
            </div>

            {generatedLink && (
              <div 
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgb(240 253 244)',
                  borderColor: isDarkMode ? 'rgb(34 197 94)' : 'rgb(187 247 208)'
                }}
              >
                <p 
                  className="text-sm font-medium mb-2"
                  style={{ color: isDarkMode ? 'rgb(134 239 172)' : 'rgb(22 101 52)' }}
                >
                  Invite Link Generated!
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedLink.url}
                    className="text-xs"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'white',
                      borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                      color: isDarkMode ? 'rgb(203 213 225)' : ''
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCopyLink(generatedLink.url, generatedLink.token)}
                  >
                    {copiedToken === generatedLink.token ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p 
                  className="text-xs mt-2"
                  style={{ color: isDarkMode ? 'rgb(74 222 128)' : 'rgb(22 163 74)' }}
                >
                  Expires {new Date(generatedLink.expires).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setShowInviteDialog(false); setGeneratedLink(null); setInviteEmail(''); }}
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                color: isDarkMode ? 'rgb(226 232 240)' : ''
              }}
            >
              Close
            </Button>
            <Button onClick={handleGenerateInviteLink} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
              Generate Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: isDarkMode ? 'rgb(241 245 249)' : '' }}>
              Delete Family Group?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: isDarkMode ? 'rgb(148 163 184)' : '' }}>
              This will remove all members from the family group. They will lose access to shared content and the credit pool. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                color: isDarkMode ? 'rgb(226 232 240)' : ''
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFamily}
              className="bg-red-600 hover:bg-red-700"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Family Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!showRemoveMemberConfirm} onOpenChange={() => setShowRemoveMemberConfirm(null)}>
        <AlertDialogContent
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: isDarkMode ? 'rgb(241 245 249)' : '' }}>
              Remove Member?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: isDarkMode ? 'rgb(148 163 184)' : '' }}>
              {showRemoveMemberConfirm?.full_name || showRemoveMemberConfirm?.email} will be removed from the family group and lose access to shared content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                color: isDarkMode ? 'rgb(226 232 240)' : ''
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleRemoveMember(showRemoveMemberConfirm?.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirmation */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: isDarkMode ? 'rgb(241 245 249)' : '' }}>
              Leave Family Group?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: isDarkMode ? 'rgb(148 163 184)' : '' }}>
              You will lose access to the shared credit pool and family-shared content. You can rejoin later if invited again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : '',
                color: isDarkMode ? 'rgb(226 232 240)' : ''
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveFamily}
              className="bg-red-600 hover:bg-red-700"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Leave Family
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

