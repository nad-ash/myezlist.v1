import React, { useState, useEffect } from "react";
import { User, ListMember, ShoppingList, Item, ShareLink } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Upload, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { appCache } from "@/components/utils/appCache";
import { trackShoppingList } from "@/utils/trackingContext";
import { getFamilyInfo } from "@/services/familyService";

import ListCard from "../components/lists/ListCard";
import AddListDialog from "../components/lists/AddListDialog";
import VoiceCommandInput from "../components/home/VoiceCommandInput";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { canCreateShoppingList, canAddItem } from "@/components/utils/tierManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { incrementUsage, decrementUsage } from "@/components/utils/usageSync";
import { logger } from "@/utils/logger";

// Track if hard refresh was already handled this session
// This prevents clearing caches on every SPA navigation
let hardRefreshHandled = false;

export default function ManageListsPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeTitle, setUpgradeTitle] = useState("Limit Reached");
  const [itemCounts, setItemCounts] = useState({});
  const [creatingList, setCreatingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteListConfirm, setDeleteListConfirm] = useState({ open: false, list: null });
  const [familyInfo, setFamilyInfo] = useState(null);

  useEffect(() => {
    // Check for hard refresh to ensure fresh data - only handle ONCE per session
    // The navigation entry persists across SPA navigations, so we track if we've handled it
    if (!hardRefreshHandled) {
      const perfEntries = performance.getEntriesByType('navigation');
      if (perfEntries.length > 0 && perfEntries[0].type === 'reload') {
        logger.cache('ManageLists', 'Hard refresh detected - clearing caches');
        appCache.clearShoppingListEntities();
        appCache.clearAllShoppingLists();
        appCache.clearListMemberships();
      }
      hardRefreshHandled = true;
    }

    loadData();
    
    // Check if we should open the create dialog (from URL param)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openCreate') === 'true') {
      setShowAddDialog(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let currentUser = appCache.getUser();
      if (!currentUser) {
        logger.cache('ManageLists', 'Fetching user from API (cache miss)');
        try {
          currentUser = await User.me();
          appCache.setUser(currentUser);
        } catch (e) {
          logger.debug("User not authenticated, redirecting to Landing");
          navigate(createPageUrl("Landing"));
          return;
        }
      } else {
        logger.cache('ManageLists', 'Using cached user data');
      }
      
      setUser(currentUser);
      
      // Check if user is in a family group with auto-share enabled
      try {
        const info = await getFamilyInfo();
        if (info.success && info.has_family) {
          setFamilyInfo(info);
          logger.debug('ManageLists', 'User is in family group, share_all_lists:', info.family_group?.share_all_lists);
        }
      } catch (familyError) {
        logger.debug('ManageLists', 'Could not fetch family info');
      }

      // Fetch all shopping lists - RLS will return:
      // 1. Lists the user owns
      // 2. Lists the user is a member of
      // 3. Family-shared lists from family members
      let cachedLists = appCache.getShoppingListEntities();
      let allLists;
      
      if (cachedLists) {
        logger.cache('ManageLists', 'Using cached ShoppingList entities');
        allLists = cachedLists;
      } else {
        logger.cache('ManageLists', 'Fetching ShoppingList entities from API (cache miss)');
        allLists = await ShoppingList.list();
        appCache.setShoppingListEntities(allLists);
      }
      
      // Also fetch memberships for role info (owner vs member display)
      let allMemberships = appCache.getListMemberships(currentUser.id);
      
      if (!allMemberships) {
        logger.cache('ManageLists', 'Fetching ListMember from API (cache miss)');
        allMemberships = await ListMember.filter({ user_id: currentUser.id });
        appCache.setListMemberships(currentUser.id, allMemberships);
      } else {
        logger.cache('ManageLists', 'Using cached ListMember data');
      }
      
      // Filter to non-archived lists (RLS already filtered for access)
      const userLists = allLists.filter(list => !list.archived);
      
      if (userLists.length > 0) {
        setLists(userLists);

        const counts = {};
        for (const list of userLists) {
          const cachedListData = appCache.getShoppingList(list.id);
          
          if (cachedListData && cachedListData.itemCounts) {
            logger.cache('ManageLists', 'Using cached item counts for list');
            counts[list.id] = cachedListData.itemCounts;
          } else {
            logger.cache('ManageLists', 'Fetching items for list (cache miss)');
            const items = await Item.filter({ list_id: list.id });
            const activeItems = items.filter(item => !item.is_checked);
            const checkedItems = items.filter(item => item.is_checked);
            
            counts[list.id] = {
              total: activeItems.length,
              checked: checkedItems.length
            };
            
            appCache.setShoppingList(list.id, {
              list: list,
              items: items,
              itemCounts: counts[list.id],
              timestamp: Date.now()
            });
          }
        }
        setItemCounts(counts);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    appCache.clearShoppingListEntities();
    appCache.clearAllShoppingLists();
    if (user) {
       appCache.clearListMemberships(user.id);
    } else {
       appCache.clearListMemberships();
    }
    await loadData();
    setRefreshing(false);
  };

  const handleCreateList = async (listData) => {
    setCreatingList(true);
    try {
      const canCreate = await canCreateShoppingList();
      
      if (!canCreate.canCreate) {
        setUpgradeTitle("List Limit Reached");
        setUpgradeMessage(canCreate.message);
        setShowUpgradePrompt(true);
        setShowAddDialog(false);
        setCreatingList(false);
        return;
      }

      const newList = await ShoppingList.create(
        {
          ...listData,
          owner_id: user.id,
        },
        trackShoppingList.create(user.id, listData.name)
      );

      await ListMember.create({
        list_id: newList.id,
        user_id: user.id,
        user_email: user.email,
        role: 'owner',
        status: 'approved',
      });
      
      // Auto-share with family members if share_all_lists is enabled
      if (familyInfo?.has_family && familyInfo?.family_group?.share_all_lists) {
        const approvedMembers = familyInfo.members?.filter(
          m => m.status === 'approved' && m.user_id !== user.id
        ) || [];
        
        if (approvedMembers.length > 0) {
          logger.debug('ManageLists', `Auto-sharing list with ${approvedMembers.length} family members`);
          
          await Promise.all(
            approvedMembers.map(member =>
              ListMember.create({
                list_id: newList.id,
                user_id: member.user_id,
                user_email: member.email,
                role: 'member',
                status: 'approved', // Auto-approved for family
              })
            )
          );
        }
      }

      // Increment shopping list count (per-user)
      await incrementUsage('current_shopping_lists');
      
      // Update statistics - atomic increment total_lists (global)
      await updateStatCount('total_lists', 1);

      logger.cache('ManageLists', 'Clearing caches (list created)');
      appCache.clearShoppingListEntities();
      appCache.clearListMemberships(user.id);
      
      loadData();
      setShowAddDialog(false);
    } catch (error) {
      console.error("Error creating list:", error);
      alert("Failed to create list. Please try again.");
    }
    setCreatingList(false);
  };

  const handleDeleteList = (list) => {
    setDeleteListConfirm({ open: true, list });
  };

  const confirmDeleteList = async () => {
    const list = deleteListConfirm.list;
    if (!list) return;

    try {
      // Optimistically update UI immediately
      setLists(prev => prev.filter(l => l.id !== list.id));
      setItemCounts(prev => {
        const newCounts = { ...prev };
        delete newCounts[list.id];
        return newCounts;
      });

      const items = await Item.filter({ list_id: list.id });
      await Promise.all(items.map(item => Item.delete(item.id)));

      // Update statistics - atomic decrement total_items for all deleted items
      if (items.length > 0) {
        await updateStatCount('total_items', -items.length);
      }

      const allMemberships = await ListMember.filter({ list_id: list.id });
      await Promise.all(allMemberships.map(member => ListMember.delete(member.id)));

      const shareLinks = await ShareLink.filter({ list_id: list.id });
      await Promise.all(shareLinks.map(link => ShareLink.delete(link.id)));

      await ShoppingList.delete(list.id, trackShoppingList.delete(user.id, list.name));

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

      logger.cache('ManageLists', 'Clearing all related caches (list deleted)');
      appCache.clearShoppingList(list.id);
      appCache.clearShoppingListEntities();
      appCache.clearListMemberships(user.id);

    } catch (error) {
      console.error("Error deleting list:", error);
      alert("Failed to delete list. Please try again.");
      // Revert optimistic update on error - reload data
      await loadData();
    }
  };

  const handleNavigateToList = (list) => {
    navigate(createPageUrl(`ListView?listId=${list.id}`));
  };

  const handleImportClick = async () => {
    // Check tier limits before navigating to import
    const tierCheck = await canAddItem();
    if (!tierCheck.canAdd) {
      setUpgradeTitle("Item Limit Reached");
      setUpgradeMessage(tierCheck.message);
      setShowUpgradePrompt(true);
      return;
    }
    
    navigate(createPageUrl("ImportList"));
  };



  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading your lists...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">My Shopping Lists</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-white border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
            title="Refresh lists"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={handleImportClick}
            className="flex-1 sm:flex-none bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Import
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={creatingList}
          >
            {creatingList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />}
            New List
          </Button>
        </div>
      </div>

      {/* Voice Command Input - below the title */}
      <div className="mb-6">
        <VoiceCommandInput userLists={lists} onItemAdded={loadData} />
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📝</span>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
            No Shopping Lists Yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Create your first shopping list to get started!
          </p>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 w-full sm:w-auto"
            disabled={creatingList}
          >
            {creatingList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="w-5 h-5 mr-2" />}
            Create Your First List
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              itemCount={itemCounts[list.id]?.total || 0}
              doneCount={itemCounts[list.id]?.checked || 0}
              isOwner={list.owner_id === user.id}
              isFamilyShared={list.shared_with_family && list.owner_id !== user.id}
              onClick={() => handleNavigateToList(list)}
              onDelete={() => handleDeleteList(list)}
            />
          ))}
        </div>
      )}

      <AddListDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleCreateList}
        isSaving={creatingList}
      />

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title={upgradeTitle}
        message={upgradeMessage}
        featureName={upgradeTitle === "List Limit Reached" ? "Additional Shopping Lists" : "Additional Items"}
      />

      {/* Delete List Confirmation */}
      <ConfirmDialog
        open={deleteListConfirm.open}
        onOpenChange={(open) => setDeleteListConfirm({ open, list: open ? deleteListConfirm.list : null })}
        title="Delete List"
        description={`Delete "${deleteListConfirm.list?.name}" and all its items? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteList}
        destructive
      />
    </div>
  );
}