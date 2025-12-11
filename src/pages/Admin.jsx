import React, { useState, useEffect } from "react";
import { User, UserAdmin, Statistics, CommonItem, Recipe, ShoppingList, Item, Todo } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, List, Package, CheckSquare, Settings, ChevronRight, TrendingUp, Database, ChefHat, RefreshCw, Zap, Crown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { syncUserUsage } from "@/components/utils/usageSync";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingUsage, setSyncingUsage] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [analyticsStats, setAnalyticsStats] = useState({
    uniqueUsers: 0,
    totalLists: 0,
    totalItems: 0,
    totalTasks: 0,
  });
  const [masterListStats, setMasterListStats] = useState({
    totalCommonItems: 0,
  });
  const [recipeStats, setRecipeStats] = useState({
    totalCommonRecipes: 0,
    totalUserGeneratedRecipes: 0,
  });

  useEffect(() => {
    checkAuth();
    
    // Check initial theme
    setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    
    // Watch for theme changes
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
      const currentUser = await User.me();
      
      // Check if user is admin
      if (currentUser.role !== 'admin') {
        alert("Access denied. Admin privileges required.");
        navigate(createPageUrl("Home"));
        return;
      }
      
      setUser(currentUser);
      setIsAuthChecking(false);
      loadStats();
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("Admin"));
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const stats = await Statistics.list();
      
      const getStatValue = (key) => {
        const stat = stats.find(s => s.stat_key === key);
        return stat ? stat.count : 0;
      };

      // Fetch users directly (admin RLS policy allows seeing all profiles)
      const allUsers = await UserAdmin.list();

      setAnalyticsStats({
        uniqueUsers: allUsers.length,
        totalLists: getStatValue('total_lists'),
        totalItems: getStatValue('total_items'),
        totalTasks: getStatValue('total_tasks'),
      });

      setMasterListStats({
        totalCommonItems: getStatValue('total_common_items'),
      });

      setRecipeStats({
        totalCommonRecipes: getStatValue('total_common_recipes'),
        totalUserGeneratedRecipes: getStatValue('total_user_generated_recipes'),
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
    setLoading(false);
  };

  const syncStatistics = async () => {
    if (!confirm("This will recalculate all statistics from scratch. Continue?")) {
      return;
    }

    setSyncing(true);
    try {
      const allUsers = await UserAdmin.list();
      const allLists = await ShoppingList.list();
      const allItems = await Item.list();
      const allTodos = await Todo.list();
      const allCommonItems = await CommonItem.list();
      const allRecipes = await Recipe.list();
      
      const adminRecipes = allRecipes.filter(r => !r.is_user_generated);
      const userGeneratedRecipes = allRecipes.filter(r => r.is_user_generated);

      const stats = await Statistics.list();

      const updateOrCreateStat = async (key, count) => {
        const existing = stats.find(s => s.stat_key === key);
        if (existing) {
          await Statistics.update(existing.id, { count });
        } else {
          await Statistics.create({ stat_key: key, count });
        }
      };

      await updateOrCreateStat('total_users', allUsers.length);
      await updateOrCreateStat('total_lists', allLists.length);
      await updateOrCreateStat('total_items', allItems.length);
      await updateOrCreateStat('total_tasks', allTodos.length);
      await updateOrCreateStat('total_common_items', allCommonItems.length);
      await updateOrCreateStat('total_common_recipes', adminRecipes.length);
      await updateOrCreateStat('total_user_generated_recipes', userGeneratedRecipes.length);

      alert("Statistics synchronized successfully!");
      loadStats();
    } catch (error) {
      console.error("Error syncing statistics:", error);
      alert("Failed to sync statistics. Please try again.");
    }
    setSyncing(false);
  };

  const syncAllUsersUsage = async () => {
    if (!confirm("This will sync usage counts for ALL users. This may take a while. Continue?")) {
      return;
    }

    setSyncingUsage(true);
    try {
      const allUsers = await UserAdmin.list();
      let successCount = 0;
      let failCount = 0;

      for (const user of allUsers) {
        try {
          await syncUserUsage(user.id);
          successCount++;
        } catch (error) {
          console.error(`Failed to sync usage for user ${user.id}:`, error);
          failCount++;
        }
      }

      alert(`Usage sync completed!\nSuccessful: ${successCount}\nFailed: ${failCount}`);
    } catch (error) {
      console.error("Error syncing all users usage:", error);
      alert("Failed to sync usage for all users. Please try again.");
    }
    setSyncingUsage(false);
  };

  if (isAuthChecking || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          {isAuthChecking ? "Checking authentication..." : "Loading dashboard..."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Manage your application and view analytics</p>
      </div>

      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
        <Button
          onClick={syncAllUsersUsage}
          disabled={syncingUsage}
          variant="outline"
          className="gap-2 text-sm w-full sm:w-auto"
          style={isDarkMode ? {
            backgroundColor: 'rgb(30 41 59)',
            color: 'rgb(226 232 240)',
            borderColor: 'rgb(71 85 105)'
          } : {}}
        >
          <Users className={cn("w-4 h-4", syncingUsage && "animate-spin")} />
          <span className="hidden sm:inline">{syncingUsage ? "Syncing Usage..." : "Sync All Users Usage"}</span>
          <span className="sm:hidden">{syncingUsage ? "Syncing..." : "Sync Users"}</span>
        </Button>
        <Button
          onClick={syncStatistics}
          disabled={syncing}
          variant="outline"
          className="gap-2 text-sm w-full sm:w-auto"
          style={isDarkMode ? {
            backgroundColor: 'rgb(30 41 59)',
            color: 'rgb(226 232 240)',
            borderColor: 'rgb(71 85 105)'
          } : {}}
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
          <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync Statistics"}</span>
          <span className="sm:hidden">{syncing ? "Syncing..." : "Sync Stats"}</span>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Analytics Section */}
            <Card 
              onClick={() => navigate(createPageUrl("Analytics"))}
              className="col-span-full md:col-span-2 lg:col-span-2 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-400 group"
              style={{
                backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
              }}
            >
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                      <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle 
                        className="text-lg sm:text-xl"
                        style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}
                      >
                        Analytics
                      </CardTitle>
                      <p 
                        className="text-xs sm:text-sm"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                      >
                        Platform insights & metrics
                      </p>
                    </div>
                  </div>
                  <ChevronRight 
                    className="w-5 h-5 sm:w-6 sm:h-6 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0"
                    style={{ color: isDarkMode ? 'rgb(100 116 139)' : 'rgb(148 163 184)' }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div 
                    className="rounded-lg p-2 sm:p-3"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Users 
                        className="w-3 h-3 sm:w-4 sm:h-4"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                      />
                      <span 
                        className="text-xs"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                      >
                        Total Users
                      </span>
                    </div>
                    <p 
                      className="text-xl sm:text-2xl font-bold"
                      style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}
                    >
                      {analyticsStats.uniqueUsers}
                    </p>
                  </div>
                  <div 
                    className="rounded-lg p-2 sm:p-3"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
                      <span 
                        className="text-xs"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                      >
                        Total Tasks
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{analyticsStats.totalTasks}</p>
                  </div>
                  <div 
                    className="rounded-lg p-2 sm:p-3"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <List className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                      <span 
                        className="text-xs"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                      >
                        Total Lists
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{analyticsStats.totalLists}</p>
                  </div>
                  <div 
                    className="rounded-lg p-2 sm:p-3"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <Package className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 dark:text-orange-400" />
                      <span 
                        className="text-xs"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                      >
                        Total Items
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{analyticsStats.totalItems}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600 font-medium group-hover:gap-3 transition-all dark:text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                  View Full Analytics
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Master Item List Section */}
            <Card 
              onClick={() => navigate(createPageUrl("MasterItemList"))}
              className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:border-green-400"
            >
              <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-500" />
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">Master Item List</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Manage common items for shopping lists and recipes
                </p>
              </CardContent>
            </Card>

            {/* Master Recipe List Section */}
            <Card 
              onClick={() => navigate(createPageUrl("MasterRecipeList"))}
              className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:border-orange-400"
            >
              <div className="h-2 bg-gradient-to-r from-orange-400 to-red-500" />
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <ChefHat className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">Master Recipe List</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Manage base recipes and user-generated content
                </p>
              </CardContent>
            </Card>

            {/* Premium Features Section */}
            <Card 
              onClick={() => navigate(createPageUrl("PremiumFeaturesAdmin"))}
              className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:border-purple-400"
            >
              <div className="h-2 bg-gradient-to-r from-purple-400 to-pink-500" />
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">Premium Features</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Configure credit consumption and feature access
                </p>
              </CardContent>
            </Card>

            {/* Subscription Tiers Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white dark:bg-slate-800 border dark:border-slate-700"
              onClick={() => navigate(createPageUrl("ManageSubscriptionTiers"))}
            >
              <div className="h-2 bg-gradient-to-r from-purple-400 to-pink-500" />
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">Subscription Tiers</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Configure pricing, limits, and features for subscription plans
                </p>
              </CardContent>
            </Card>

            {/* Cache Management Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:border-cyan-400"
              onClick={() => navigate(createPageUrl("CacheManagement"))}
            >
              <div className="h-2 bg-gradient-to-r from-cyan-400 to-blue-500" />
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">Cache Management</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Monitor and manage application cache performance
                </p>
              </CardContent>
            </Card>

            {/* User Management Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:border-indigo-400"
              onClick={() => navigate(createPageUrl("UserManagement"))}
            >
              <div className="h-2 bg-gradient-to-r from-indigo-400 to-blue-500" />
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">User Management</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  View user details and manage subscription plans
                </p>
              </CardContent>
            </Card>
          </div>
    </div>
  );
}