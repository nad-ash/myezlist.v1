
import React, { useState, useEffect } from "react";
import { PremiumFeature, CreditTransaction } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Zap, 
  ToggleLeft, 
  ToggleRight,
  History,
  Users,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PremiumFeaturesAdminPage() {
  const navigate = useNavigate();
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [formData, setFormData] = useState({
    feature_key: '',
    display_name: '',
    description: '',
    credits_per_use: 1,
    is_active: true,
    category: 'general'
  });

  useEffect(() => {
    loadFeatures();
    
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

  const loadFeatures = async () => {
    setLoading(true);
    try {
      const allFeatures = await PremiumFeature.list('category');
      setFeatures(allFeatures);
    } catch (error) {
      console.error('Error loading features:', error);
    }
    setLoading(false);
  };

  const loadTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const allTransactions = await CreditTransaction.list('-created_date', 100);
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
    setTransactionsLoading(false);
  };

  const handleOpenDialog = (feature = null) => {
    if (feature) {
      setEditingFeature(feature);
      setFormData({
        feature_key: feature.feature_key,
        display_name: feature.display_name,
        description: feature.description || '',
        credits_per_use: feature.credits_per_use,
        is_active: feature.is_active,
        category: feature.category || 'general'
      });
    } else {
      setEditingFeature(null);
      setFormData({
        feature_key: '',
        display_name: '',
        description: '',
        credits_per_use: 1,
        is_active: true,
        category: 'general'
      });
    }
    setShowDialog(true);
  };

  const handleSaveFeature = async () => {
    try {
      if (editingFeature) {
        await PremiumFeature.update(editingFeature.id, formData);
      } else {
        await PremiumFeature.create(formData);
      }
      setShowDialog(false);
      loadFeatures();
    } catch (error) {
      console.error('Error saving feature:', error);
      alert('Failed to save feature: ' + error.message);
    }
  };

  const handleToggleActive = async (feature) => {
    try {
      await PremiumFeature.update(feature.id, {
        is_active: !feature.is_active
      });
      loadFeatures();
    } catch (error) {
      console.error('Error toggling feature:', error);
    }
  };

  const handleDeleteFeature = async (feature) => {
    if (!confirm(`Delete "${feature.display_name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await PremiumFeature.delete(feature.id);
      loadFeatures();
    } catch (error) {
      console.error('Error deleting feature:', error);
      alert('Failed to delete feature');
    }
  };

  const categoryColors = {
    shopping: 'from-blue-500 to-indigo-600',
    tasks: 'from-green-500 to-emerald-600',
    recipes: 'from-orange-500 to-red-600',
    general: 'from-purple-500 to-pink-600'
  };

  const groupedFeatures = features.reduce((groups, feature) => {
    const category = feature.category || 'general';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(feature);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading features...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
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
              Premium Features Management
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Configure features that consume user credits
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setShowTransactions(true);
              loadTransactions();
            }}
            variant="outline"
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              color: isDarkMode ? 'rgb(226 232 240)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <History className="w-4 h-4 mr-2" />
            Transactions
          </Button>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Feature
          </Button>
        </div>
      </div>

      {Object.keys(groupedFeatures).length === 0 ? (
        <Card 
          className="p-12 text-center"
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <Zap className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
            No Premium Features Yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Add your first premium feature to start tracking credit consumption
          </p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Feature
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
            <div key={category}>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4 capitalize">
                {category} Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryFeatures.map((feature) => (
                  <Card
                    key={feature.id}
                    className={cn(
                      "overflow-hidden transition-all",
                      !feature.is_active && "opacity-60"
                    )}
                    style={{
                      backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                      borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                    }}
                  >
                    <div className={cn("h-2 bg-gradient-to-r", categoryColors[category])} />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                            {feature.display_name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {feature.feature_key}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            feature.is_active
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          )}
                        >
                          {feature.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      {feature.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          {feature.description}
                        </p>
                      )}

                      <div 
                        className="flex items-center gap-2 mb-4 p-2 rounded-lg"
                        style={{
                          backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(243 244 246)'
                        }}
                      >
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {feature.credits_per_use} {feature.credits_per_use === 1 ? 'credit' : 'credits'} per use
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(feature)}
                          className="flex-1"
                          style={{
                            backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                            color: isDarkMode ? 'rgb(226 232 240)' : '',
                            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                          }}
                        >
                          {feature.is_active ? (
                            <ToggleRight className="w-4 h-4 mr-1" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 mr-1" />
                          )}
                          {feature.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(feature)}
                          style={{
                            backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                            color: isDarkMode ? 'rgb(226 232 240)' : '',
                            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFeature(feature)}
                          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          style={{
                            backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Feature Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">
              {editingFeature ? 'Edit Feature' : 'Add New Feature'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Feature Key *</Label>
              <Input
                placeholder="e.g., voice_command"
                value={formData.feature_key}
                onChange={(e) => setFormData({ ...formData, feature_key: e.target.value })}
                disabled={!!editingFeature}
                className="dark:bg-slate-700 dark:text-white dark:border-slate-600"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unique identifier (cannot be changed after creation)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="dark:text-slate-200">Display Name *</Label>
              <Input
                placeholder="e.g., Voice Command"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="dark:bg-slate-700 dark:text-white dark:border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="dark:text-slate-200">Description</Label>
              <Textarea
                placeholder="What does this feature do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="dark:bg-slate-700 dark:text-white dark:border-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="dark:text-slate-200">Credits Per Use *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.credits_per_use}
                  onChange={(e) => setFormData({ ...formData, credits_per_use: parseInt(e.target.value) || 1 })}
                  className="dark:bg-slate-700 dark:text-white dark:border-slate-600"
                />
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-200">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="dark:bg-slate-700 dark:text-white dark:border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    <SelectItem value="shopping" className="dark:text-white">Shopping</SelectItem>
                    <SelectItem value="tasks" className="dark:text-white">Tasks</SelectItem>
                    <SelectItem value="recipes" className="dark:text-white">Recipes</SelectItem>
                    <SelectItem value="general" className="dark:text-white">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="is_active" className="cursor-pointer dark:text-slate-200">
                Feature is active
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowDialog(false)}
              style={{
                backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                color: isDarkMode ? 'rgb(226 232 240)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveFeature}
              disabled={!formData.feature_key || !formData.display_name}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editingFeature ? 'Update' : 'Create'} Feature
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <History className="w-5 h-5" />
              Credit Transactions
            </DialogTitle>
          </DialogHeader>
          
          {transactionsLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 dark:text-slate-400">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
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
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {tx.feature_name}
                        </span>
                        <Badge
                          className={cn(
                            tx.transaction_type === 'consumption'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          )}
                        >
                          {tx.transaction_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {tx.user_email}
                      </p>
                      {tx.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          {tx.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-lg font-bold",
                        tx.credits_consumed > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      )}>
                        {tx.credits_consumed > 0 ? '-' : '+'}{Math.abs(tx.credits_consumed)}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(tx.created_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
