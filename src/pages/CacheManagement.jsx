import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowLeft,
  User as UserIcon,
  Crown,
  Loader2,
  Settings as SettingsIcon,
  Save,
  Zap,
  ChefHat,
  ShoppingCart,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appCache } from "@/components/utils/appCache";
import { User } from "@/api/entities";

export default function CacheManagementPage() {
  const navigate = useNavigate();
  const [cacheStatus, setCacheStatus] = useState({
    user: null,
    subscriptionTiers: null,
    premiumFeatures: null,
    recipes: null,
    shoppingLists: null,
    recipeFavorites: null
  });
  const [cacheDurations, setCacheDurations] = useState({
    user: 60,
    subscriptionTiers: 60,
    premiumFeatures: 60,
    recipes: 60,
    shoppingLists: 60,
    recipeFavorites: 60
  });
  const [editingDurations, setEditingDurations] = useState({
    user: 60,
    subscriptionTiers: 60,
    premiumFeatures: 60,
    recipes: 60,
    shoppingLists: 60,
    recipeFavorites: 60
  });
  const [cacheEnabled, setCacheEnabled] = useState({
    user: true,
    subscriptionTiers: true,
    premiumFeatures: true,
    recipes: true,
    shoppingLists: true,
    recipeFavorites: true
  });
  const [editingEnabled, setEditingEnabled] = useState({
    user: true,
    subscriptionTiers: true,
    premiumFeatures: true,
    recipes: true,
    shoppingLists: true,
    recipeFavorites: true
  });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    checkAuth();
    loadCacheDurations();
    loadCacheEnabled();
    loadCacheStatus();

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
      const user = await User.me();
      setCurrentUser(user);
      
      if (user.role !== 'admin') {
        navigate(createPageUrl("Home"));
      }
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("Admin"));
    }
  };

  const loadCacheDurations = () => {
    const durations = appCache.getAllCacheDurations();
    const durationsInMinutes = {
      user: Math.floor(durations.user / (60 * 1000)),
      subscriptionTiers: Math.floor(durations.subscriptionTiers / (60 * 1000)),
      premiumFeatures: Math.floor(durations.premiumFeatures / (60 * 1000)),
      recipes: Math.floor(durations.recipes / (60 * 1000)),
      shoppingLists: Math.floor(durations.shoppingLists / (60 * 1000)),
      recipeFavorites: Math.floor(durations.recipeFavorites / (60 * 1000))
    };
    setCacheDurations(durationsInMinutes);
    setEditingDurations(durationsInMinutes);
  };

  const loadCacheEnabled = () => {
    const enabled = appCache.getAllCacheEnabled();
    setCacheEnabled(enabled);
    setEditingEnabled(enabled);
  };

  const loadCacheStatus = () => {
    setLoading(true);
    setRefreshing(true);
    
    try {
      const userCache = localStorage.getItem('app_cache_user');
      const tiersCache = localStorage.getItem('app_cache_subscription_tiers');
      const featuresCache = localStorage.getItem('app_cache_premium_features');
      const recipesCache = localStorage.getItem('app_cache_recipes');
      
      let shoppingListsCount = 0;
      let shoppingListsSize = 0;
      const shoppingListDetails = [];
      let recipeFavoritesCount = 0;
      let recipeFavoritesSize = 0;
      const recipeFavoritesDetails = [];
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('app_cache_shopping_list_')) {
          shoppingListsCount++;
          const item = localStorage.getItem(key);
          if (item) {
            shoppingListsSize += new Blob([item]).size;
            try {
              const parsed = JSON.parse(item);
              const listId = key.replace('app_cache_shopping_list_', '');
              shoppingListDetails.push({
                id: listId,
                listName: parsed.data?.list?.name || 'Unknown List',
                timestamp: parsed.timestamp,
                size: new Blob([item]).size,
                itemCount: parsed.data?.items?.length || 0
              });
            } catch (e) {
              console.error('Error parsing shopping list cache:', e);
            }
          }
        }
        if (key.startsWith('app_cache_recipe_favorites_')) {
          recipeFavoritesCount++;
          const item = localStorage.getItem(key);
          if (item) {
            recipeFavoritesSize += new Blob([item]).size;
            try {
              const parsed = JSON.parse(item);
              const userId = key.replace('app_cache_recipe_favorites_', '');
              recipeFavoritesDetails.push({
                userId: userId,
                timestamp: parsed.timestamp,
                size: new Blob([item]).size,
                favoriteCount: parsed.data?.length || 0
              });
            } catch (e) {
              console.error('Error parsing recipe favorites cache:', e);
            }
          }
        }
      });
      
      const status = {
        user: parseCache(userCache, 'user'),
        subscriptionTiers: parseCache(tiersCache, 'subscriptionTiers'),
        premiumFeatures: parseCache(featuresCache, 'premiumFeatures'),
        recipes: parseCache(recipesCache, 'recipes'),
        shoppingLists: { 
          exists: shoppingListsCount > 0, 
          count: shoppingListsCount,
          size: shoppingListsSize,
          details: shoppingListDetails
        },
        recipeFavorites: { 
          exists: recipeFavoritesCount > 0, 
          count: recipeFavoritesCount,
          size: recipeFavoritesSize,
          details: recipeFavoritesDetails
        }
      };
      
      setCacheStatus(status);
    } catch (error) {
      console.error("Error loading cache status:", error);
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  const parseCache = (cacheString, cacheType) => {
    if (!cacheString) {
      return {
        exists: false,
        data: null,
        timestamp: null,
        expiresAt: null,
        isExpired: false,
        size: 0
      };
    }

    try {
      const parsed = JSON.parse(cacheString);
      const timestamp = parsed.timestamp;
      const duration = appCache.getCacheDuration(cacheType);
      const expiresAt = timestamp + duration;
      const now = Date.now();
      const isExpired = now > expiresAt;
      
      return {
        exists: true,
        data: parsed.data,
        timestamp,
        expiresAt,
        isExpired,
        size: new Blob([cacheString]).size,
        timeRemaining: isExpired ? 0 : Math.floor((expiresAt - now) / 1000)
      };
    } catch (error) {
      return {
        exists: false,
        data: null,
        timestamp: null,
        expiresAt: null,
        isExpired: false,
        size: 0,
        error: error.message
      };
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Expired';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDuration = (minutes) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    
    return parts.length > 0 ? parts.join(' ') : '0m';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const handleClearCache = async (cacheType) => {
    setClearing(cacheType);
    
    try {
      if (cacheType === 'user') {
        appCache.clearUser();
      } else if (cacheType === 'subscriptionTiers') {
        localStorage.removeItem('app_cache_subscription_tiers');
      } else if (cacheType === 'premiumFeatures') {
        appCache.clearPremiumFeatures();
      } else if (cacheType === 'recipes') {
        appCache.clearRecipes();
      } else if (cacheType === 'shoppingLists') {
        appCache.clearAllShoppingLists();
      } else if (cacheType === 'recipeFavorites') {
        appCache.clearRecipeFavorites();
      } else if (cacheType === 'all') {
        appCache.clearAll();
      }
      
      setTimeout(() => {
        loadCacheStatus();
        setClearing(null);
      }, 500);
    } catch (error) {
      console.error("Error clearing cache:", error);
      setClearing(null);
    }
  };

  const handleSaveDurations = async () => {
    setSaving(true);
    try {
      const maxMinutes = 30 * 24 * 60;
      
      const cacheKeys = ['user', 'subscriptionTiers', 'premiumFeatures', 'recipes', 'shoppingLists', 'recipeFavorites'];
      for (const key of cacheKeys) {
        if (editingEnabled[key]) {
          const duration = parseInt(editingDurations[key]);
          if (isNaN(duration) || duration < 1 || duration > maxMinutes) {
            alert(`${key.charAt(0).toUpperCase() + key.slice(1)} cache duration must be between 1 minute and ${maxMinutes} minutes (30 days)`);
            setSaving(false);
            return;
          }
        }
      }
      
      cacheKeys.forEach(key => {
        appCache.setCacheDuration(key, parseInt(editingDurations[key]));
        appCache.setCacheEnabled(key, editingEnabled[key]);
      });
      
      setCacheDurations({...editingDurations});
      setCacheEnabled({...editingEnabled});
      
      loadCacheStatus();
      
      alert('Cache settings updated successfully!');
    } catch (error) {
      console.error("Error saving cache settings:", error);
      alert('Failed to save cache settings. Please try again.');
    }
    setSaving(false);
  };

  const hasUnsavedChanges = () => {
    return editingDurations.user !== cacheDurations.user || 
           editingDurations.subscriptionTiers !== cacheDurations.subscriptionTiers ||
           editingDurations.premiumFeatures !== cacheDurations.premiumFeatures ||
           editingDurations.recipes !== cacheDurations.recipes ||
           editingDurations.shoppingLists !== cacheDurations.shoppingLists ||
           editingDurations.recipeFavorites !== cacheDurations.recipeFavorites ||
           editingEnabled.user !== cacheEnabled.user ||
           editingEnabled.subscriptionTiers !== cacheEnabled.subscriptionTiers ||
           editingEnabled.premiumFeatures !== cacheEnabled.premiumFeatures ||
           editingEnabled.recipes !== cacheEnabled.recipes ||
           editingEnabled.shoppingLists !== cacheEnabled.shoppingLists ||
           editingEnabled.recipeFavorites !== cacheEnabled.recipeFavorites;
  };

  if (loading || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading cache status...</p>
      </div>
    );
  }

  // Divide cache entries into two sections
  const systemWideCacheEntries = [
    {
      key: 'subscriptionTiers',
      name: 'Subscription Tiers',
      description: 'Cached subscription plan configurations',
      icon: Crown,
      color: 'from-purple-500 to-pink-600',
      status: cacheStatus.subscriptionTiers
    },
    {
      key: 'premiumFeatures',
      name: 'Premium Features',
      description: 'Cached premium feature configurations',
      icon: Zap,
      color: 'from-amber-500 to-orange-600',
      status: cacheStatus.premiumFeatures
    },
    {
      key: 'recipes',
      name: 'Recipes',
      description: 'Cached recipe data for faster browsing',
      icon: ChefHat,
      color: 'from-green-500 to-emerald-600',
      status: cacheStatus.recipes
    }
  ];

  const userLevelCacheEntries = [
    {
      key: 'user',
      name: 'User Data',
      description: 'Cached user profile and authentication data',
      icon: UserIcon,
      color: 'from-blue-500 to-indigo-600',
      status: cacheStatus.user
    },
    {
      key: 'shoppingLists',
      name: 'Shopping Lists',
      description: `Individual list caches (${cacheStatus.shoppingLists.count} lists)`,
      icon: ShoppingCart,
      color: 'from-cyan-500 to-blue-600',
      status: cacheStatus.shoppingLists,
      isPerItem: true
    },
    {
      key: 'recipeFavorites',
      name: 'Recipe Favorites',
      description: `Cached recipe favorites (${cacheStatus.recipeFavorites.count} users)`,
      icon: ChefHat,
      color: 'from-pink-500 to-rose-600',
      status: cacheStatus.recipeFavorites,
      isUserSpecific: true
    }
  ];

  const totalSize = (cacheStatus.user?.size || 0) + (cacheStatus.subscriptionTiers?.size || 0) + (cacheStatus.premiumFeatures?.size || 0) + (cacheStatus.recipes?.size || 0) + (cacheStatus.shoppingLists?.size || 0) + (cacheStatus.recipeFavorites?.size || 0);
  const allCacheEntries = [...systemWideCacheEntries, ...userLevelCacheEntries];
  const activeCaches = allCacheEntries.filter(entry => entry.status?.exists && !entry.status?.isExpired && cacheEnabled[entry.key]).length;

  const renderCacheDurationInput = (cacheKey, label) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label htmlFor={`${cacheKey}-enabled-input`} className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`${cacheKey}-enabled`}
            checked={editingEnabled[cacheKey]}
            onChange={(e) => setEditingEnabled({
              ...editingEnabled,
              [cacheKey]: e.target.checked
            })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <Label 
            htmlFor={`${cacheKey}-enabled`}
            className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
          >
            Enabled
          </Label>
        </div>
      </div>
      <Input
        type="number"
        min="1"
        max="43200"
        id={`${cacheKey}-enabled-input`}
        value={editingDurations[cacheKey]}
        onChange={(e) => setEditingDurations({
          ...editingDurations,
          [cacheKey]: parseInt(e.target.value) || 1
        })}
        disabled={!editingEnabled[cacheKey]}
        className={cn(
          "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600",
          !editingEnabled[cacheKey] && "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
        )}
      />
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Current: {cacheEnabled[cacheKey] ? formatDuration(cacheDurations[cacheKey]) : 'Disabled'} • Range: 1 min - 30 days
      </p>
    </div>
  );

  const renderCacheEntry = (entry) => {
    const Icon = entry.icon;
    const status = entry.status;
    const isMultiEntryCache = entry.isPerItem || entry.isUserSpecific;
    const isEnabled = cacheEnabled[entry.key];

    return (
      <Card
        key={entry.key}
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
        }}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={cn("w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", entry.color)}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-800 dark:text-slate-100 mb-1">
                  {entry.name}
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {entry.description}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isEnabled ? `Duration: ${formatDuration(cacheDurations[entry.key])}` : 'Cache Disabled'}
                </p>
              </div>
            </div>
            {!isEnabled ? (
              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <XCircle className="w-3 h-3 mr-1" />
                Disabled
              </Badge>
            ) : isMultiEntryCache ? (
              status?.exists ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {status.count} Active
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <XCircle className="w-3 h-3 mr-1" />
                  Empty
                </Badge>
              )
            ) : (
              status?.exists && !status?.isExpired ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : status?.exists && status?.isExpired ? (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <Clock className="w-3 h-3 mr-1" />
                  Expired
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <XCircle className="w-3 h-3 mr-1" />
                  Empty
                </Badge>
              )
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isMultiEntryCache ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Size</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatBytes(status?.size || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cached At</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatDate(status?.timestamp)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Expires At</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatDate(status?.expiresAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Time Remaining</p>
                  <p className={cn(
                    "text-sm font-semibold",
                    status?.isExpired ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {formatTime(status?.timeRemaining || 0)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="mb-4">
              <div className="mb-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {entry.isPerItem ? 'Item-specific cache.' : 'User-specific cache.'} <span className="font-semibold">{status?.count || 0}</span> individual cache entries exist.
                  Total size across all entries: <span className="font-semibold">{formatBytes(status?.size || 0)}</span>.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Individual entries expire based on their own duration, but are cleared when relevant user actions occur.
                </p>
              </div>
              
              {status?.details && status.details.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Your Cached {entry.name}:
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {status.details.map((detail, idx) => {
                      const duration = appCache.getCacheDuration(entry.key);
                      const expiresAt = detail.timestamp + duration;
                      const now = Date.now();
                      const isExpired = now > expiresAt;
                      const timeRemaining = isExpired ? 0 : Math.floor((expiresAt - now) / 1000);
                      
                      return (
                        <div 
                          key={idx} 
                          className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50"
                          style={{
                            borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {entry.key === 'shoppingLists' ? detail.listName : `User: ${detail.userId.substring(0, 8)}...`}
                              </p>
                              {entry.key === 'shoppingLists' && (
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {detail.itemCount} items cached
                                </p>
                              )}
                              {entry.key === 'recipeFavorites' && (
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {detail.favoriteCount} favorites cached
                                </p>
                              )}
                            </div>
                            <Badge 
                              className={cn(
                                "text-xs flex-shrink-0",
                                isExpired ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              )}
                            >
                              {isExpired ? 'Expired' : 'Active'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Size: </span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatBytes(detail.size)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Cached: </span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatDate(detail.timestamp)}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-500 dark:text-slate-400">Time remaining: </span>
                              <span className={cn(
                                "font-medium",
                                isExpired ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                              )}>
                                {formatTime(timeRemaining)}
                                </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {status?.exists && (
            <Button
              onClick={() => handleClearCache(entry.key)}
              disabled={clearing === entry.key}
              variant="outline"
              size="sm"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              {clearing === entry.key ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Clear {isMultiEntryCache ? 'All' : 'Cache'}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("Admin"))}
          className="flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 break-words">
                Cache Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Monitor and manage cache
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={loadCacheStatus}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-2 flex-shrink-0"
          style={{
            backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'white',
            color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
          }}
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Active Caches</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {activeCaches} / 6
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Size</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {formatBytes(totalSize)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Duration Settings */}
      <Card
        className="mb-8"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
        }}
      >
        <CardHeader>
          <CardTitle className="text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Cache Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* System Wide Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">System Wide Caches</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-7">
              {renderCacheDurationInput('subscriptionTiers', 'Subscription Tiers Cache')}
              {renderCacheDurationInput('premiumFeatures', 'Premium Features Cache')}
              {renderCacheDurationInput('recipes', 'Recipes Cache')}
            </div>
          </div>

          {/* User Level Section */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">User Level Caches</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-7">
              {renderCacheDurationInput('user', 'User Cache')}
              {renderCacheDurationInput('shoppingLists', 'Shopping Lists Cache')}
              {renderCacheDurationInput('recipeFavorites', 'Recipe Favorites Cache')}
            </div>
          </div>
          
          {hasUnsavedChanges() && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg mb-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                You have unsaved changes. Click "Save Settings" to apply them.
              </p>
            </div>
          )}
          
          <Button
            onClick={handleSaveDurations}
            disabled={saving || !hasUnsavedChanges()}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* System Wide Cache Entries */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">System Wide Caches</h2>
        </div>
        <div className="space-y-4">
          {systemWideCacheEntries.map(renderCacheEntry)}
        </div>
      </div>

      {/* User Level Cache Entries */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">User Level Caches</h2>
        </div>
        <div className="space-y-4">
          {userLevelCacheEntries.map(renderCacheEntry)}
        </div>
      </div>

      {/* Danger Zone */}
      <Card
        className="border-2"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
          borderColor: isDarkMode ? 'rgb(127 29 29)' : 'rgb(254 202 202)'
        }}
      >
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                Clear All Cache
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This will immediately clear all cached data. Users will need to re-authenticate.
              </p>
            </div>
            <Button
              onClick={() => {
                if (confirm("Are you sure you want to clear ALL cache? This action cannot be undone.")) {
                  handleClearCache('all');
                }
              }}
              disabled={clearing === 'all'}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {clearing === 'all' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Clear All Cache
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card
        className="mt-6"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'rgb(239 246 255)',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(191 219 254)'
        }}
      >
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Cache Information
          </h3>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <li>• <strong>System Wide Caches:</strong> Shared across all users (Subscription Tiers, Premium Features, Recipes)</li>
            <li>• <strong>User Level Caches:</strong> Specific to individual users (User Data, Shopping Lists, Recipe Favorites)</li>
            <li>• <strong>User Data:</strong> Cached to reduce authentication API calls. Automatically invalidated when credits are consumed or refunded.</li>
            <li>• <strong>Subscription Tiers:</strong> Cached as tier configurations rarely change.</li>
            <li>• <strong>Premium Features:</strong> Cached feature configurations for faster access to premium feature details.</li>
            <li>• <strong>Recipes:</strong> Cached recipe data to improve browsing performance and reduce database queries.</li>
            <li>• <strong>Shopping Lists:</strong> Item-specific caches for shopping list data. Improves load times in ShoppingMode and ManageLists pages.</li>
            <li>• <strong>Recipe Favorites:</strong> User-specific caches for recipe favorites. Reduces API calls when browsing recipes.</li>
            <li>• <strong>Custom Durations:</strong> Set cache durations between 1 minute and 43,200 minutes (30 days) for each cache type.</li>
            <li>• <strong>Enable/Disable:</strong> Toggle caches on/off. When disabled, API calls bypass cache and always fetch fresh data.</li>
            <li>• <strong>Automatic Expiration:</strong> Cache entries expire based on their configured duration and are automatically refreshed on next access.</li>
            <li>• <strong>Cache Invalidation:</strong> Caches are cleared on relevant actions (logout, credit transactions, list/item changes) to ensure data accuracy.</li>
            <li>• <strong>Performance Impact:</strong> Proper caching reduces API calls by ~70% and improves page load times significantly.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}