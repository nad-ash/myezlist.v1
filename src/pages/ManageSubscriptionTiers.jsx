import React, { useState, useEffect } from "react";
import { SubscriptionTier } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  Crown, 
  Package, 
  ShoppingCart, 
  Sparkles,
  Shield,
  Save,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const tierIcons = {
  free: Package,
  adfree: ShoppingCart,
  pro: Sparkles,
  premium: Crown,
  admin: Shield
};

const tierColors = {
  free: "from-slate-400 to-slate-600",
  adfree: "from-blue-400 to-blue-600",
  pro: "from-purple-400 to-purple-600",
  premium: "from-amber-400 to-amber-600",
  admin: "from-red-500 to-orange-600"
};

export default function ManageSubscriptionTiersPage() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadTiers();
    
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

  const loadTiers = async () => {
    setLoading(true);
    try {
      const allTiers = await SubscriptionTier.list('sort_order');
      setTiers(allTiers);
    } catch (error) {
      console.error("Error loading tiers:", error);
    }
    setLoading(false);
  };

  const handleEditTier = (tier) => {
    setEditingTier({ ...tier });
    setShowEditDialog(true);
  };

  const handleSaveTier = async () => {
    if (!editingTier) return;

    setSaving(true);
    try {
      await SubscriptionTier.update(editingTier.id, {
        display_name: editingTier.display_name,
        price_per_month: parseFloat(editingTier.price_per_month),
        max_shopping_lists: parseInt(editingTier.max_shopping_lists),
        max_total_items: parseInt(editingTier.max_total_items),
        max_tasks: parseInt(editingTier.max_tasks),
        max_custom_recipes: parseInt(editingTier.max_custom_recipes),
        monthly_credits: parseInt(editingTier.monthly_credits),
        has_ads: editingTier.has_ads,
        theme_restriction_duration: parseInt(editingTier.theme_restriction_duration)
      });

      await loadTiers();
      setShowEditDialog(false);
      setEditingTier(null);
      alert("Subscription tier updated successfully!");
    } catch (error) {
      console.error("Error saving tier:", error);
      alert("Failed to update tier. Please try again.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading subscription tiers...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("Admin"))}
          className="dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Manage Subscription Tiers
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Configure pricing, limits, and features for each subscription plan
          </p>
        </div>
      </div>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const Icon = tierIcons[tier.tier_name];
          const gradient = tierColors[tier.tier_name];

          return (
            <Card
              key={tier.id}
              className="overflow-hidden bg-white dark:bg-slate-800 border dark:border-slate-700"
            >
              <div className={cn("h-2 bg-gradient-to-r", gradient)} />
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", gradient)}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-slate-800 dark:text-slate-100">
                      {tier.display_name}
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {tier.tier_name}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {tier.price_per_month === 0 ? 'Free' : `$${tier.price_per_month.toFixed(2)}/mo`}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Shopping Lists</span>
                    <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-200">
                      {tier.max_shopping_lists}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Total Items</span>
                    <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-200">
                      {tier.max_total_items}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Tasks</span>
                    <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-200">
                      {tier.max_tasks}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Custom Recipes</span>
                    <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-200">
                      {tier.max_custom_recipes}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Monthly Credits</span>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {tier.monthly_credits}
                    </Badge>
                  </div>
                  {!tier.has_ads && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">No Ads</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        ✓
                      </Badge>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleEditTier(tier)}
                  className="w-full mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  Edit Tier Settings
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent 
          className="sm:max-w-md max-h-[90vh] overflow-y-auto"
          style={{
            backgroundColor: isDarkMode ? 'rgb(15 23 42)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">
              Edit {editingTier?.display_name} Tier
            </DialogTitle>
          </DialogHeader>

          {editingTier && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="dark:text-slate-200">Display Name</Label>
                <Input
                  value={editingTier.display_name}
                  onChange={(e) => setEditingTier({ ...editingTier, display_name: e.target.value })}
                  className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                />
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-200">Price per Month ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingTier.price_per_month}
                  onChange={(e) => setEditingTier({ ...editingTier, price_per_month: e.target.value })}
                  className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Max Shopping Lists</Label>
                  <Input
                    type="number"
                    value={editingTier.max_shopping_lists}
                    onChange={(e) => setEditingTier({ ...editingTier, max_shopping_lists: e.target.value })}
                    className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Max Total Items</Label>
                  <Input
                    type="number"
                    value={editingTier.max_total_items}
                    onChange={(e) => setEditingTier({ ...editingTier, max_total_items: e.target.value })}
                    className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Max Tasks</Label>
                  <Input
                    type="number"
                    value={editingTier.max_tasks}
                    onChange={(e) => setEditingTier({ ...editingTier, max_tasks: e.target.value })}
                    className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Max Custom Recipes</Label>
                  <Input
                    type="number"
                    value={editingTier.max_custom_recipes}
                    onChange={(e) => setEditingTier({ ...editingTier, max_custom_recipes: e.target.value })}
                    className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-200">Monthly Credits</Label>
                <Input
                  type="number"
                  value={editingTier.monthly_credits}
                  onChange={(e) => setEditingTier({ ...editingTier, monthly_credits: e.target.value })}
                  className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Credits used for premium features like AI generation
                </p>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-200">Theme Restriction (months)</Label>
                <Input
                  type="number"
                  value={editingTier.theme_restriction_duration}
                  onChange={(e) => setEditingTier({ ...editingTier, theme_restriction_duration: e.target.value })}
                  className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  0 = No restriction (themes always available)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="has_ads"
                  checked={editingTier.has_ads}
                  onChange={(e) => setEditingTier({ ...editingTier, has_ads: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="has_ads" className="cursor-pointer dark:text-slate-200">
                  Show Ads
                </Label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingTier(null);
                  }}
                  disabled={saving}
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                    color: isDarkMode ? 'rgb(226 232 240)' : '',
                    borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTier}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}