import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase, supabaseAuth } from "@/api/supabaseClient";
import { linkSupabaseUserToBase44 } from "@/api/base44Link";
import { BACKEND_PROVIDER } from "@/api/config";
import { Loader2 } from "lucide-react";

/**
 * OAuth callback handler
 * This page handles the redirect from OAuth providers (Google, Apple, etc.)
 * and creates/updates the user profile as needed
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL hash (Supabase puts tokens there)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user) {
          // Check if profile exists
          const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

          // Create profile if it doesn't exist (first-time OAuth login)
          if (!existingProfile && profileError?.code === 'PGRST116') {
            const { error: insertError } = await supabase.from('profiles').insert({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || 
                         session.user.user_metadata?.name || 
                         session.user.email?.split('@')[0] || '',
              role: 'user',
              subscription_tier: 'free',
              monthly_credits_total: 15,
              credits_used_this_month: 0,
              current_shopping_lists: 0,
              current_total_items: 0,
              current_tasks: 0,
              current_custom_recipes: 0,
              theme: 'default',
              created_date: new Date().toISOString()
            });

            if (insertError) {
              console.error('Error creating profile:', insertError);
            }
          }

          // If using Base44 backend, link the Supabase user to Base44
          if (BACKEND_PROVIDER === 'base44') {
            try {
              await linkSupabaseUserToBase44(session.user);
            } catch (linkError) {
              console.warn('Failed to link to Base44, continuing anyway:', linkError);
              // Don't block login if linking fails
            }
          }

          // Get redirect URL from query params or localStorage
          const redirectParam = searchParams.get('redirect');
          const storedRedirect = localStorage.getItem('redirectAfterLogin');
          const redirectUrl = redirectParam || storedRedirect || createPageUrl("Home");
          
          localStorage.removeItem('redirectAfterLogin');
          
          // Redirect to the intended destination
          navigate(redirectUrl, { replace: true });
        } else {
          // No session, redirect to login
          setError("Authentication failed. Please try again.");
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message || "Authentication failed. Please try again.");
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20">
      <div className="text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e49376f2948d5caa147758/52890d187_MyEZList_Icon_512x512.png"
            alt="MyEZList"
            className="w-12 h-12 object-contain"
          />
          <span className="text-3xl font-bold">
            <span className="text-slate-800 dark:text-slate-100">My</span>
            <span className="text-orange-700 dark:text-orange-500">EZ</span>
            <span className="text-slate-800 dark:text-slate-100">List</span>
          </span>
        </div>

        {error ? (
          <div className="space-y-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Redirecting to login...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-slate-600 dark:text-slate-300">Completing sign in...</p>
          </div>
        )}
      </div>
    </div>
  );
}

