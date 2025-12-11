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
  Sparkles,
  Users,
  Zap,
  Heart,
  TrendingUp,
  Crown,
  Package
} from "lucide-react";
import { User } from "@/api/entities";
import { cn } from "@/lib/utils";

const hardcodedTiers = [
  {
    id: "free",
    tier_name: "free",
    display_name: "Free",
    price_per_month: 0,
    max_shopping_lists: 5,
    max_total_items: 50,
    max_tasks: 10,
    max_custom_recipes: 5,
    monthly_credits: 15,
    has_ads: true,
    sort_order: 1
  },
  {
    id: "adfree",
    tier_name: "adfree",
    display_name: "Ad-Free",
    price_per_month: 0.99,
    max_shopping_lists: 10,
    max_total_items: 100,
    max_tasks: 20,
    max_custom_recipes: 10,
    monthly_credits: 25,
    has_ads: false,
    sort_order: 2
  },
  {
    id: "pro",
    tier_name: "pro",
    display_name: "Pro",
    price_per_month: 2.99,
    max_shopping_lists: 20,
    max_total_items: 250,
    max_tasks: 50,
    max_custom_recipes: 25,
    monthly_credits: 100,
    has_ads: false,
    sort_order: 3
  },
  {
    id: "premium",
    tier_name: "premium",
    display_name: "Premium",
    price_per_month: 4.99,
    max_shopping_lists: 25,
    max_total_items: 500,
    max_tasks: 100,
    max_custom_recipes: 50,
    monthly_credits: 250,
    has_ads: false,
    sort_order: 4
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Remove colorful theme on landing page, ensure default theme only
    document.documentElement.classList.remove('theme-colorful');
    
    // Check if user is already logged in, redirect to Home
    const checkAuthAndRedirect = async () => {
      try {
        await User.me();
        // User is logged in, redirect to Home
        navigate(createPageUrl("Home"), { replace: true });
      } catch (error) {
        // User not logged in, stay on Landing page
        console.log("User not logged in, showing landing page");
      }
    };

    checkAuthAndRedirect();
    
    setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, [navigate]);

  const handleFeatureClick = (pageName) => {
    // Redirect to login first, then to the feature page
    User.redirectToLogin(createPageUrl(pageName));
  };

  const handleGetStarted = () => {
    User.redirectToLogin(createPageUrl("Home"));
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

  const highlights = [
    {
      icon: Sparkles,
      title: "AI-Powered",
      description: "Smart categorization and image generation"
    },
    {
      icon: Users,
      title: "Family Sharing",
      description: "Collaborate with family members in real-time"
    },
    {
      icon: Zap,
      title: "Fast & Easy",
      description: "Intuitive interface for quick task management"
    },
    {
      icon: Heart,
      title: "Ad-Free Options",
      description: "Upgrade for an uninterrupted experience"
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

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20"
          style={{
            backgroundImage: isDarkMode 
              ? 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)'
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                Your All-in-One Life Organizer
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <div className="flex flex-col items-center gap-4">
                <span 
                  className="font-bold"
                  style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                >
                  Welcome to
                </span>
                <div className="flex items-center gap-4">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e49376f2948d5caa147758/52890d187_MyEZList_Icon_512x512.png"
                    alt="MyEZList"
                    className="w-16 h-16 md:w-20 md:h-20 object-contain"
                  />
                  <span className="text-4xl md:text-6xl font-bold">
                    <span style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}>My</span>
                    <span style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(194 65 12)' }}>EZ</span>
                    <span style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}>List</span>
                  </span>
                </div>
              </div>
            </h1>
            
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-8">
              Simplify your life with smart shopping lists, organized tasks, and delicious recipes—all in one beautiful app.
            </p>

            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl text-lg px-8"
            >
              Get Started - It's Free!
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={cn("w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform", feature.gradient)}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 
                        className="text-xl font-bold"
                        style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}
                      >
                        {feature.title}
                      </h3>
                    </div>
                    
                    <p 
                      className="mb-6 min-h-[60px]"
                      style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                    >
                      {feature.description}
                    </p>
                    
                    <Button
                      className={cn("w-full gap-2 bg-gradient-to-r hover:shadow-lg transition-all", feature.gradient)}
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
        </div>
      </div>

      {/* Highlights Section */}
      <div className="bg-white dark:bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl font-bold mb-4"
              style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
            >
              Why Choose MyEZList?
            </h2>
            <p 
              className="text-lg"
              style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
            >
              Everything you need to stay organized and productive
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {highlights.map((highlight, index) => {
              const Icon = highlight.icon;
              return (
                <div
                  key={index}
                  className="text-center p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 
                    className="font-semibold mb-2"
                    style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}
                  >
                    {highlight.title}
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                  >
                    {highlight.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-slate-50 dark:bg-slate-800/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl font-bold mb-4"
              style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
            >
              Choose Your Plan
            </h2>
            <p 
              className="text-lg"
              style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
            >
              Start free and upgrade as you grow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {hardcodedTiers.map((tier) => {
              const Icon = tierIcons[tier.tier_name] || Package;
              const gradient = tierColors[tier.tier_name];
              const isProPlan = tier.tier_name === 'pro';

              return (
                <Card
                  key={tier.id}
                  className={cn(
                    "overflow-hidden hover:shadow-xl transition-all",
                    isProPlan && "ring-2 ring-purple-500 dark:ring-purple-400 transform scale-105"
                  )}
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
                    borderColor: isDarkMode ? (isProPlan ? 'rgb(168 85 247)' : 'rgb(71 85 105)') : (isProPlan ? 'rgb(168 85 247)' : '')
                  }}
                >
                  <div className={cn("h-2 bg-gradient-to-r", gradient)} />
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", gradient)}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 
                            className="font-bold text-xl"
                            style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}
                          >
                            {tier.display_name}
                          </h3>
                          {isProPlan && (
                            <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                        </div>
                        <p 
                          className="text-sm"
                          style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                        >
                          ${tier.price_per_month.toFixed(2)}/month
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6 text-sm">
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)' }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span>{tier.max_shopping_lists} Shopping Lists</span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)' }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span>{tier.max_total_items} Total Items</span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)' }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span>{tier.max_tasks} Tasks</span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)' }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span>{tier.max_custom_recipes} Custom Recipes</span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)' }}
                      >
                        <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                        <span className="font-semibold">{tier.monthly_credits} Credits/month</span>
                      </div>
                      {!tier.has_ads && (
                        <div 
                          className="flex items-center gap-2"
                          style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(51 65 85)' }}
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span>No Ads</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleGetStarted}
                      className={cn(
                        "w-full",
                        isProPlan
                          ? "bg-gradient-to-r hover:shadow-lg " + gradient
                          : "bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                      )}
                    >
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Terms Agreement Notice */}
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            By signing up, you agree to our{' '}
            <a 
              href={createPageUrl("Terms")} 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Terms & Conditions
            </a>
            {' '}and{' '}
            <a 
              href={createPageUrl("PrivacyPolicy")} 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Organized?
          </h2>
          <p className="text-xl text-blue-100 dark:text-blue-200 mb-8">
            Join thousands of users managing their lives effortlessly
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => handleFeatureClick("ShoppingMode")}
              className="bg-white hover:bg-blue-50 shadow-xl text-lg px-8"
              style={{ color: isDarkMode ? 'rgb(37 99 235)' : 'rgb(37 99 235)' }}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Start Shopping
            </Button>
            <Button
              size="lg"
              onClick={handleGetStarted}
              variant="outline"
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-lg px-8"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Sign Up Free
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e49376f2948d5caa147758/52890d187_MyEZList_Icon_512x512.png"
                alt="MyEZList"
                className="w-8 h-8 object-contain"
              />
              <span className="text-slate-400 text-sm">
                © 2025 MyEZList. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <a 
                href={createPageUrl("PrivacyPolicy")} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                Privacy Policy
              </a>
              <span className="text-slate-600">|</span>
              <a 
                href={createPageUrl("Terms")} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                Terms & Conditions
              </a>
              <span className="text-slate-600">|</span>
              <a 
                href={createPageUrl("RefundPolicy")} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                Refund Policy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}