import React, { useState, useEffect } from "react";
import { User as UserAuth, UserAdmin, SubscriptionTier } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Crown, 
  Package, 
  Zap, 
  ShoppingCart,
  Loader2,
  User,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { manualUpgrade } from "@/api/functions";

const tierIcons = {
  free: Package,
  adfree: ShoppingCart,
  pro: Zap,
  premium: Crown
};

const tierColors = {
  free: "from-slate-400 to-slate-600",
  adfree: "from-blue-400 to-blue-600",
  pro: "from-purple-400 to-purple-600",
  premium: "from-amber-400 to-amber-600"
};

export default function UserManagement() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTier, setUserTier] = useState(null);
  const [allTiers, setAllTiers] = useState([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkAuth();
    loadTiers();
    
    setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await UserAuth.me();
      
      if (currentUser.role !== 'admin') {
        alert("Access denied. Admin privileges required.");
        navigate(createPageUrl("Admin"));
        return;
      }
      
      setIsAuthChecking(false);
    } catch (error) {
      console.error("Authentication required:", error);
      UserAuth.redirectToLogin(createPageUrl("Admin"));
    }
  };

  const loadTiers = async () => {
    try {
      const tiers = await SubscriptionTier.list('sort_order');
      setAllTiers(tiers.filter(t => t.tier_name !== 'admin'));
    } catch (error) {
      console.error("Error loading tiers:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    setSearching(true);
    setError("");
    setSuccessMessage("");
    setSelectedUser(null);
    setUserTier(null);

    try {
      const users = await UserAdmin.filter({ email: searchEmail.trim() });
      
      if (users.length === 0) {
        setError("User not found");
        setSearching(false);
        return;
      }

      const user = users[0];
      setSelectedUser(user);

      // Get user's tier
      const tier = allTiers.find(t => t.tier_name === user.subscription_tier);
      setUserTier(tier);
    } catch (error) {
      console.error("Error searching user:", error);
      setError("Failed to search user. Please try again.");
    }
    setSearching(false);
  };

  const handleUpgrade = async (targetTier) => {
    if (!selectedUser) return;

    if (!confirm(`Upgrade ${selectedUser.email} to ${targetTier}?`)) {
      return;
    }

    setUpgrading(true);
    setError("");
    setSuccessMessage("");

    try {
      const { data } = await manualUpgrade({ 
        user_id: selectedUser.id, 
        tier: targetTier 
      });

      setSuccessMessage(`Successfully upgraded ${selectedUser.email} to ${targetTier}`);
      
      // Refresh user data
      handleSearch();
    } catch (error) {
      console.error("Error upgrading user:", error);
      setError("Failed to upgrade user. Please try again.");
    }
    setUpgrading(false);
  };

  if (isAuthChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">User Management</h1>
        <p className="text-slate-600 dark:text-slate-400">Search and manage user subscriptions</p>
      </div>

      {/* Search Section */}
      <Card 
        className="mb-8"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader>
          <CardTitle style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}>
            Search User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="Enter user email address..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                color: isDarkMode ? 'rgb(241 245 249)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
              }}
            />
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 gap-2"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Section */}
      {selectedUser && userTier && (
        <>
          <Card 
            className="mb-8"
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <div className={cn("h-2 bg-gradient-to-r", tierColors[userTier.tier_name])} />
            <CardHeader>
              <CardTitle style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}>
                User Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Full Name</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {selectedUser.full_name || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Member Since</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {new Date(selectedUser.created_date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Plan Section */}
          <Card 
            className="mb-8"
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <div className={cn("h-2 bg-gradient-to-r", tierColors[userTier.tier_name])} />
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}>
                  Current Plan
                </CardTitle>
                <div className="flex items-center gap-2">
                  {React.createElement(tierIcons[userTier.tier_name] || Package, {
                    className: "w-6 h-6",
                    style: { color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }
                  })}
                  <span 
                    className="text-xl font-bold"
                    style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }}
                  >
                    {userTier.display_name}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div 
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)' }}
                >
                  <p 
                    className="text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }}
                  >
                    {selectedUser.current_shopping_lists || 0}/{userTier.max_shopping_lists}
                  </p>
                  <p className="text-xs" style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}>
                    Shopping Lists
                  </p>
                </div>

                <div 
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)' }}
                >
                  <p 
                    className="text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(34 197 94)' : 'rgb(22 163 74)' }}
                  >
                    {selectedUser.current_total_items || 0}/{userTier.max_total_items}
                  </p>
                  <p className="text-xs" style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}>
                    Total Items
                  </p>
                </div>

                <div 
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)' }}
                >
                  <p 
                    className="text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(236 72 153)' : 'rgb(219 39 119)' }}
                  >
                    {selectedUser.current_tasks || 0}/{userTier.max_tasks}
                  </p>
                  <p className="text-xs" style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}>
                    Tasks
                  </p>
                </div>

                <div 
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)' }}
                >
                  <p 
                    className="text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(234 88 12)' }}
                  >
                    {selectedUser.current_custom_recipes || 0}/{userTier.max_custom_recipes}
                  </p>
                  <p className="text-xs" style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}>
                    Custom Recipes
                  </p>
                </div>
              </div>

              {/* Credits Info */}
              <div 
                className="rounded-lg p-4"
                style={{ backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)' }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold" style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}>
                    Monthly Credits
                  </span>
                  <span 
                    className="text-lg font-bold"
                    style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(234 88 12)' }}
                  >
                    {(selectedUser.monthly_credits_total || 0) - (selectedUser.credits_used_this_month || 0)}/{selectedUser.monthly_credits_total || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade Options */}
          <Card 
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <CardHeader>
              <CardTitle style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}>
                Change Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allTiers.map((tier) => {
                  const TierIcon = tierIcons[tier.tier_name] || Package;
                  const isCurrentTier = tier.tier_name === selectedUser.subscription_tier;
                  
                  return (
                    <div
                      key={tier.id}
                      className={cn(
                        "rounded-lg border-2 p-4 transition-all",
                        isCurrentTier && "border-blue-500 dark:border-blue-400"
                      )}
                      style={{
                        backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)',
                        borderColor: isCurrentTier ? '' : (isDarkMode ? 'rgb(71 85 105)' : 'rgb(203 213 225)')
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center", tierColors[tier.tier_name])}>
                          <TierIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold" style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}>
                            {tier.display_name}
                          </h3>
                          <p className="text-sm" style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}>
                            ${tier.price_per_month.toFixed(2)}/month
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 mb-3 text-sm">
                        <p style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          {tier.max_shopping_lists} Lists • {tier.max_total_items} Items
                        </p>
                        <p style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          {tier.max_tasks} Tasks • {tier.max_custom_recipes} Recipes
                        </p>
                        <p style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          {tier.monthly_credits} Credits/month
                        </p>
                      </div>

                      <Button
                        onClick={() => handleUpgrade(tier.tier_name)}
                        disabled={isCurrentTier || upgrading}
                        className={cn(
                          "w-full",
                          isCurrentTier 
                            ? "bg-slate-400 cursor-not-allowed" 
                            : "bg-gradient-to-r hover:shadow-lg " + tierColors[tier.tier_name]
                        )}
                      >
                        {upgrading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Upgrading...
                          </>
                        ) : isCurrentTier ? (
                          "Current Plan"
                        ) : (
                          `Change to ${tier.display_name}`
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}