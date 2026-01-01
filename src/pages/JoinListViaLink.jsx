import React, { useState, useEffect } from "react";
import { ShareLink } from "@/api/entities";
import { ShoppingList } from "@/api/entities";
import { ListMember } from "@/api/entities";
import { User, ActivityTracking } from "@/api/entities";
import { OPERATIONS, PAGES } from "@/utils/trackingContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Clock, CheckCircle, XCircle, Loader2, LogIn, ShoppingCart, UserPlus } from "lucide-react";
import LegalFooter from "@/components/common/LegalFooter";

export default function JoinListViaLink() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [listName, setListName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, true/false = known

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  useEffect(() => {
    if (token) {
      checkAuthAndProcess();
    } else {
      setStatus('error');
      setMessage('Invalid share link - no token provided');
    }
  }, []);

  const checkAuthAndProcess = async () => {
    try {
      setMessage('Checking authentication...');
      
      // First, check if user is authenticated
      let currentUser;
      try {
        currentUser = await User.me();
        setIsAuthenticated(true);
      } catch (authError) {
        // User is not authenticated
        setIsAuthenticated(false);
        
        // Validate the share link exists before showing sign-in prompt
        setMessage('Validating share link...');
        const shareLinks = await ShareLink.filter({ token, is_active: true });
        
        if (shareLinks.length === 0) {
          setStatus('error');
          setMessage('This share link is invalid or has expired');
          return;
        }
        
        // Share link is valid, prompt user to sign in
        setStatus('need_auth');
        setMessage('Sign in to join this shopping list');
        return;
      }

      // User is authenticated, proceed with joining
      await processJoin(currentUser);
      
    } catch (error) {
      console.error("Error:", error);
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  const processJoin = async (currentUser) => {
    try {
      setMessage('Validating share link...');
      const shareLinks = await ShareLink.filter({ token, is_active: true });

      if (shareLinks.length === 0) {
        setStatus('error');
        setMessage('This share link is invalid or has expired');
        return;
      }

      const targetListId = shareLinks[0].list_id;

      // Try to get list name (may fail due to RLS if user isn't a member yet)
      setMessage('Loading list details...');
      let listDisplayName = 'this shopping list';
      try {
        const allLists = await ShoppingList.list();
        const list = allLists.find(l => l.id === targetListId);
        if (list) {
          listDisplayName = list.name;
          setListName(list.name);
        }
      } catch (listError) {
        // Can't see list details yet (RLS), that's okay - we'll still join
        console.log('Cannot fetch list details (normal for new users)');
      }

      // Check if user is already a member
      setMessage('Checking membership...');
      const memberships = await ListMember.filter({
        list_id: targetListId,
        user_id: currentUser.id
      });

      if (memberships.length > 0) {
        const membership = memberships[0];
        
        if (membership.status === 'approved') {
          // User already has access - try to get list name now (should work with membership)
          if (!listName) {
            try {
              const allLists = await ShoppingList.list();
              const list = allLists.find(l => l.id === targetListId);
              if (list) setListName(list.name);
            } catch (e) { /* ignore */ }
          }
          setStatus('already_approved');
          setMessage(`You already have access to "${listName || listDisplayName}"`);
          setTimeout(() => navigate(createPageUrl(`ListView?listId=${targetListId}`)), 2000);
        } else {
          setStatus('pending');
          setMessage(`Your request to join "${listName || listDisplayName}" is pending approval from the list owner.`);
        }
        return;
      }

      // Create new membership request
      setMessage('Requesting access...');
      await ListMember.create({
        list_id: targetListId,
        user_id: currentUser.id,
        user_email: currentUser.email,
        role: 'member',
        status: 'pending'
      });

      // Track activity (fire and forget)
      ActivityTracking.create({
        operation_type: 'CREATE',
        page: PAGES.JOIN_LIST,
        operation_name: OPERATIONS.LIST_MEMBER.JOIN,
        description: `User joined shopping list via share link`,
        user_id: currentUser.id,
        timestamp: new Date().toISOString()
      }).catch(err => console.warn('Activity tracking failed:', err));

      setStatus('pending');
      setMessage(`Access request sent! The owner of "${listName || listDisplayName}" will review your request.`);

    } catch (error) {
      console.error("Error processing join:", error);
      setStatus('error');
      
      // Provide more helpful error messages based on the error type
      if (error.message?.includes('policy') || error.code === '42501') {
        setMessage('Unable to join this list. The list owner may need to regenerate the share link.');
      } else if (error.message?.includes('duplicate') || error.code === '23505') {
        setMessage('You already have a pending request for this list.');
      } else {
        setMessage('Failed to join the list. Please try again.');
      }
    }
  };

  const handleSignIn = () => {
    // Save current URL so user returns here after login
    const currentUrl = window.location.pathname + window.location.search;
    localStorage.setItem('redirectAfterLogin', currentUrl);
    navigate(createPageUrl("Login"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          <div className="text-center">
            
            {/* Loading State */}
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Processing...</h1>
                <p className="text-slate-600 dark:text-slate-400">{message}</p>
              </>
            )}

            {/* Need Authentication State */}
            {status === 'need_auth' && (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <ShoppingCart className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  You're Invited!
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Someone shared a shopping list with you. Sign in or create an account to join and start collaborating!
                </p>
                
                <div className="space-y-3">
                  <Button 
                    onClick={handleSignIn}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6 text-lg"
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In to Join
                  </Button>
                  
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Don't have an account?{' '}
                    <button 
                      onClick={handleSignIn}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Create one for free
                    </button>
                  </p>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Free to use</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-blue-500" />
                      <span>Easy collaboration</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Pending Approval State */}
            {status === 'pending' && (
              <>
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Request Sent!</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  You'll be able to access the list once the owner approves your request. We'll notify you when it's ready!
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl("Home"))} 
                  className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600"
                >
                  Go to My Lists
                </Button>
              </>
            )}

            {/* Already Approved State */}
            {status === 'already_approved' && (
              <>
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">You're Already In!</h1>
                <p className="text-slate-600 dark:text-slate-400">{message}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Redirecting to the list...</p>
              </>
            )}

            {/* Error State */}
            {status === 'error' && (
              <>
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Oops!</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
                <div className="space-y-3">
                  <Button 
                    onClick={() => navigate(createPageUrl("Home"))} 
                    className="w-full"
                    variant="outline"
                  >
                    Go to Home
                  </Button>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    If you believe this is a mistake, please ask the list owner to share a new link.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <LegalFooter />
    </div>
  );
}
