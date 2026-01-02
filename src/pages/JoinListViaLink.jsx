import React, { useState, useEffect } from "react";
import { User, ActivityTracking } from "@/api/entities";
import { joinListViaShareToken, validateShareToken } from "@/api/supabaseFunctions";
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
        // Uses secure RPC function that doesn't expose list_id to unauthenticated users
        setMessage('Validating share link...');
        const validation = await validateShareToken(token);
        
        if (!validation.valid) {
          setStatus('error');
          setMessage(validation.message || 'This share link is invalid or has expired');
          return;
        }
        
        // Share link is valid, show list name and prompt user to sign in
        if (validation.list_name) {
          setListName(validation.list_name);
        }
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
      // Use secure RPC function that validates token server-side
      // This prevents attackers from bypassing token validation
      setMessage('Requesting access...');
      const result = await joinListViaShareToken(token);

      if (!result.success) {
        setStatus('error');
        setMessage(result.message || 'This share link is invalid or has expired');
        return;
      }

      // Set list name from the result
      if (result.list_name) {
        setListName(result.list_name);
      }

      if (result.status === 'already_approved') {
        setStatus('already_approved');
        setMessage(`You already have access to "${result.list_name || 'this list'}"`);
        setTimeout(() => navigate(createPageUrl(`ListView?listId=${result.list_id}`)), 2000);
        return;
      }

      // Only track activity for NEW membership requests (status === 'pending')
      // Skip tracking for 'already_pending' to prevent duplicate activity entries on repeat visits
      if (result.status === 'pending') {
        ActivityTracking.create({
          operation_type: 'CREATE',
          page: PAGES.JOIN_LIST,
          operation_name: OPERATIONS.LIST_MEMBER.JOIN,
          description: `User joined shopping list via share link`,
          user_id: currentUser.id,
          timestamp: new Date().toISOString()
        }).catch(err => console.warn('Activity tracking failed:', err));
      }

      setStatus('pending');
      setMessage(result.message || `Access request sent! The owner of "${result.list_name || 'this list'}" will review your request.`);

    } catch (error) {
      console.error("Error processing join:", error);
      setStatus('error');
      setMessage('Failed to join the list. Please try again.');
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
                  {listName 
                    ? `You've been invited to join "${listName}". Sign in or create an account to start collaborating!`
                    : 'Someone shared a shopping list with you. Sign in or create an account to join and start collaborating!'
                  }
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
