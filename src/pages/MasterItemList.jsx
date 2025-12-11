import React, { useState, useEffect } from "react";
import { CommonItem } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Plus, Trash2, Edit2, Loader2, Upload, FileDown, Package, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";

import AddCommonItemDialog from "../components/admin/AddCommonItemDialog";
import ImportMasterListDialog from "../components/admin/ImportMasterListDialog";
import { clearCommonItemsCache } from "@/components/utils/commonItemsCache";

export default function MasterItemListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const categories = [
    "all",
    "Produce",
    "Dairy",
    "Meat & Seafood",
    "Bakery",
    "Frozen",
    "Pantry",
    "Beverages",
    "Snacks",
    "Personal Care",
    "Household",
    "Cleaning",
    "Baby",
    "Pet",
    "Other"
  ];

  useEffect(() => {
    loadItems();
    
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

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, selectedCategory]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const allItems = await CommonItem.list();
      // Sort by usage count (most used first) and then by name
      const sorted = allItems.sort((a, b) => {
        if (b.usage_count !== a.usage_count) {
          return (b.usage_count || 0) - (a.usage_count || 0);
        }
        return a.display_name.localeCompare(b.display_name);
      });
      setItems(sorted);
    } catch (error) {
      console.error("Error loading items:", error);
    }
    setLoading(false);
  };

  const filterItems = () => {
    let filtered = items;

    if (selectedCategory !== "all") {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.display_name.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query)
      );
    }

    setFilteredItems(filtered);
  };

  const handleAddItem = async (itemData) => {
    try {
      await CommonItem.create(itemData);
      
      // Update statistics - atomic increment total_common_items
      await updateStatCount('total_common_items', 1);
      
      // Clear CommonItem cache
      clearCommonItemsCache();
      console.log('🗑️ MasterItemList: Cleared CommonItem cache (item added)');
      
      loadItems();
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item. Please try again.");
    }
  };

  const handleEditItem = async (itemData) => {
    try {
      await CommonItem.update(editingItem.id, itemData);
      
      // Clear CommonItem cache
      clearCommonItemsCache();
      console.log('🗑️ MasterItemList: Cleared CommonItem cache (item updated)');
      
      setEditingItem(null);
      loadItems();
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Failed to update item. Please try again.");
    }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Delete "${item.display_name}" from master list? This won't affect existing items in shopping lists.`)) {
      return;
    }

    try {
      await CommonItem.delete(item.id);
      
      // Update statistics - atomic decrement total_common_items
      await updateStatCount('total_common_items', -1);
      
      // Clear CommonItem cache
      clearCommonItemsCache();
      console.log('🗑️ MasterItemList: Cleared CommonItem cache (item deleted)');
      
      loadItems();
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item. Please try again.");
    }
  };

  const handleImportComplete = () => {
    // Clear CommonItem cache
    clearCommonItemsCache();
    console.log('🗑️ MasterItemList: Cleared CommonItem cache (items imported)');
    
    loadItems();
    setShowImportDialog(false);
  };

  const handleExportJSON = () => {
    const exportData = items.map(item => ({
      name: item.name,
      display_name: item.display_name,
      category: item.category,
      photo_url: item.photo_url || "",
      usage_count: item.usage_count || 0,
      is_organic: item.is_organic || false
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-items-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const categoryStats = categories.slice(1).map(cat => ({
    category: cat,
    count: items.filter(item => item.category === cat).length
  })).filter(stat => stat.count > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("Admin"))}
          className="dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Master Item List</h1>
          <p className="text-slate-600 text-sm dark:text-slate-400">
            {items.length} common items • Used for suggestions and quick-add
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Items</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{items.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Categories</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{categoryStats.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Filtered</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{filteredItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          onClick={() => {
            setEditingItem(null);
            setShowAddDialog(true);
          }}
          className="bg-green-600 hover:bg-green-700 master-list-action-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
        <Button
          onClick={() => setShowImportDialog(true)}
          variant="outline"
          className="master-list-action-btn"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import JSON
        </Button>
        <Button
          onClick={handleExportJSON}
          variant="outline"
          disabled={items.length === 0}
          className="master-list-action-btn"
        >
          <FileDown className="w-4 h-4 mr-2" />
          Export JSON
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Category Filters - Wrapped for mobile */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              className={cn(
                "cursor-pointer whitespace-nowrap flex-shrink-0",
                selectedCategory === cat && "bg-green-600 text-white hover:bg-green-700"
              )}
              style={selectedCategory !== cat ? {
                backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                color: isDarkMode ? 'rgb(226 232 240)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
              } : {}}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === "all" ? `All (${items.length})` : `${cat} (${items.filter(i => i.category === cat).length})`}
            </Badge>
          ))}
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading items...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
            {searchQuery || selectedCategory !== "all" ? "No items found" : "No items yet"}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {searchQuery || selectedCategory !== "all"
              ? "Try adjusting your search or filters"
              : "Add your first common item to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all"
            >
              {item.photo_url && (
                <div className="h-32 bg-slate-100 dark:bg-slate-700">
                  <img
                    src={item.photo_url}
                    alt={item.display_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex-1">
                    {item.display_name}
                  </h3>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingItem(item);
                        setShowAddDialog(true);
                      }}
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteItem(item)}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                  {item.usage_count > 0 && (
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{
                        backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                        color: isDarkMode ? 'rgb(226 232 240)' : '',
                        borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                      }}
                    >
                      Used {item.usage_count}x
                    </Badge>
                  )}
                  {item.is_organic && (
                    <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Organic
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddCommonItemDialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setEditingItem(null);
        }}
        onSave={editingItem ? handleEditItem : handleAddItem}
        editItem={editingItem}
      />

      <ImportMasterListDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onComplete={handleImportComplete}
      />
    </div>
  );
}