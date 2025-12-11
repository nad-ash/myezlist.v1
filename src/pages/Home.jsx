import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ShoppingCart, 
  CheckCircle2, 
  ChefHat, 
  ArrowRight,
  Crown,
  Package,
  Zap,
  Settings,
  Loader2
} from "lucide-react";
import { User, SubscriptionTier } from "@/api/entities";
import { cn } from "@/lib/utils";
import { appCache } from "@/components/utils/appCache";

export default function HomePage() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userTier, setUserTier] = useState(null);

  useEffect(() => {
    loadUserAndTier();
    
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

  const loadUserAndTier = async () => {
    try {
      // ALWAYS fetch fresh user from API first
      console.log('🔄 Home: Fetching user from API');
      const currentUser = await User.me();
      
      // Check if cached user exists and if it's the same user
      const cachedUser = appCache.getUser();
      if (cachedUser && cachedUser.id !== currentUser.id) {
        console.log('⚠️ Home: Different user detected! Clearing all cache');
        console.log('Old user ID:', cachedUser.id, 'New user ID:', currentUser.id);
        appCache.clearAll();
      }
      
      // Cache the fresh user data
      appCache.setUser(currentUser);
      setUser(currentUser);
      
      // Now load subscription tiers (can use cache for this)
      let allTiers = appCache.getSubscriptionTiers();
      if (!allTiers) {
        console.log('🔄 Home: Fetching subscription tiers from API (cache miss)');
        allTiers = await SubscriptionTier.list();
        appCache.setSubscriptionTiers(allTiers);
      } else {
        console.log('📦 Home: Using cached subscription tiers');
      }
      
      // Check if user needs tier assignment
      if (!currentUser.subscription_tier || currentUser.subscription_tier === '') {
        const freeTier = allTiers.find(t => t.tier_name === 'free');
        
        if (freeTier) {
          // Assign free tier to new user
          const updates = {
            subscription_tier: 'free',
            subscription_start_date: new Date().toISOString(),
            monthly_credits_total: freeTier.monthly_credits,
            credits_used_this_month: 0,
            credits_reset_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
          };
          
          await User.updateMe(updates);
          
          // Update local state and cache
          currentUser.subscription_tier = 'free';
          Object.assign(currentUser, updates);
          setUser({...currentUser});
          appCache.updateUser(updates);
          setUserTier(freeTier);
        }
      } else {
        // User already has a tier, find it from cached list
        const currentTier = allTiers.find(t => t.tier_name === currentUser.subscription_tier);
        if (currentTier) {
          setUserTier(currentTier);
        }
      }
    } catch (error) {
      console.log("User not logged in, redirecting to Landing");
      navigate(createPageUrl("Landing"), { replace: true });
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleFeatureClick = (pageName) => {
    navigate(createPageUrl(pageName));
  };

  const features = [
    {
      icon: ShoppingCart,
      title: "Smart Shopping",
      description: "Create and manage shopping lists with AI-powered features. Share with family, categorize items, and shop smarter.",
      gradient: "from-blue-500 to-indigo-600",
      action: "Go to Shopping",
      page: "ShoppingMode"
    },
    {
      icon: CheckCircle2,
      title: "Task Management",
      description: "Stay organized with powerful task management. Set priorities, due dates, and categories to get things done.",
      gradient: "from-green-500 to-emerald-600",
      action: "Manage Tasks",
      page: "Todos"
    },
    {
      icon: ChefHat,
      title: "Recipe Collection",
      description: "Discover delicious recipes, save your favorites, and create custom recipes. Get AI-generated cooking instructions.",
      gradient: "from-orange-500 to-red-600",
      action: "Browse Recipes",
      page: "Recipe"
    }
  ];

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

  if (isLoadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Welcome Section for logged-in users */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20"
          style={{
            backgroundImage: isDarkMode 
              ? 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)'
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
          {/* Compact Welcome Message */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 
              className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2"
              style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
            >
              Welcome back,
            </h1>
            <p 
              className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4"
              style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }}
            >
              {user.full_name?.split(' ')[0] || 'there'}! 👋
            </p>
            <p 
              className="text-sm sm:text-lg"
              style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
            >
              Ready to organize your day?
            </p>
          </div>

          {/* Quick Actions Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="group relative overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer border-2"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
                    borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
                  }}
                  onClick={() => handleFeatureClick(feature.page)}
                >
                  <div className={cn("h-2 bg-gradient-to-r", feature.gradient)} />
                  
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform", feature.gradient)}>
                        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <h3 
                        className="text-lg sm:text-xl font-bold"
                        style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}
                      >
                        {feature.title}
                      </h3>
                    </div>
                    
                    <p 
                      className="mb-4 sm:mb-6 min-h-[50px] sm:min-h-[60px] text-sm sm:text-base"
                      style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                    >
                      {feature.description}
                    </p>
                    
                    <Button
                      className={cn("w-full gap-2 bg-gradient-to-r hover:shadow-lg transition-all text-sm sm:text-base", feature.gradient)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFeatureClick(feature.page);
                      }}
                    >
                      {feature.action}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Current Plan Card */}
          {userTier && (
            <Card 
              className="max-w-4xl mx-auto overflow-hidden hover:shadow-2xl transition-all border-2"
              style={{
                backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
              }}
            >
              <div className={cn("h-3 bg-gradient-to-r", tierColors[userTier.tier_name])} />
              <CardContent className="p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {React.createElement(tierIcons[userTier.tier_name] || Package, {
                      className: "w-12 h-12 sm:w-16 sm:h-16 p-2 sm:p-3 rounded-xl bg-gradient-to-br shadow-lg " + tierColors[userTier.tier_name],
                      style: { color: 'white' }
                    })}
                    <div>
                      <p 
                        className="text-xs sm:text-sm"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                      >
                        Your Current Plan
                      </p>
                      <h2 
                        className="text-2xl sm:text-3xl font-bold"
                        style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                      >
                        {userTier.display_name}
                      </h2>
                      <p 
                        className="text-xs sm:text-sm mt-1"
                        style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                      >
                        ${userTier.price_per_month.toFixed(2)}/month
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(createPageUrl("Settings"))}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2 w-full sm:w-auto"
                  >
                    <Settings className="w-4 h-4" />
                    Manage Plan
                  </Button>
                </div>

                {/* Plan Features */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div 
                    className="rounded-lg p-3 sm:p-4 text-center"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <p 
                      className="text-xl sm:text-2xl font-bold mb-1"
                      style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }}
                    >
                      {userTier.max_shopping_lists}
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                    >
                      Shopping Lists
                    </p>
                  </div>
                  <div 
                    className="rounded-lg p-3 sm:p-4 text-center"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <p 
                      className="text-xl sm:text-2xl font-bold mb-1"
                      style={{ color: isDarkMode ? 'rgb(34 197 94)' : 'rgb(22 163 74)' }}
                    >
                      {userTier.max_total_items}
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                    >
                      Total Items
                    </p>
                  </div>
                  <div 
                    className="rounded-lg p-3 sm:p-4 text-center"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <p 
                      className="text-xl sm:text-2xl font-bold mb-1"
                      style={{ color: isDarkMode ? 'rgb(236 72 153)' : 'rgb(219 39 119)' }}
                    >
                      {userTier.max_tasks}
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                    >
                      Tasks
                    </p>
                  </div>
                  <div 
                    className="rounded-lg p-3 sm:p-4 text-center"
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                    }}
                  >
                    <p 
                      className="text-xl sm:text-2xl font-bold mb-1"
                      style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(234 88 12)' }}
                    >
                      {userTier.monthly_credits}
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                    >
                      Credits/month
                    </p>
                  </div>
                </div>

                {/* Upgrade Prompt for non-Premium users */}
                {userTier.tier_name !== 'premium' && userTier.tier_name !== 'admin' && (
                  <div 
                    className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg border"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(126, 34, 206, 0.15)' : 'rgb(250 245 255)',
                      borderColor: isDarkMode ? 'rgb(126 34 206)' : 'rgb(233 213 255)'
                    }}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                      <div className="flex items-start sm:items-center gap-3">
                        <Crown 
                          className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5 sm:mt-0"
                          style={{ color: isDarkMode ? 'rgb(216 180 254)' : 'rgb(147 51 234)' }}
                        />
                        <div>
                          <p 
                            className="font-semibold text-sm sm:text-base"
                            style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                          >
                            Want more features?
                          </p>
                          <p 
                            className="text-xs sm:text-sm"
                            style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                          >
                            Upgrade to unlock higher limits and more credits
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate(createPageUrl("Settings"))}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white w-full sm:w-auto text-sm sm:text-base"
                      >
                        Upgrade Now
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}