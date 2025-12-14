import React, { useState, useEffect } from "react";
import { User, UserAdmin, Statistics } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, List, Package, Activity, CheckCircle2, Share2, Loader2, ArrowLeft, Database, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { backfillActivityTracking, getActivityStats } from "@/api/functions";

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [timeframe, setTimeframe] = useState('7');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    uniqueUsers: 0,
    totalLists: 0,
    totalItems: 0,
    totalTasks: 0,
    activeUsers: 0,
    listsCreated: 0,
    itemsAdded: 0,
    itemsCompleted: 0,
    listsShared: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    usersByTier: {}
  });

  useEffect(() => {
    checkAuth();

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

  useEffect(() => {
    if (!loading && !isAuthChecking) {
      loadActivityStats();
    }
  }, [timeframe, loading, isAuthChecking]);

  const checkAuth = async () => {
    try {
      const currentUser = await User.me();

      if (currentUser.role !== 'admin') {
        alert("Access denied. Admin privileges required.");
        navigate(createPageUrl("Home"));
        return;
      }

      setUser(currentUser);
      setIsAuthChecking(false);
      loadAnalytics();
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("Analytics"));
    }
  };

  const getDaysAgo = () => {
    if (timeframe === 'all') return null;
    const days = parseInt(timeframe);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch statistics from the Statistics table (efficient - single table with pre-computed counts)
      const allStats = await Statistics.list();
      
      const getStatValue = (key) => {
        const stat = allStats.find(s => s.stat_key === key);
        return stat ? stat.count : 0;
      };

      console.log('📊 Statistics from database:', allStats);

      // Fetch users for tier breakdown (requires admin RLS policy to see all users)
      const allUsers = await UserAdmin.list();
      console.log('📊 Users fetched:', allUsers.length, 'users');

      // Count users by subscription tier from available profiles
      const tierCounts = {};
      allUsers.forEach(user => {
        const tier = user.subscription_tier || 'free';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });

      setStats(prev => ({
        ...prev,
        uniqueUsers: allUsers.length,
        totalLists: getStatValue('total_lists'),
        totalItems: getStatValue('total_items'),
        totalTasks: getStatValue('total_tasks'),
        usersByTier: tierCounts
      }));
    } catch (error) {
      console.error("Error loading analytics:", error);
    }
    setLoading(false);
  };

  const loadActivityStats = async () => {
    setActivityLoading(true);
    try {
      const cutoffDate = getDaysAgo();

      // Use server-side aggregation for scalability (single row returned instead of millions)
      const activityStats = await getActivityStats(cutoffDate);
      
      console.log('📈 Activity stats (server-side aggregation):', activityStats);

      setStats(prev => ({
        ...prev,
        activeUsers: activityStats.active_users || 0,
        listsCreated: activityStats.lists_created || 0,
        itemsAdded: activityStats.items_added || 0,
        itemsCompleted: activityStats.items_completed || 0,
        listsShared: activityStats.lists_shared || 0,
        tasksCreated: activityStats.tasks_created || 0,
        tasksCompleted: activityStats.tasks_completed || 0,
      }));

    } catch (error) {
      console.error("Error loading activity stats:", error);
    }
    setActivityLoading(false);
  };

  const handleBackfill = async () => {
    if (!confirm('This will create ActivityTracking records for all existing data. Continue?')) {
      return;
    }

    setBackfilling(true);
    try {
      const response = await backfillActivityTracking();
      
      if (response.data.success) {
        alert(`Successfully backfilled ${response.data.breakdown.total_records} activity records!`);
        loadActivityStats();
      } else {
        alert('Backfill failed. Check console for details.');
        console.error('Backfill error:', response.data);
      }
    } catch (error) {
      console.error('Error during backfill:', error);
      alert('Failed to backfill activity data. See console for details.');
    }
    setBackfilling(false);
  };

  const timeframes = [
    { value: '1', label: '1d' },
    { value: '7', label: '7d' },
    { value: '30', label: '30d' },
    { value: 'all', label: 'All Time' },
  ];

  const tierInfo = {
    free: { label: 'Free', color: 'text-slate-600 dark:text-slate-400' },
    adfree: { label: 'Ad-Free', color: 'text-blue-600 dark:text-blue-400' },
    pro: { label: 'Pro', color: 'text-purple-600 dark:text-purple-400' },
    premium: { label: 'Premium', color: 'text-amber-600 dark:text-amber-400' },
    admin: { label: 'Admin', color: 'text-red-600 dark:text-red-400' }
  };

  if (isAuthChecking || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          {isAuthChecking ? "Checking authentication..." : "Loading analytics..."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Header with Back Button */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Admin"))}
            className="dark:text-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 truncate">Platform Analytics</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 truncate">Insights and metrics for MyEZList</p>
          </div>
        </div>
        
        <Button
          onClick={handleBackfill}
          disabled={backfilling}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
        >
          {backfilling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Backfilling...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              Backfill Activity Data
            </>
          )}
        </Button>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs sm:text-sm font-medium truncate"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                >
                  Total Users
                </p>
                <p
                  className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2"
                  style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                >
                  {stats.uniqueUsers}
                </p>
              </div>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgb(219 234 254)'
                }}
              >
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs sm:text-sm font-medium truncate"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                >
                  Total Lists
                </p>
                <p
                  className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2"
                  style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                >
                  {stats.totalLists}
                </p>
              </div>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.3)' : 'rgb(243 232 255)'
                }}
              >
                <List className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs sm:text-sm font-medium truncate"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                >
                  Total Items
                </p>
                <p
                  className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2"
                  style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                >
                  {stats.totalItems}
                </p>
              </div>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgb(220 252 231)'
                }}
              >
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs sm:text-sm font-medium truncate"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                >
                  Total Tasks
                </p>
                <p
                  className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2"
                  style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                >
                  {stats.totalTasks}
                </p>
              </div>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(236, 72, 153, 0.3)' : 'rgb(252 231 243)'
                }}
              >
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-pink-600 dark:text-pink-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users by Subscription Tier */}
      <Card
        className="mb-6 sm:mb-8"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <CardTitle
              className="text-lg sm:text-xl"
              style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}
            >
              Users by Subscription Tier
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {Object.entries(tierInfo).map(([tier, info]) => (
              <div
                key={tier}
                className="rounded-lg p-3 sm:p-4"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                }}
              >
                <p
                  className="text-xs sm:text-sm mb-1"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                >
                  {info.label}
                </p>
                <p className={`text-xl sm:text-2xl font-bold ${info.color}`}>
                  {stats.usersByTier[tier] || 0}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Tracking with Timeframe Filter */}
      <Card
        className="mb-6 sm:mb-8"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <CardTitle
                className="text-lg sm:text-xl"
                style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}
              >
                Activity Tracking
              </CardTitle>
              {activityLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400 flex-shrink-0" />
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {timeframes.map((tf) => (
                <Badge
                  key={tf.value}
                  variant={timeframe === tf.value ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer",
                    timeframe === tf.value && "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                  style={timeframe !== tf.value ? {
                    backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
                    color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)',
                    borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(203 213 225)'
                  } : {}}
                  onClick={() => setTimeframe(tf.value)}
                >
                  {tf.label}
                </Badge>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(createPageUrl("AdvancedActivityTracking"))}
                className="ml-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
                  color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)',
                  borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(203 213 225)'
                }}
              >
                View Details
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
              }}
            >
              <p
                className="text-xs sm:text-sm mb-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
              >
                Active Users
              </p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.activeUsers}</p>
            </div>
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
              }}
            >
              <p
                className="text-xs sm:text-sm mb-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
              >
                Lists Created
              </p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.listsCreated}</p>
            </div>
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
              }}
            >
              <p
                className="text-xs sm:text-sm mb-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
              >
                Items Added
              </p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.itemsAdded}</p>
            </div>
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
              }}
            >
              <p
                className="text-xs sm:text-sm mb-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
              >
                Items Completed
              </p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.itemsCompleted}</p>
            </div>
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
              }}
            >
              <p
                className="text-xs sm:text-sm mb-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
              >
                Lists Shared
              </p>
              <p className="text-xl sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.listsShared}</p>
            </div>
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
              }}
            >
              <p
                className="text-xs sm:text-sm mb-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
              >
                Tasks Created
              </p>
              <p className="text-xl sm:text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.tasksCreated}</p>
            </div>
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
              }}
            >
              <p
                className="text-xs sm:text-sm mb-1"
                style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
              >
                Tasks Completed
              </p>
              <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.tasksCompleted}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}