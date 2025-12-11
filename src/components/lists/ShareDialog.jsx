
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShareLink } from "@/api/entities";
import { ListMember } from "@/api/entities";
import { User } from "@/api/entities";
import { Copy, Check, UserX, Link as LinkIcon, RefreshCw, Users, UserCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ShareDialog({ open, onClose, list, onShareLinkCreated }) {
  const [shareLink, setShareLink] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (open && list) {
      loadData();
    }
  }, [open, list]);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Load existing share link
      const links = await ShareLink.filter({ list_id: list.id, is_active: true });
      if (links.length > 0) {
        setShareLink(links[0]);
      } else {
        setShareLink(null);
      }

      // Load members
      const listMembers = await ListMember.filter({ list_id: list.id });
      const approved = listMembers.filter(m => m.status === 'approved' || m.role === 'owner');
      const pending = listMembers.filter(m => m.status === 'pending');
      
      setMembers(approved);
      setPendingMembers(pending);
    } catch (error) {
      console.error("Error loading share data:", error);
    }
    setLoading(false);
  };

  const handleGenerateLink = async () => {
    setLoading(true); // Preserve loading state management
    try {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const newLink = await ShareLink.create({ // Use imported ShareLink
        list_id: list.id,
        token: token,
        is_active: true
      });

      setShareLink(newLink); // Update component state with the new link

      // Call callback to track activity
      if (onShareLinkCreated) {
        onShareLinkCreated();
      }

      loadData(); // Use existing loadData function
    } catch (error) {
      console.error("Error generating share link:", error);
      alert("Failed to generate share link. Please try again."); // Preserve user feedback
    }
    setLoading(false); // Preserve loading state management
  };

  const deactivateLink = async () => {
    if (!confirm("Are you sure you want to deactivate this share link? No one will be able to join using this link anymore.")) {
      return;
    }

    setLoading(true);
    try {
      await ShareLink.update(shareLink.id, { is_active: false });
      setShareLink(null);
    } catch (error) {
      console.error("Error deactivating link:", error);
      alert("Failed to deactivate link. Please try again.");
    }
    setLoading(false);
  };

  const approveMember = async (member) => {
    setLoading(true);
    try {
      await ListMember.update(member.id, { status: 'approved' });
      loadData();
    } catch (error) {
      console.error("Error approving member:", error);
      alert("Failed to approve member. Please try again.");
    }
    setLoading(false);
  };

  const removeMember = async (member) => {
    if (member.role === 'owner') {
      alert("Cannot remove the list owner.");
      return;
    }

    const action = member.status === 'pending' ? 'Reject' : 'Remove';
    if (!confirm(`${action} ${member.user_email} from this list?`)) {
      return;
    }

    setLoading(true);
    try {
      await ListMember.delete(member.id);
      loadData();
    } catch (error) {
      console.error("Error removing member:", error);
      alert("Failed to remove member. Please try again.");
    }
    setLoading(false);
  };

  const copyToClipboard = () => {
    const url = `${window.location.origin}/JoinListViaLink?token=${shareLink.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwner = members.find(m => m.user_id === currentUser?.id)?.role === 'owner';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share "{list?.name}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Share Link Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LinkIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-800">Share Link</h3>
            </div>

            {shareLink ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/JoinListViaLink?token=${shareLink.token}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    className="shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                {isOwner && (
                  <div className="flex gap-2">
                    <Button
                      onClick={deactivateLink}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <UserX className="w-4 h-4 mr-2" />
                      Deactivate Link
                    </Button>
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  Users will need your approval to access this list.
                </p>
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-lg">
                <LinkIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-4">
                  No active share link. Generate one to invite others.
                </p>
                <Button
                  onClick={handleGenerateLink} // Updated to handleGenerateLink
                  disabled={loading || !isOwner}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Generate Share Link
                    </>
                  )}
                </Button>
                {!isOwner && (
                  <p className="text-xs text-slate-500 mt-2">
                    Only the list owner can generate share links.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Members Section */}
          <div>
            <Tabs defaultValue={pendingMembers.length > 0 ? "pending" : "approved"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending" className="relative">
                  Pending
                  {pendingMembers.length > 0 && (
                    <Badge className="ml-2 bg-yellow-500 hover:bg-yellow-600">
                      {pendingMembers.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Members ({members.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-4">
                {pendingMembers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm">No pending requests</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {pendingMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                              {member.user_email?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">
                              {member.user_email}
                            </p>
                            <Badge variant="secondary" className="text-xs mt-1 bg-yellow-100 text-yellow-700">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          </div>
                        </div>

                        {isOwner && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => approveMember(member)}
                              size="sm"
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => removeMember(member)}
                              variant="outline"
                              size="sm"
                              disabled={loading}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approved" className="mt-4">
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {member.user_email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">
                            {member.user_email}
                          </p>
                          <Badge
                            variant={member.role === 'owner' ? 'default' : 'secondary'}
                            className="text-xs mt-1"
                          >
                            {member.role}
                          </Badge>
                        </div>
                      </div>

                      {isOwner && member.role !== 'owner' && (
                        <Button
                          onClick={() => removeMember(member)}
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
