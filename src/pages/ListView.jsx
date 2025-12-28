import React, { useState, useEffect } from "react";
import { User, ListMember, ShoppingList, Item, ActivityTracking, ShareLink } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Share2, Star, Loader2, Trash2, ShoppingCart, RefreshCw, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { appCache } from "@/components/utils/appCache";
import { trackItem, trackShoppingList, trackShare, PAGES, OPERATIONS } from "@/utils/trackingContext";

import ItemCard from "../components/items/ItemCard";

// Predefined category order for consistent display
const CATEGORY_ORDER = [
  "Produce",
  "Pantry",
  "Dairy",
  "Meat & Seafood",
  "Frozen",
  "Beverages",
  "Snacks",
  "Household",
  "Bakery",
  "Personal Care",
  "Cleaning",
  "Baby",
  "Pet",
  "Other"
];
import AddItemDialog from "../components/items/AddItemDialog";
import FastAddItemInput from "../components/items/FastAddItemInput";
import ShareDialog from "../components/lists/ShareDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { canAddItem } from "@/components/utils/tierManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { incrementUsage, decrementUsage } from "@/components/utils/usageSync";

export default function ListViewPage() {
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [error, setError] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeTitle, setUpgradeTitle] = useState("Limit Reached");
  const [refreshing, setRefreshing] = useState(false);
  
  // Confirm dialog states
  const [deleteItemConfirm, setDeleteItemConfirm] = useState({ open: false, item: null });
  const [deleteListConfirm, setDeleteListConfirm] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const listId = urlParams.get("listId");

  useEffect(() => {
    if (listId) {
      loadData();
    } else {
      setLoading(false);
      setError("No list ID provided");
    }
  }, [listId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Clear cache for this specific list
    console.log(`🔄 ListView: Manual refresh - clearing cache for list ${listId}`);
    appCache.clearShoppingList(listId);
    
    // Reload data from API
    await loadData();
    
    setRefreshing(false);
  };

  const handleGoToShoppingMode = () => {
    navigate(createPageUrl(`ShoppingModeActive?listId=${listId}&from=ListView`));
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Check cache first for user
      let currentUser = appCache.getUser();
      if (!currentUser) {
        console.log('🔄 ListView: Fetching user from API (cache miss)');
        currentUser = await User.me();
        appCache.setUser(currentUser);
      } else {
        console.log('📦 ListView: Using cached user data');
      }
      
      setUser(currentUser);

      // NEW: Check cache for ListMember first
      let allMemberships = appCache.getListMemberships(currentUser.id);
      
      if (!allMemberships) {
        console.log('🔄 ListView: Fetching ListMember from API (cache miss)');
        allMemberships = await ListMember.filter({ user_id: currentUser.id });
        appCache.setListMemberships(currentUser.id, allMemberships);
      } else {
        console.log('📦 ListView: Using cached ListMember data');
      }
      
      const membership = allMemberships.find(m => m.list_id === listId);

      if (!membership) {
        setError("You don't have access to this list");
        setLoading(false);
        return;
      }

      if (membership.status === 'pending') {
        setError("Your access to this list is pending approval from the owner");
        setLoading(false);
        return;
      }

      // Try to get list AND items from cache
      const cachedList = appCache.getShoppingList(listId);
      let listData = null;
      let itemsData = null;
      
      if (cachedList && cachedList.list && cachedList.items) {
        console.log('📦 ListView: Using cached list and items data');
        listData = cachedList.list;
        itemsData = cachedList.items;
      } else {
        console.log('🔄 ListView: Fetching list and items from API (cache miss)');
        
        // Try to get list from cached entities first
        if (cachedList && cachedList.list) {
          listData = cachedList.list;
        } else {
          const cachedEntities = appCache.getShoppingListEntities();
          if (cachedEntities) {
            console.log('📦 ListView: Using cached ShoppingList entities');
            listData = cachedEntities.find(l => l.id === listId);
          }
          
          if (!listData) {
            console.log('🔄 ListView: Fetching ShoppingList entities from API (cache miss)');
            const allLists = await ShoppingList.list();
            appCache.setShoppingListEntities(allLists);
            listData = allLists.find(l => l.id === listId);
          }
        }
        
        // Fetch items from API
        itemsData = await Item.filter({ list_id: listId }, "-created_date");
        
        // Cache the complete data
        if (listData) {
          const activeItems = itemsData.filter((item) => !item.is_checked);
          const checkedItems = itemsData.filter((item) => item.is_checked);
          
          appCache.setShoppingList(listId, {
            list: listData,
            items: itemsData,
            itemCounts: {
              total: activeItems.length,
              checked: checkedItems.length
            },
            timestamp: Date.now()
          });
        }
      }

      if (!listData) {
        setError("List not found");
        setLoading(false);
        return;
      }

      setList(listData);
      setItems(itemsData);
    } catch (error) {
      console.error("Error loading data:", error);
      setError(`Failed to load list: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (itemData) => {
    try {
      // Check for duplicate item name in the list
      const normalizedName = itemData.name.toLowerCase().trim();
      const duplicate = items.find(item => 
        item.name.toLowerCase().trim() === normalizedName
      );
      
      if (duplicate) {
        alert(`An item named "${itemData.name}" already exists in this list.`);
        return;
      }

      // Use cached user data
      const currentUser = appCache.getUser() || await User.me();
      
      const newItem = await Item.create(
        {
          list_id: listId,
          ...itemData,
          added_by: currentUser.email,
        },
        trackItem.add(currentUser.id, itemData.name)
      );

      // Increment total items count
      await incrementUsage('current_total_items');

      // Update statistics - atomic increment total_items
      await updateStatCount('total_items', 1);

      // Invalidate this specific list's cache since item count changed
      console.log(`🗑️ ListView: Clearing cache for list ${listId} (item added)`);
      appCache.clearShoppingList(listId);

      loadData(); // Reload data to get the new item and updated stats
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  const handleEditItem = async (itemData) => {
    try {
      await Item.update(editingItem.id, itemData, trackItem.edit(user.id, itemData.name));
      // Update item in state immediately
      setItems(prev => prev.map(item =>
        item.id === editingItem.id ? { ...item, ...itemData } : item
      ));
      setEditingItem(null);

      // Invalidate cache since item data changed
      console.log(`🗑️ ListView: Clearing cache for list ${listId} (item edited)`);
      appCache.clearShoppingList(listId);
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const handleToggleCheck = async (item) => {
    const originalItem = item; // Store original item for potential revert
    try {
      const updatedData = {
        is_checked: !item.is_checked,
        checked_date: !item.is_checked ? new Date().toISOString() : null,
      };

      // Update UI immediately (optimistic update)
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, ...updatedData } : i
      ));

      // Make API call in background with tracking
      const trackingContext = !item.is_checked 
        ? trackItem.archive(user.id, item.name)
        : trackItem.activate(user.id, item.name);
      await Item.update(item.id, updatedData, trackingContext);

      // Invalidate this specific list's cache since active item count changed
      console.log(`🗑️ ListView: Clearing cache for list ${listId} (item checked status changed)`);
      appCache.clearShoppingList(listId);
    } catch (error) {
      console.error("Error updating item:", error);
      // Revert on error
      setItems(prev => prev.map(i =>
        i.id === originalItem.id ? originalItem : i
      ));
    }
  };

  const handleToggleFavorite = async (item) => {
    const originalItem = item; // Store original item for potential revert
    try {
      const updatedData = {
        is_favorite: !item.is_favorite,
      };

      // Update UI immediately
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, ...updatedData } : i
      ));

      // Make API call in background with tracking
      const trackingContext = !item.is_favorite 
        ? trackItem.favorite(user.id, item.name)
        : trackItem.unfavorite(user.id, item.name);
      await Item.update(item.id, updatedData, trackingContext);

      // Invalidate cache since item data changed
      console.log(`🗑️ ListView: Clearing cache for list ${listId} (item favorite toggled)`);
      appCache.clearShoppingList(listId);
    } catch (error) {
      console.error("Error updating favorite:", error);
      // Revert on error
      setItems(prev => prev.map(i =>
        i.id === originalItem.id ? originalItem : i
      ));
    }
  };

  const handleDeleteItem = (item) => {
    setDeleteItemConfirm({ open: true, item });
  };

  const confirmDeleteItem = async () => {
    const item = deleteItemConfirm.item;
    if (!item) return;
    
    try {
      // Remove from UI immediately
      setItems(prev => prev.filter(i => i.id !== item.id));

      // Make API call in background with tracking
      await Item.delete(item.id, trackItem.delete(user.id, item.name));
      
      // Decrement total items count
      await decrementUsage('current_total_items');
      
      // Update statistics - atomic decrement total_items
      await updateStatCount('total_items', -1);

      // Invalidate this specific list's cache since item count changed
      console.log(`🗑️ ListView: Clearing cache for list ${listId} (item deleted)`);
      appCache.clearShoppingList(listId);
    } catch (error) {
      console.error("Error deleting item:", error);
      // Reload on error
      loadData();
    }
  };

  const handleOpenAddDialog = async () => {
    // Check tier limits before opening dialog
    const tierCheck = await canAddItem();
    if (!tierCheck.canAdd) {
      setUpgradeTitle("Item Limit Reached");
      setUpgradeMessage(tierCheck.message);
      setShowUpgradePrompt(true);
      return;
    }
    
    setEditingItem(null);
    setShowAddDialog(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setShowAddDialog(true);
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingItem(null);
  };

  const handleDeleteList = () => {
    setDeleteListConfirm(true);
  };

  const confirmDeleteList = async () => {
    try {
      // Check if user is the owner
      const memberships = await ListMember.filter({
        list_id: listId,
        user_id: user.id
      });

      if (memberships.length === 0 || memberships[0].role !== 'owner') {
        alert('Only the owner can delete this list.');
        return;
      }

      // Delete all items
      await Promise.all(items.map(item => Item.delete(item.id)));

      // Update statistics: atomic decrement total_items for all deleted items
      if (items.length > 0) {
        await updateStatCount('total_items', -items.length);
      }

      // Delete all memberships
      const allMemberships = await ListMember.filter({ list_id: listId });
      await Promise.all(allMemberships.map(member => ListMember.delete(member.id)));

      // Delete share links
      const shareLinks = await ShareLink.filter({ list_id: listId });
      await Promise.all(shareLinks.map(link => ShareLink.delete(link.id)));

      // Delete the list with tracking
      await ShoppingList.delete(listId, trackShoppingList.delete(user.id, list.name, PAGES.LIST_VIEW));

      // Decrement shopping list count (per-user) and total items count
      await decrementUsage('current_shopping_lists');
      
      // Update statistics - atomic decrement total_lists (global)
      await updateStatCount('total_lists', -1);
      
      if (items.length > 0) {
        const currentUser = await User.me();
        const newItemCount = Math.max(0, (currentUser.current_total_items || 0) - items.length);
        await User.updateMe({ current_total_items: newItemCount });
        appCache.clearUser();
      }

      // Clear all related caches
      console.log(`🗑️ ListView: Clearing all related caches (list deleted)`);
      appCache.clearShoppingList(listId);
      appCache.clearShoppingListEntities();
      appCache.clearListMemberships(user.id); // NEW: Clear list memberships cache

      // Navigate back to Manage Lists
      navigate(createPageUrl("ManageLists"));
    } catch (error) {
      console.error("Error deleting list:", error);
      alert("Failed to delete list. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading list...</p>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
            {error || "List not found"}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error === "You don't have access to this list" || error === "Your access to this list is pending approval from the owner"
              ? error
              : "The list you're looking for doesn't exist."}
          </p>
          <Button onClick={() => navigate(createPageUrl("ManageLists"))}>
            Go to Manage Lists
          </Button>
        </div>
      </div>
    );
  }

  const activeItems = items.filter(item => !item.is_checked);
  // Sort checked items by checked_date descending (most recently archived first)
  const checkedItems = items
    .filter(item => item.is_checked)
    .sort((a, b) => {
      const dateA = a.checked_date ? new Date(a.checked_date) : new Date(0);
      const dateB = b.checked_date ? new Date(b.checked_date) : new Date(0);
      return dateB - dateA; // Descending order (newest first)
    });
  const favoriteItems = activeItems.filter(item => item.is_favorite);

  // Get unique categories from active items, sorted by predefined order
  const categoriesInActiveItems = [...new Set(activeItems.map(item => item.category).filter(Boolean))]
    .sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a);
      const indexB = CATEGORY_ORDER.indexOf(b);
      // Put unknown categories at the end, sorted alphabetically
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  const categories = ["all", ...categoriesInActiveItems];

  const filteredActiveItems = selectedCategory === "all"
    ? activeItems
    : activeItems.filter(item => item.category === selectedCategory);

  // Group items by category for display
  const groupedItems = filteredActiveItems.reduce((groups, item) => {
    const category = item.category || "Other";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});

  // Sort categories by predefined order for consistent display
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a);
    const indexB = CATEGORY_ORDER.indexOf(b);
    // Put unknown categories at the end, sorted alphabetically
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Check if current user is owner
  const isOwner = list?.owner_id === user?.id;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        {/* Desktop Layout: Everything in one row */}
        <div className="hidden md:flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("ManageLists"))}
            className="dark:text-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0 max-w-full overflow-hidden">
            <h1 
              className="text-2xl font-bold text-slate-800 dark:text-slate-100"
              style={{ 
                wordBreak: 'break-word', 
                overflowWrap: 'anywhere',
                hyphens: 'auto',
                wordWrap: 'break-word'
              }}
            >
              {list.name}
            </h1>
            <p className="text-slate-600 text-sm dark:text-slate-400">
              {activeItems.length} active • {checkedItems.length} done
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
              title="Refresh list"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={async () => {
                const tierCheck = await canAddItem();
                if (!tierCheck.canAdd) {
                  setUpgradeTitle("Item Limit Reached");
                  setUpgradeMessage(tierCheck.message);
                  setShowUpgradePrompt(true);
                  return;
                }
                navigate(createPageUrl(`ImportList?preselectedListId=${listId}`));
              }}
              className="bg-white border-slate-300 hover:bg-purple-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-purple-900/30"
              title="Import items"
            >
              <FileDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleGoToShoppingMode}
              className="bg-white border-slate-300 hover:bg-blue-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-blue-900/30"
              title="Enter Shopping Mode"
            >
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowShareDialog(true)}
              className="bg-white border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
              title="Share list"
            >
              <Share2 className="w-5 h-5 text-slate-700 dark:text-slate-400" />
            </Button>
            {isOwner && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleDeleteList}
                className="bg-white border-slate-300 hover:bg-red-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-red-900/30"
                title="Delete list"
              >
                <Trash2 className="w-5 h-5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" />
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Layout: Two rows */}
        <div className="md:hidden">
          {/* First Row: Back button and List name */}
          <div className="flex items-center gap-4 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("ManageLists"))}
              className="dark:text-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <h1 
                className="text-2xl font-bold text-slate-800 dark:text-slate-100"
                style={{ 
                  wordBreak: 'break-word', 
                  overflowWrap: 'anywhere',
                  hyphens: 'auto',
                  wordWrap: 'break-word'
                }}
              >
                {list.name}
              </h1>
              <p className="text-slate-600 text-sm dark:text-slate-400">
                {activeItems.length} active • {checkedItems.length} done
              </p>
            </div>
          </div>

          {/* Second Row: Action buttons - evenly spread */}
          <div className="flex items-center justify-around gap-1">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 flex-1 max-w-[70px]"
              title="Refresh list"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={async () => {
                const tierCheck = await canAddItem();
                if (!tierCheck.canAdd) {
                  setUpgradeTitle("Item Limit Reached");
                  setUpgradeMessage(tierCheck.message);
                  setShowUpgradePrompt(true);
                  return;
                }
                navigate(createPageUrl(`ImportList?preselectedListId=${listId}`));
              }}
              className="bg-white border-slate-300 hover:bg-purple-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-purple-900/30 flex-1 max-w-[70px]"
              title="Import items"
            >
              <FileDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleGoToShoppingMode}
              className="bg-white border-slate-300 hover:bg-blue-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-blue-900/30 flex-1 max-w-[70px]"
              title="Enter Shopping Mode"
            >
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowShareDialog(true)}
              className="bg-white border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 flex-1 max-w-[70px]"
              title="Share list"
            >
              <Share2 className="w-5 h-5 text-slate-700 dark:text-slate-400" />
            </Button>
            {isOwner && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleDeleteList}
                className="bg-white border-slate-300 hover:bg-red-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-red-900/30 flex-1 max-w-[70px]"
                title="Delete list"
              >
                <Trash2 className="w-5 h-5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Fast Add Input */}
      <FastAddItemInput listId={listId} existingItems={items} onItemAdded={loadData} />

      {/* Add Item Button */}
      <Button
        onClick={handleOpenAddDialog}
        variant="outline"
        className="w-full mb-6 h-12 text-base border-dashed !bg-white !text-slate-800 border-slate-300 hover:!bg-slate-50 dark:!bg-slate-700 dark:!text-white dark:!border-slate-500 dark:hover:!bg-slate-600"
      >
        <Plus className="w-5 h-5 mr-2" />
        Add Item (with details)
      </Button>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className={cn(
                  "cursor-pointer whitespace-nowrap",
                  selectedCategory === cat
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600"
                )}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === "all" ? "All" : cat}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Favorites Section */}
      {favoriteItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-yellow-500 fill-current" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Favorites</h3>
          </div>
          <div className="space-y-2">
            {favoriteItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggleCheck={handleToggleCheck}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeleteItem}
                onEdit={openEditDialog}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Items - Grouped by Category */}
      <div className="space-y-6 mb-6">
        {filteredActiveItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            {selectedCategory === "all" ? "No items yet. Add your first item!" : `No items in ${selectedCategory}`}
          </div>
        ) : (
          sortedCategories.map((category) => (
            <div key={category}>
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                {category}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  ({groupedItems[category].length})
                </span>
              </h3>
              <div className="space-y-2">
                {groupedItems[category].map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onToggleCheck={handleToggleCheck}
                    onToggleFavorite={handleToggleFavorite}
                    onDelete={handleDeleteItem}
                    onEdit={openEditDialog}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Checked Items */}
      {checkedItems.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-600 dark:text-slate-300 mb-3">
            Archived ({checkedItems.length})
          </h3>
          <div className="space-y-2">
            {checkedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggleCheck={handleToggleCheck}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeleteItem}
                onEdit={openEditDialog}
              />
            ))}
          </div>
        </div>
      )}

      <AddItemDialog
        open={showAddDialog}
        onClose={closeDialog}
        onSave={editingItem ? handleEditItem : handleAddItem}
        listSections={list.store_sections}
        editItem={editingItem}
      />
      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        list={list}
        onShareLinkCreated={() => {
          // Track activity when share link is created using standardized operation
          ActivityTracking.create({
            operation_type: 'CREATE',
            page: PAGES.LIST_VIEW,
            operation_name: OPERATIONS.SHARE.CREATE_LINK,
            description: `User created share link for list "${list.name}"`,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }).catch(err => console.warn('Activity tracking failed:', err));
        }}
      />

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title={upgradeTitle}
        message={upgradeMessage}
        featureName="Additional Items"
      />

      {/* Delete Item Confirmation */}
      <ConfirmDialog
        open={deleteItemConfirm.open}
        onOpenChange={(open) => setDeleteItemConfirm({ open, item: open ? deleteItemConfirm.item : null })}
        title="Delete Item"
        description={`Are you sure you want to delete "${deleteItemConfirm.item?.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteItem}
        destructive
      />

      {/* Delete List Confirmation */}
      <ConfirmDialog
        open={deleteListConfirm}
        onOpenChange={setDeleteListConfirm}
        title="Delete List"
        description={`Are you sure you want to delete "${list?.name}"? This will also delete all items in the list.`}
        confirmText="Delete List"
        cancelText="Cancel"
        onConfirm={confirmDeleteList}
        destructive
      />
    </div>
  );
}