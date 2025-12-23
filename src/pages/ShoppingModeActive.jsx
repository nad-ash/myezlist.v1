import React, { useState, useEffect } from "react";
import { User, ListMember, ShoppingList, Item, ActivityTracking } from "@/api/entities";
import { trackItem, OPERATIONS, PAGES } from "@/utils/trackingContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowLeft, Grid2X2, List, Edit3, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { appCache } from "@/components/utils/appCache";

import ItemCard from "../components/items/ItemCard";

export default function ShoppingModeActivePage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('shopping-mode-view') || 'default';
  });
  const [referrerPage, setReferrerPage] = useState("ShoppingMode");

  useEffect(() => {
    // Check if there's a referrer in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const fromPage = urlParams.get("from");
    if (fromPage === "ListView") {
      setReferrerPage("ListView");
    }
    
    loadLists();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadItems();
    }
  }, [selectedListId]);

  // NEW: Check for listId in URL parameters after lists are loaded
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const listIdFromUrl = urlParams.get("listId");
    
    // Only set if a list is already loaded and it matches a list from the URL, and it's not already selected
    if (listIdFromUrl && lists.length > 0 && selectedListId !== listIdFromUrl) {
      const listExists = lists.find(l => l.id === listIdFromUrl);
      if (listExists) {
        setSelectedListId(listIdFromUrl);
      }
    }
  }, [lists, selectedListId]); // Dependency on lists and selectedListId to react to their changes

  const loadLists = async () => {
    try {
      // ✅ Check cache first for user
      let currentUser = appCache.getUser();
      if (!currentUser) {
        console.log('🔄 ShoppingModeActive: Fetching user from API (cache miss)');
        currentUser = await User.me();
        appCache.setUser(currentUser);
      } else {
        console.log('📦 ShoppingModeActive: Using cached user data');
      }
      setUser(currentUser);

      // ✅ Check cache for ListMember first
      let memberships = appCache.getListMemberships(currentUser.id);
      
      if (!memberships) {
        console.log('🔄 ShoppingModeActive: Fetching ListMember from API (cache miss)');
        memberships = await ListMember.filter({ user_id: currentUser.id });
        appCache.setListMemberships(currentUser.id, memberships);
      } else {
        console.log('📦 ShoppingModeActive: Using cached ListMember data');
      }
      
      const approvedMemberships = memberships.filter(m => m.status === 'approved' || m.role === 'owner');
      const listIds = approvedMemberships.map(m => m.list_id);

      if (listIds.length > 0) {
        // ✅ Try to get all ShoppingList entities from cache first
        let allLists = appCache.getShoppingListEntities();
        
        if (!allLists) {
          console.log('🔄 ShoppingModeActive: Fetching ShoppingList entities from API (cache miss)');
          allLists = await ShoppingList.list();
          appCache.setShoppingListEntities(allLists);
        } else {
          console.log('📦 ShoppingModeActive: Using cached ShoppingList entities');
        }
        
        const userLists = allLists.filter(list => listIds.includes(list.id) && !list.archived);
        setLists(userLists);

        // Check URL params first before setting default
        const urlParams = new URLSearchParams(window.location.search);
        const listIdFromUrl = urlParams.get("listId");
        
        if (listIdFromUrl && userLists.find(l => l.id === listIdFromUrl)) {
          setSelectedListId(listIdFromUrl);
        } else if (userLists.length > 0 && !selectedListId) {
          // Only set a default if selectedListId is still empty, preventing override from URL param effect
          setSelectedListId(userLists[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading lists:", error);
    }
  };

  const loadItems = async () => {
    try {
      // ✅ Try to get items from cache first
      const cachedList = appCache.getShoppingList(selectedListId);
      
      if (cachedList && cachedList.items) {
        console.log(`📦 ShoppingModeActive: Using cached items for list ${selectedListId}`);
        setItems(cachedList.items);
      } else {
        console.log(`🔄 ShoppingModeActive: Fetching items for list ${selectedListId} from API (cache miss)`);
        const itemsData = await Item.filter({ list_id: selectedListId }, "-created_date");
        setItems(itemsData);
        
        // Cache the items along with the list
        const activeItems = itemsData.filter((item) => !item.is_checked);
        const checkedItems = itemsData.filter((item) => item.is_checked);
        
        appCache.setShoppingList(selectedListId, {
          list: lists.find(l => l.id === selectedListId),
          items: itemsData,
          itemCounts: {
            total: activeItems.length,
            checked: checkedItems.length
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Clear cache and reload
      console.log('🔄 ShoppingModeActive: Manual refresh - clearing cache');
      appCache.clearShoppingList(selectedListId);
      await loadItems();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleCheck = async (item) => {
    const originalItem = item; // Store for potential revert
    try {
      const updatedData = {
        is_checked: !item.is_checked,
        checked_date: !item.is_checked ? new Date().toISOString() : null,
      };
      
      // Update UI immediately (optimistic update)
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, ...updatedData } : i
      ));
      
      // Make API call in background with tracking context
      const trackingContext = user 
        ? (!item.is_checked 
            ? trackItem.completeInShopping(user.id, item.name)
            : trackItem.activateInShopping(user.id, item.name))
        : null;
      
      await Item.update(item.id, updatedData, trackingContext);

      // ✅ Invalidate cache since item status changed
      console.log(`🗑️ ShoppingModeActive: Clearing cache for list ${selectedListId} (item checked status changed)`);
      appCache.clearShoppingList(selectedListId);
    } catch (error) {
      console.error("Error updating item:", error);
      // Revert on error
      setItems(prev => prev.map(i => 
        i.id === originalItem.id ? originalItem : i
      ));
    }
  };

  const handleCompleteShopping = async () => {
    if (confirm("Mark all remaining items as checked?")) {
      try {
        const uncheckedItems = items.filter(item => !item.is_checked);
        
        const now = new Date().toISOString();
        
        // Update UI immediately
        setItems(prev => prev.map(item => 
          !item.is_checked ? { ...item, is_checked: true, checked_date: now } : item
        ));
        
        // Make API calls in background
        await Promise.all(uncheckedItems.map(item =>
          Item.update(item.id, {
            is_checked: true,
            checked_date: now,
          })
        ));
        
        // Track activity for completing all items using standardized operation
        if (user) {
          ActivityTracking.create({
            operation_type: 'UPDATE',
            page: PAGES.SHOPPING_MODE,
            operation_name: OPERATIONS.ITEM.COMPLETE_ALL_SHOPPING,
            description: `User completed shopping for list "${selectedList?.name}" by checking all remaining items`,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }).catch(err => console.warn('Activity tracking failed:', err));
        }

        // ✅ Invalidate cache since items changed
        console.log(`🗑️ ShoppingModeActive: Clearing cache for list ${selectedListId} (all items checked)`);
        appCache.clearShoppingList(selectedListId);
      } catch (error) {
        console.error("Error completing shopping:", error);
        loadItems(); // Reload on error
      }
    }
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'default' ? 'compact' : 'default';
    setViewMode(newMode);
    localStorage.setItem('shopping-mode-view', newMode);
  };

  const handleBack = () => {
    if (referrerPage === "ListView" && selectedListId) {
      navigate(createPageUrl(`ListView?listId=${selectedListId}`));
    } else {
      navigate(createPageUrl("ShoppingMode"));
    }
  };

  const activeItems = items.filter(item => !item.is_checked);
  const checkedItems = items.filter(item => item.is_checked);
  const progress = items.length > 0 ? (checkedItems.length / items.length) * 100 : 0;

  const categoriesInActiveItems = [...new Set(activeItems.map(item => item.category).filter(Boolean))];
  const categories = ["all", ...categoriesInActiveItems];

  const filteredActiveItems = selectedCategory === "all" 
    ? activeItems 
    : activeItems.filter(item => item.category === selectedCategory);

  const selectedList = lists.find(l => l.id === selectedListId);

  const groupedItems = filteredActiveItems.reduce((groups, item) => {
    const category = item.category || "Other";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const indexA = categories.indexOf(a);
    const indexB = categories.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="w-full max-w-full">
        <div className="max-w-2xl mx-auto py-4 sm:py-8 w-full">
          {/* Mobile-friendly Header */}
          <div className="flex items-center gap-2 sm:gap-4 mb-6 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
              Shopping Mode
            </h1>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="!bg-white dark:!bg-slate-700 !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600 flex-shrink-0"
              title="Refresh items"
            >
              <RefreshCw className={cn("w-5 h-5 !text-slate-800 dark:!text-white", isRefreshing && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleViewMode}
              className="!bg-white dark:!bg-slate-700 !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600 flex-shrink-0"
              title={viewMode === 'default' ? 'Switch to Compact View' : 'Switch to Default View'}
            >
              {viewMode === 'default' ? (
                <Grid2X2 className="w-5 h-5 !text-slate-800 dark:!text-white" />
              ) : (
                <List className="w-5 h-5 !text-slate-800 dark:!text-white" />
              )}
            </Button>
            {selectedListId && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(createPageUrl(`ListView?listId=${selectedListId}`))}
                className="!bg-white dark:!bg-slate-700 !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600 flex-shrink-0"
                title="Manage this list"
              >
                <Edit3 className="w-5 h-5 !text-slate-800 dark:!text-white" />
              </Button>
            )}
          </div>

          {lists.length > 0 && (
            <div className="mb-6 px-4">
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger className="h-14 text-lg w-full">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedListId && (
            <>
              <div className="bg-white rounded-xl p-4 shadow-sm mb-4 dark:bg-slate-800 mx-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {checkedItems.length} of {items.length} items
                  </span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {Math.round(progress)}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {categories.length > 1 && (
                <div className="mb-4 w-full overflow-x-auto scrollbar-hide">
                  <div className="flex gap-2 pb-2 px-4 min-w-max">
                    {categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant={selectedCategory === cat ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer whitespace-nowrap text-base py-2 px-4 flex-shrink-0",
                          selectedCategory === cat 
                            ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white" 
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

              <div className="space-y-6 mb-6 px-4">
                {filteredActiveItems.length === 0 ? (
                  <div className="text-center py-4 bg-white rounded-xl dark:bg-slate-800">
                    <CheckCircle className="w-7 h-7 text-green-500 mx-auto mb-1.5 dark:text-green-400" />
                    <h3 className="text-sm font-semibold text-slate-800 mb-0.5 dark:text-slate-100">
                      {selectedCategory === "all" ? "All Done!" : `No items in ${selectedCategory}`}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 px-4">
                      {selectedCategory === "all" 
                        ? "You've checked off all items" 
                        : "Try selecting a different category or add more items to this category."}
                    </p>
                  </div>
                ) : (
                  sortedCategories.map((category) => (
                    <div key={category}>
                      <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 px-1">
                        <div className="w-1 h-5 bg-blue-500 rounded-full dark:bg-blue-400 flex-shrink-0"></div>
                        <span className="truncate">{category}</span>
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400 flex-shrink-0">
                          ({groupedItems[category].length})
                        </span>
                      </h3>
                      {viewMode === 'compact' ? (
                        <div className="grid grid-cols-2 gap-2">
                          {groupedItems[category].map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              onToggleCheck={handleToggleCheck}
                              isShoppingMode={true}
                              compactView={true}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {groupedItems[category].map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              onToggleCheck={handleToggleCheck}
                              isShoppingMode={true}
                              compactView={false}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {checkedItems.length > 0 && (
                <div className="px-4">
                  <h3 className="font-semibold text-slate-600 dark:text-slate-300 mb-3 text-sm uppercase tracking-wide px-1">
                    In Cart ({checkedItems.length})
                  </h3>
                  {viewMode === 'compact' ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {checkedItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onToggleCheck={handleToggleCheck}
                          isShoppingMode={true}
                          compactView={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {checkedItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onToggleCheck={handleToggleCheck}
                          isShoppingMode={true}
                          compactView={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeItems.length > 0 && (
                <div className="px-4">
                  <Button
                    onClick={handleCompleteShopping}
                    className="w-full mt-8 h-14 text-lg bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Complete Shopping
                  </Button>
                </div>
              )}
            </>
          )}

          {lists.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-slate-600 dark:text-slate-400">No lists available. Create one first!</p>
              <Button
                onClick={() => navigate(createPageUrl("Home"))}
                className="mt-4"
              >
                Go to Manage Lists
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}