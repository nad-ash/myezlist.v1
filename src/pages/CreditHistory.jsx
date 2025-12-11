
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Zap, 
  TrendingDown, 
  TrendingUp, 
  Loader2,
  History,
  Calendar
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { getCreditHistory } from "@/components/utils/creditManager";

export default function CreditHistoryPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadData();
    
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

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const history = await getCreditHistory(100);
      setTransactions(history);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  // Format date in user's local timezone
  const formatLocalDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format time in user's local timezone
  const formatLocalTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Format date and time together
  const formatLocalDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading credit history...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-red-600">Error loading user data. Please refresh the page.</p>
      </div>
    );
  }

  const creditsRemaining = (user.monthly_credits_total || 0) - (user.credits_used_this_month || 0);
  const creditsPercentage = ((creditsRemaining / (user.monthly_credits_total || 1)) * 100);

  // Group transactions by date (using local date)
  const groupedTransactions = transactions.reduce((groups, tx) => {
    const date = formatLocalDate(tx.created_date);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(tx);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => {
    // Parse the formatted date strings back to dates for sorting
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB - dateA;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("Settings"))}
          className="dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Credit History</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Track your premium feature usage</p>
        </div>
      </div>

      {/* Credits Overview Card */}
      <Card 
        className="mb-8"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-slate-100">
            <Zap className="w-5 h-5 text-amber-500" />
            Current Month Credits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Credits Remaining
              </span>
              <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {creditsRemaining} / {user.monthly_credits_total || 0}
              </span>
            </div>
            <Progress value={creditsPercentage} className="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div 
              className="p-3 rounded-lg"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(243 244 246)'
              }}
            >
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs mb-1">
                <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />
                <span>Used This Month</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {user.credits_used_this_month || 0}
              </p>
            </div>
            <div 
              className="p-3 rounded-lg"
              style={{
                backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(243 244 246)'
              }}
            >
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs mb-1">
                <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span>Resets On</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {user.credits_reset_date ? formatLocalDate(user.credits_reset_date) : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card 
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-slate-100">
            <History className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No transactions yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                Start using premium features to see your credit usage here
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300">{date}</h3>
                  </div>
                  <div className="space-y-2">
                    {groupedTransactions[date].map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-lg border"
                        style={{
                          backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)',
                          borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-800 dark:text-slate-100">
                                {tx.feature_name}
                              </span>
                              <Badge
                                className={cn(
                                  tx.transaction_type === 'consumption'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    : tx.transaction_type === 'refund'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                )}
                              >
                                {tx.transaction_type}
                              </Badge>
                            </div>
                            {tx.description && (
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {tx.description}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                              {formatLocalTime(tx.created_date)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <div className={cn(
                              "text-xl font-bold",
                              tx.credits_consumed > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                            )}>
                              {tx.credits_consumed > 0 ? '-' : '+'}{Math.abs(tx.credits_consumed)}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Zap className="w-3 h-3" />
                              <span>credits</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Back to Settings Button */}
      <div className="mt-6 text-center">
        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl("Settings"))}
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            color: isDarkMode ? 'rgb(226 232 240)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          Back to Settings
        </Button>
      </div>
    </div>
  );
}
