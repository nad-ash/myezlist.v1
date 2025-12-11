import React, { useState, useEffect } from "react";
import { User, ActivityTracking } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdvancedActivityTrackingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [timeframe, setTimeframe] = useState('1');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activities, setActivities] = useState({});

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
    if (!isAuthChecking) {
      loadActivities();
    }
  }, [timeframe, isAuthChecking]);

  const checkAuth = async () => {
    try {
      const currentUser = await User.me();

      if (currentUser.role !== 'admin') {
        alert("Access denied. Admin privileges required.");
        navigate(createPageUrl("Home"));
        return;
      }

      setIsAuthChecking(false);
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("AdvancedActivityTracking"));
    }
  };

  const getDaysAgo = () => {
    if (timeframe === 'all') return null;
    const days = parseInt(timeframe);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const loadActivities = async () => {
    setLoading(true);
    try {
      const cutoffDate = getDaysAgo();
      
      const recentActivities = cutoffDate
        ? await ActivityTracking.filter({
            timestamp: { $gte: cutoffDate }
          })
        : await ActivityTracking.list();

      const grouped = {};
      recentActivities.forEach(activity => {
        const name = activity.operation_name;
        grouped[name] = (grouped[name] || 0) + 1;
      });

      // Debug: Log all unique operation names found in database
      console.log('📊 Activity Tracking - All operation names in database:', Object.keys(grouped));
      console.log('📊 Activity Tracking - Grouped counts:', grouped);

      setActivities(grouped);
    } catch (error) {
      console.error("Error loading activities:", error);
    }
    setLoading(false);
  };

  const timeframes = [
    { value: '1', label: '1d' },
    { value: '7', label: '7d' },
    { value: '30', label: '30d' },
    { value: 'all', label: 'All Time' },
  ];

  // Operation names must match EXACTLY with trackingContext.js OPERATIONS
  const operationGroups = [
    {
      title: "Shopping Lists",
      operations: [
        "Create New Shopping List",
        "Delete Shopping List",
        "Share Shopping List",
        "Join List via Link",
        "Bulk Import Items",
        "Create List via Import"
      ]
    },
    {
      title: "List Items",
      operations: [
        "Add New Item to List",
        "Edit Item Details",
        "Delete Item from List",
        "Archive Item in List",
        "Activate Item in List",
        "Mark Item as Favorite",
        "Remove Item from Favorite",
        "Complete Item in Shopping",
        "Activate Item in Shopping",
        "Complete All Items in Shopping"
      ]
    },
    {
      title: "Recipes",
      operations: [
        "Create New Recipe",
        "Update Custom Recipe",
        "Save Customized Recipe",
        "Add Recipe as Favorite",
        "Remove Recipe from Favorite"
      ]
    },
    {
      title: "Tasks",
      operations: [
        "Create New Todo",
        "Update Todo Details",
        "Delete Todo",
        "Complete Todo",
        "Reactivate Todo"
      ]
    }
  ];

  if (isAuthChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Analytics"))}
            className="dark:text-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
              Advanced Activity Tracking
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1">
              Detailed breakdown of all operations
            </p>
          </div>
        </div>
      </div>

      {/* Timeframe Filter */}
      <Card
        className="mb-4 sm:mb-6 md:mb-8"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <CardTitle
                  className="text-base sm:text-lg md:text-xl"
                  style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}
                >
                  Activity Period
                </CardTitle>
              </div>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            </div>
            <div className="flex gap-2 flex-wrap">
              {timeframes.map((tf) => (
                <Badge
                  key={tf.value}
                  variant={timeframe === tf.value ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-xs sm:text-sm px-2 sm:px-3 py-1",
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
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Activity Groups */}
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {operationGroups.map((group) => (
          <Card
            key={group.title}
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <CardHeader className="p-3 sm:p-4 md:p-6 border-b" style={{ borderColor: isDarkMode ? 'rgb(71 85 105)' : '' }}>
              <CardTitle
                className="text-base sm:text-lg md:text-xl"
                style={{ color: isDarkMode ? 'rgb(248 250 252)' : '' }}
              >
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
                {group.operations.map((operation) => (
                  <div
                    key={operation}
                    className="rounded-lg p-2.5 sm:p-3 md:p-4"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <p
                      className="text-xs sm:text-sm mb-0.5 sm:mb-1 line-clamp-2"
                      style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                    >
                      {operation}
                    </p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {activities[operation] || 0}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}