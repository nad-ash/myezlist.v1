import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, 
  Zap, 
  CheckCircle2, 
  Sparkles,
  TrendingUp,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvailableUpgrades } from "@/components/utils/tierManager";
import { createPageUrl } from "@/utils";

const tierColors = {
  free: "from-slate-400 to-slate-600",
  adfree: "from-blue-400 to-blue-600",
  pro: "from-purple-400 to-purple-600",
  premium: "from-amber-400 to-amber-600"
};

const tierIcons = {
  free: Sparkles,
  adfree: CheckCircle2,
  pro: Sparkles,
  premium: Crown
};

export default function UpgradePrompt({ 
  open, 
  onClose, 
  title = "Upgrade Required",
  message = "This feature is not available in your current plan.",
  featureName = ""
}) {
  const [upgradeTiers, setUpgradeTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (open) {
      loadUpgradeTiers();
    }
    
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
  }, [open]);

  const loadUpgradeTiers = async () => {
    setLoading(true);
    try {
      const tiers = await getAvailableUpgrades();
      setUpgradeTiers(Array.isArray(tiers) ? tiers : []);
    } catch (error) {
      console.error("Error loading upgrade tiers:", error);
      setUpgradeTiers([]);
    }
    setLoading(false);
  };

  const handleUpgrade = () => {
    window.location.href = createPageUrl("Settings");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: isDarkMode ? 'rgb(15 23 42)' : 'white',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl dark:text-slate-100">{title}</DialogTitle>
                <DialogDescription className="dark:text-slate-400">
                  {message}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="py-6">
          {featureName && (
            <div 
              className="p-4 rounded-lg mb-6"
              style={{
                backgroundColor: isDarkMode ? 'rgba(126, 34, 206, 0.1)' : 'rgb(250 245 255)',
                borderColor: isDarkMode ? 'rgb(126 34 206)' : 'rgb(233 213 255)',
                borderWidth: '1px'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" style={{ color: isDarkMode ? 'rgb(216 180 254)' : 'rgb(147 51 234)' }} />
                <span className="font-semibold" style={{ color: isDarkMode ? 'rgb(255 255 255)' : 'rgb(30 41 59)' }}>
                  Premium Feature: {featureName}
                </span>
              </div>
              <p className="text-sm" style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                Upgrade your plan to unlock this feature and many more!
              </p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : upgradeTiers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 dark:text-slate-400">
                You're on the highest tier available!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-4">
                Available Upgrade Plans
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upgradeTiers.map((tier) => {
                  const Icon = tierIcons[tier.tier_name] || Sparkles;
                  const gradient = tierColors[tier.tier_name];

                  return (
                    <div
                      key={tier.id}
                      className="rounded-xl border-2 overflow-hidden"
                      style={{
                        backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
                        borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
                      }}
                    >
                      <div className={cn("h-2 bg-gradient-to-r", gradient)} />
                      <div className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center", gradient)}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">
                              {tier.display_name}
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              ${tier.price_per_month.toFixed(2)}/month
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {tier.max_shopping_lists} Shopping Lists
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {tier.max_total_items} Total Items
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {tier.max_tasks} Tasks
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {tier.max_custom_recipes} Custom Recipes
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">
                              {tier.monthly_credits} Credits/month
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {tier.allowed_themes && tier.allowed_themes.filter(t => t !== 'default').length > 0
                                ? tier.allowed_themes.filter(t => t !== 'default').map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
                                : 'Default'} Theme{tier.allowed_themes && tier.allowed_themes.filter(t => t !== 'default').length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {!tier.has_ads && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span className="text-slate-700 dark:text-slate-300">
                                No Ads
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleUpgrade}
                className="w-full h-12 text-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg mt-6"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                View Plans & Upgrade
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}