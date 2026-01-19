import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import familyService from "@/services/familyService";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  LogIn, 
  Users, 
  UserPlus,
  Crown,
  Sparkles,
  Heart
} from "lucide-react";
import LegalFooter from "@/components/common/LegalFooter";

export default function JoinFamily() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  useEffect(() => {
    if (token) {
      checkAuthAndProcess();
    } else {
      setStatus('error');
      setMessage('Invalid invite link - no token provided');
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
        
        // Validate the invite link before showing sign-in prompt
        setMessage('Validating invite link...');
        const validation = await familyService.validateInviteToken(token);
        
        if (!validation.valid) {
          setStatus('error');
          setMessage(validation.message || 'This invite link is invalid or has expired');
          return;
        }
        
        // Invite link is valid, show family info and prompt user to sign in
        if (validation.family_name) {
          setFamilyName(validation.family_name);
        }
        if (validation.owner_name) {
          setOwnerName(validation.owner_name);
        }
        setStatus('need_auth');
        setMessage('Sign in to join this family');
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
      setMessage('Processing your request...');
      const result = await familyService.joinFamilyViaToken(token);

      if (!result.success) {
        // Handle specific error cases
        if (result.error === 'already_in_family') {
          setStatus('error');
          setMessage('You are already in another family group. Leave your current family first to join a new one.');
          return;
        }
        if (result.error === 'family_full') {
          setStatus('error');
          setMessage('This family group has reached its member limit.');
          return;
        }
        if (result.error === 'is_owner') {
          setStatus('error');
          setMessage('You are the owner of this family group.');
          return;
        }
        setStatus('error');
        setMessage(result.message || 'This invite link is invalid or has expired');
        return;
      }

      // Set family name from the result
      if (result.family_name) {
        setFamilyName(result.family_name);
      }

      if (result.status === 'already_approved') {
        setStatus('already_approved');
        setMessage(`You are already a member of "${result.family_name || 'this family'}"`);
        setTimeout(() => navigate(createPageUrl("Settings")), 2000);
        return;
      }

      if (result.status === 'already_pending') {
        setStatus('pending');
        setMessage(`Your request to join "${result.family_name || 'this family'}" is pending approval.`);
        return;
      }

      setStatus('pending');
      setMessage(result.message || `Request sent! The owner of "${result.family_name || 'this family'}" will review your request.`);

    } catch (error) {
      console.error("Error processing join:", error);
      setStatus('error');
      setMessage('Failed to join the family. Please try again.');
    }
  };

  const handleSignIn = () => {
    // Save current URL so user returns here after login
    const currentUrl = window.location.pathname + window.location.search;
    localStorage.setItem('redirectAfterLogin', currentUrl);
    navigate(createPageUrl("Login"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-pink-900/20 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          <div className="text-center">
            
            {/* Loading State */}
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Processing...</h1>
                <p className="text-slate-600 dark:text-slate-400">{message}</p>
              </>
            )}

            {/* Need Authentication State */}
            {status === 'need_auth' && (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  You're Invited! 🎉
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  {ownerName 
                    ? `${ownerName} has invited you to join their family group`
                    : 'You\'ve been invited to join a family group'
                  }
                  {familyName && <strong className="block mt-1">"{familyName}"</strong>}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Sign in or create an account to share subscriptions, AI credits, and recipes!
                </p>
                
                <div className="space-y-3">
                  <Button 
                    onClick={handleSignIn}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg"
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In to Join
                  </Button>
                  
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Don't have an account?{' '}
                    <button 
                      onClick={handleSignIn}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                      Create one for free
                    </button>
                  </p>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Benefits of Family Sharing
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Shared AI credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-pink-500" />
                      <span>Shared recipes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-purple-500" />
                      <span>Premium features</span>
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
                  You'll be able to access shared features once the family owner approves your request.
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl("Settings"))} 
                  className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600"
                >
                  Go to Settings
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
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Redirecting to settings...</p>
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
                    onClick={() => navigate(createPageUrl("Settings"))} 
                    className="w-full"
                    variant="outline"
                  >
                    Go to Settings
                  </Button>
                  <Button 
                    onClick={() => navigate(createPageUrl("Home"))} 
                    className="w-full"
                    variant="ghost"
                  >
                    Go to Home
                  </Button>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    If you believe this is a mistake, please ask the family owner to share a new invite link.
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


