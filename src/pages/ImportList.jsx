import React, { useState, useEffect } from "react";
import { ShoppingList } from "@/api/entities";
import { Item } from "@/api/entities";
import { ListMember } from "@/api/entities";
import { User, ActivityTracking } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileText, Sparkles, X, Loader2, CheckCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom"; // Corrected import statement
import { createPageUrl } from "@/utils";
import { InvokeLLM, GenerateImage } from "@/api/integrations";
import { cn } from "@/lib/utils";
import { consumeCredits, checkCreditsAvailable } from "@/components/utils/creditManager";
import { canAddItem } from "@/components/utils/tierManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { loadCommonItemsCache } from "@/components/utils/commonItemsCache";
import { incrementUsage } from "@/components/utils/usageSync";
import { OPERATIONS, PAGES } from "@/utils/trackingContext";
import { logger } from "@/utils/logger";

const categories = [
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

const capitalizeWords = (str) => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Normalize item name for master list matching with singular/plural variants
 */
const normalizeForMatching = (name) => {
  let normalized = name.toLowerCase().trim();
  // Remove common prefixes like "organic", "fresh", etc.
  normalized = normalized.replace(/^(organic|fresh|raw|frozen)\s+/i, '');
  
  // Handle common plural/singular variations
  const singularToPlural = {
    'tomato': 'tomatoes',
    'potato': 'potatoes',
    'onion': 'onions',
    'carrot': 'carrots',
    'apple': 'apples',
    'banana': 'bananas',
    'orange': 'oranges',
    'pepper': 'peppers',
    'cucumber': 'cucumbers',
    'egg': 'eggs',
    'lemon': 'lemons',
    'lime': 'limes',
    'avocado': 'avocados',
    'strawberry': 'strawberries',
    'blueberry': 'blueberries',
    'raspberry': 'raspberries',
    'cherry': 'cherries',
    'mango': 'mangoes',
    'peach': 'peaches',
    'grape': 'grapes',
    'mushroom': 'mushrooms',
    'zucchini': 'zucchinis',
    'celery': 'celeries',
    'broccoli': 'broccolis',
    'lettuce': 'lettuces',
    'spinach': 'spinaches',
  };
  
  // Try to match both singular and plural forms
  return {
    exact: normalized,
    variants: [
      normalized,
      // Try plural if it's singular (use known mapping or add 's')
      singularToPlural[normalized] || normalized + 's',
      // Try singular if it's plural (remove 's')
      normalized.endsWith('s') ? normalized.slice(0, -1) : normalized,
      // Try removing 'es' ending (tomatoes -> tomato)
      normalized.endsWith('es') ? normalized.slice(0, -2) : normalized,
      // Try removing 'ies' and add 'y' (cherries -> cherry)
      normalized.endsWith('ies') ? normalized.slice(0, -3) + 'y' : normalized,
    ].filter((v, i, arr) => arr.indexOf(v) === i) // unique values only
  };
};

/**
 * Build a lookup map from common items with all variants
 */
const buildMasterItemLookup = (commonItems) => {
  const lookup = new Map();
  commonItems.forEach(item => {
    const variants = normalizeForMatching(item.name);
    variants.variants.forEach(variant => {
      if (!lookup.has(variant)) {
        lookup.set(variant, item);
      }
    });
  });
  return lookup;
};

export default function ImportListPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userLists, setUserLists] = useState([]);
  
  // Step 1: Text input
  const [rawText, setRawText] = useState('');
  
  // Step 2: Organized items
  const [organizedItems, setOrganizedItems] = useState([]);
  const [isOrganizing, setIsOrganizing] = useState(false);
  
  // Step 3: List selection and options
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [createNewList, setCreateNewList] = useState(false);
  const [withAutoCategorization, setWithAutoCategorization] = useState(true); // Auto categorization enabled by default
  const [withAIImages, setWithAIImages] = useState(false); // New state for AI Images option
  
  // Step 4: Import process
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentItem: '' });
  const [currentStatus, setCurrentStatus] = useState('');
  
  // Upgrade prompt
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeTitle, setUpgradeTitle] = useState("Limit Reached");
  
  // Common items cache for master list lookup
  const [commonItemsCache, setCommonItemsCache] = useState([]);

  useEffect(() => {
    loadUserData();
    // Load common items cache for master list lookup
    loadCommonItemsCache().then(setCommonItemsCache);
  }, []);

  useEffect(() => {
    // Check for preselected list ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedListId = urlParams.get('preselectedListId');
    
    if (preselectedListId && userLists.length > 0) {
      // Check if the preselected list exists in user's lists
      const listExists = userLists.find(list => list.id === preselectedListId);
      if (listExists) {
        setSelectedListId(preselectedListId);
        setCreateNewList(false);
      }
    }
  }, [userLists]);

  const loadUserData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const memberships = await ListMember.filter({ user_id: currentUser.id });
      const listIds = memberships.map(m => m.list_id);

      if (listIds.length > 0) {
        const allLists = await ShoppingList.list();
        const lists = allLists.filter(list => listIds.includes(list.id) && !list.archived);
        setUserLists(lists);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const handleOrganize = () => {
    if (!rawText.trim()) {
      alert('Please paste some items first.');
      return;
    }

    setIsOrganizing(true);

    // Parse items - handle both comma-separated and line-separated
    let items = [];
    
    // First try splitting by newlines
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length > 1) {
      // Multiple lines - treat each as an item
      items = lines;
    } else {
      // Single line or few lines - check for commas
      items = rawText.split(',').map(item => item.trim()).filter(item => item);
    }

    // Remove duplicates and create organized item objects
    const uniqueItems = [...new Set(items)];
    
    // Check item limit
    if (uniqueItems.length > 25) {
      alert('Maximum 25 items allowed per bulk import. You have ' + uniqueItems.length + ' items. Please reduce the number of items and try again.');
      setIsOrganizing(false);
      return;
    }
    
    const organized = uniqueItems.map((name, index) => ({
      id: `temp-${index}`,
      name: name,
      color: getRandomColor()
    }));

    setOrganizedItems(organized);
    setIsOrganizing(false);
  };

  const getRandomColor = () => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-yellow-100 text-yellow-800',
      'bg-indigo-100 text-indigo-800',
      'bg-red-100 text-red-800',
      'bg-teal-100 text-teal-800',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleEditItem = (itemId, newName) => {
    setOrganizedItems(items =>
      items.map(item => item.id === itemId ? { ...item, name: newName } : item)
    );
  };

  const handleRemoveItem = (itemId) => {
    setOrganizedItems(items => items.filter(item => item.id !== itemId));
  };

  const extractQuantityFromName = (fullName) => {
    // Regex to match quantity patterns at the start or end of the string
    // e.g., "1kg Milk", "Milk 2 liters", "Eggs 1 dozen", "3x Apples", "2 packs of soda"
    const quantityPattern = /\b(\d+(\.\d+)?\s*(kg|g|lb|lbs|oz|ml|l|litre|liter|pack|packs|x|dozen|piece|pieces)?)\b/i;
    const match = fullName.match(quantityPattern);
    
    if (match) {
      const extractedQty = match[0].trim();
      // Remove the matched quantity from the name. Use replace with match[0] to ensure exact match removal.
      const cleanName = fullName.replace(match[0], '').trim();
      return { name: cleanName, quantity: extractedQty };
    }
    
    return { name: fullName, quantity: '' };
  };

  const handleImport = async () => {
    if (organizedItems.length === 0) {
      alert('No items to import.');
      return;
    }

    if (organizedItems.length > 25) {
      alert('Maximum 25 items allowed per bulk import. Please remove some items and try again.');
      return;
    }

    if (!createNewList && !selectedListId) {
      alert('Please select a list or create a new one.');
      return;
    }

    if (createNewList && !newListName.trim()) {
      alert('Please enter a name for the new list.');
      return;
    }

    // Check if user can add these items based on tier limits
    const tierCheck = await canAddItem();
    if (!tierCheck.canAdd) {
      setUpgradeTitle("Item Limit Reached");
      setUpgradeMessage(tierCheck.message);
      setShowUpgradePrompt(true);
      return;
    }

    // Calculate how many items user can still add
    const itemsUserCanAdd = tierCheck.limit - tierCheck.currentCount;
    if (organizedItems.length > itemsUserCanAdd) {
      setUpgradeTitle("Item Limit Reached");
      setUpgradeMessage(`You can only add ${itemsUserCanAdd} more items with your current plan. You're trying to import ${organizedItems.length} items. Please upgrade your plan or reduce the number of items.`);
      setShowUpgradePrompt(true);
      return;
    }

    // Calculate credits needed based on options for initial check
    const batchCategorizationCredits = withAutoCategorization ? 2 : 0; // One LLM call for all items if enabled
    const imageCreditsEstimate = withAIImages ? organizedItems.length : 0; // 1 credit per item for images, estimate
    const totalCreditsNeeded = batchCategorizationCredits + imageCreditsEstimate;

    // Check if user has enough credits
    try {
      const currentUser = await User.me(); // Ensure we have the current user for credit check
      const creditsTotal = currentUser.monthly_credits_total || 0;
      const creditsUsedThisMonth = currentUser.credits_used_this_month || 0;
      const creditsAvailable = creditsTotal - creditsUsedThisMonth;

      if (creditsAvailable < totalCreditsNeeded) {
        alert(`Insufficient credits for bulk import. You need ${totalCreditsNeeded} credits but only have ${creditsAvailable}. Go to Settings to upgrade your plan.`);
        return;
      }
    } catch (error) {
      console.error('Error checking credits:', error);
      alert('Failed to check credits. Please try again.');
      return;
    }

    setIsImporting(true);
    setCurrentStatus('Starting import process...');
    setImportProgress({ current: 0, total: organizedItems.length, currentItem: '' });

    try {
      let targetListId = selectedListId;
      const currentUser = await User.me();

      // Create new list if needed
      if (createNewList) {
        setCurrentStatus(`Creating new list: "${newListName.trim()}"`);
        const newList = await ShoppingList.create({
          name: newListName.trim(),
          owner_id: currentUser.id,
          icon: 'shopping-cart',
          color: 'ocean',
        });

        await ListMember.create({
          list_id: newList.id,
          user_id: currentUser.id,
          user_email: currentUser.email,
          role: 'owner',
          status: 'approved',
        });

        // Increment shopping list count (per-user)
        await incrementUsage('current_shopping_lists');
        
        // Update statistics - atomic increment total_lists (global)
        await updateStatCount('total_lists', 1);

        // Track list creation via import
        ActivityTracking.create({
          operation_type: 'CREATE',
          page: PAGES.IMPORT_LIST,
          operation_name: OPERATIONS.IMPORT.CREATE_LIST_VIA_IMPORT,
          description: `User created list "${newListName.trim()}" via bulk import`,
          user_id: currentUser.id,
          timestamp: new Date().toISOString()
        }).catch(err => console.warn('Activity tracking failed:', err));

        // Clear caches so ListView can see the new list and membership
        const { appCache } = await import('@/components/utils/appCache');
        appCache.clearShoppingListEntities();
        appCache.clearListMemberships(currentUser.id);

        targetListId = newList.id;
      }

      setCurrentStatus('Checking for duplicate items...');
      const existingItems = await Item.filter({ list_id: targetListId });
      const existingItemsMap = new Map(
        existingItems.map(item => [item.name.toLowerCase().trim(), item])
      );

      // Build master item lookup map with singular/plural variants for intelligent matching
      setCurrentStatus('Building master item lookup...');
      const masterItemLookup = buildMasterItemLookup(commonItemsCache);
      logger.import(`Master item lookup built with ${masterItemLookup.size} variants`);

      // Step 1: Filter out duplicates and prepare items for processing
      const itemsToProcess = [];
      const duplicateItems = [];
      const reactivatedItems = [];
      
      for (const item of organizedItems) {
        const { name: cleanName, quantity: extractedQty } = extractQuantityFromName(item.name);
        const capitalizedName = capitalizeWords(cleanName);
        
        // Check if item is organic (look for "organic" in the name)
        const isOrganic = /\borganic\b/gi.test(item.name);
        
        // Use intelligent matching with singular/plural variants
        const variants = normalizeForMatching(cleanName);
        let commonItemMatch = null;
        
        // Try each variant to find a match in master list
        for (const variant of variants.variants) {
          if (masterItemLookup.has(variant)) {
            commonItemMatch = masterItemLookup.get(variant);
            logger.success(`Master match: "${capitalizedName}" → "${commonItemMatch.name}"`);
            break;
          }
        }
        
        const existingItem = existingItemsMap.get(capitalizedName.toLowerCase().trim());
        
        if (existingItem) {
          if (existingItem.is_checked) {
            setCurrentStatus(`Reactivating "${capitalizedName}"...`);
            await Item.update(existingItem.id, {
              is_checked: false,
              checked_date: null,
              quantity: extractedQty, // Update quantity on reactivation
              is_organic: isOrganic || existingItem.is_organic // Preserve or set organic flag
            });
            reactivatedItems.push(capitalizedName);
          } else {
            // Update quantity for duplicate (active) items
            setCurrentStatus(`Updating quantity for "${capitalizedName}"...`);
            await Item.update(existingItem.id, {
              quantity: extractedQty,
              is_organic: isOrganic || existingItem.is_organic // Preserve or set organic flag
            });
            duplicateItems.push(capitalizedName);
          }
          continue; // Skip already existing and active items, or reactivated ones
        }

        itemsToProcess.push({
          originalName: item.name,
          name: capitalizedName,
          quantity: extractedQty,
          isOrganic: isOrganic,
          // Store master item data if found (category and photo_url)
          masterItemCategory: commonItemMatch?.category || null,
          masterItemPhotoUrl: commonItemMatch?.photo_url || null,
          matchedMasterItem: commonItemMatch ? commonItemMatch.name : null,
          // Flag to indicate if this item needs AI categorization
          needsAICategorization: !commonItemMatch
        });
      }

      // Show message about duplicates and reactivations
      if (duplicateItems.length > 0 || reactivatedItems.length > 0) {
        let message = '';
        if (duplicateItems.length > 0) {
          message += `Updated quantity for ${duplicateItems.length} existing item(s): ${duplicateItems.join(', ')}`;
        }
        if (reactivatedItems.length > 0) {
          if (message) message += '\n\n';
          message += `Reactivated ${reactivatedItems.length} archived item(s): ${reactivatedItems.join(', ')}`;
        }
        alert(message);
      }

      if (itemsToProcess.length === 0) {
        // Even if no new items, navigate back to list
        setIsImporting(false);
        setCurrentStatus('Import complete! Navigating to list...');
        
        // Clear cache for this list before navigating
        const { appCache } = await import('@/components/utils/appCache');
        appCache.clearShoppingList(targetListId);
        
        setTimeout(() => {
          navigate(createPageUrl(`ListView?listId=${targetListId}`));
        }, 1000);
        return;
      }

      // Step 2: Batch categorize ONLY items that need AI categorization (didn't match master list)
      let categoriesMap = {};
      
      // Filter items that need AI categorization (no master list match)
      const itemsNeedingAICategorization = itemsToProcess.filter(item => item.needsAICategorization);
      const itemsWithMasterMatch = itemsToProcess.filter(item => !item.needsAICategorization);
      
      logger.import(`Summary: ${itemsWithMasterMatch.length} matched, ${itemsNeedingAICategorization.length} need AI`);
      
      if (withAutoCategorization && itemsNeedingAICategorization.length > 0) {
        setCurrentStatus(`Auto-categorizing ${itemsNeedingAICategorization.length} items with AI (${itemsWithMasterMatch.length} already matched)...`);
        
        try {
          // Prepare list for LLM prompt, using only items that need categorization
          const itemsList = itemsNeedingAICategorization.map((item, idx) => `${idx + 1}. ${item.name}`).join('\n');
          
          logger.import(`Items to categorize: ${itemsList.length} items`);
          
          const categoryResponse = await InvokeLLM({
          prompt: `Given the following grocery/household items, classify each into one of these categories: ${categories.join(", ")}.

Items to categorize:
${itemsList}

Return a JSON object where each key is the EXACT item name (as shown above) and the value is its category.`,
          response_json_schema: {
            type: "object",
            properties: {
              categories: {
                type: "object",
                additionalProperties: {
                  type: "string",
                  enum: categories
                }
              }
            },
            required: ["categories"]
          }
        });
        
        logger.debug('🤖 Full LLM Response:', JSON.stringify(categoryResponse, null, 2));
        
        // Extract categories from response
        let rawCategories = null;
        if (categoryResponse) {
          if (categoryResponse.categories) {
            rawCategories = categoryResponse.categories;
            logger.debug('Found categories at categoryResponse.categories');
          } else if (categoryResponse.properties && categoryResponse.properties.categories) {
            rawCategories = categoryResponse.properties.categories;
            logger.debug('Found categories at categoryResponse.properties.categories');
          } else {
            // The response itself might be the categories object (direct top-level response)
            rawCategories = categoryResponse;
            logger.debug('Using categoryResponse directly (top-level response)');
          }
        }
        
        if (rawCategories) {
          categoriesMap = {};
          logger.debug('Raw categories from LLM:', rawCategories);
          
          for (const [key, value] of Object.entries(rawCategories)) {
            // Remove number prefix (e.g., "1. Milk" -> "Milk")
            const cleanedKey = key.replace(/^\d+\.\s*/, '').trim().toLowerCase();
            categoriesMap[cleanedKey] = value;
            logger.debug(`Normalized: "${key}" → "${cleanedKey}" = ${value}`);
          }
          
          logger.debug('Final categoriesMap:', categoriesMap);
        } else {
          console.warn('⚠️ Could not find categories in LLM response');
        }

        } catch (catError) {
          console.warn('Batch categorization failed, items will use default category:', catError);
        }

        // Consume 2 credits for batch categorization
        await consumeCredits(
          'bulk_import_categorization',
          `Batch auto-categorization for ${itemsNeedingAICategorization.length} items`, // Changed: description as second argument
          { // Changed: details as third argument
            items_count: itemsNeedingAICategorization.length,
            items_skipped_master_match: itemsWithMasterMatch.length,
            list_id: targetListId,
            list_name: createNewList ? newListName.trim() : userLists.find(l => l.id === targetListId)?.name
          }
        );
      } else if (withAutoCategorization && itemsNeedingAICategorization.length === 0) {
        // All items matched master list - no AI categorization needed!
        logger.success('All items matched master list - skipping AI categorization!');
        setCurrentStatus(`All ${itemsWithMasterMatch.length} items matched master list - no AI needed!`);
      }

      // Step 3: Create items immediately (fast), images will be generated in background
      let itemsCreatedCount = 0;
      const itemsNeedingImages = []; // Track items that need AI image generation
      
      // Create all items immediately (without AI-generated images)
      setCurrentStatus('Creating items...');
      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        setImportProgress({ 
          current: i + 1, 
          total: itemsToProcess.length, 
          currentItem: item.name 
        });

        // Get category: AI categorization > Master item category > 'Other'
        const normalizedName = item.name.trim().toLowerCase();
        const aiCategory = categoriesMap[normalizedName];
        const category = aiCategory || item.masterItemCategory || 'Other';
        
        logger.import(`Looking up "${item.name}" → Final category: ${category}`);

        // Use master item photo by default, or empty string if needs AI generation
        const hasExistingPhoto = !!item.masterItemPhotoUrl;
        const needsAIImage = withAIImages && !hasExistingPhoto;
        const photoUrl = hasExistingPhoto ? item.masterItemPhotoUrl : '';
        
        if (hasExistingPhoto) {
          logger.success(`Using master list photo for "${item.name}"`);
        }

        // Create the item (with or without photo)
        setCurrentStatus(`Adding "${item.name}" to list...`);
        const createdItem = await Item.create({
          list_id: targetListId,
          name: item.name,
          quantity: item.quantity,
          category: category,
          photo_url: photoUrl,
          added_by: currentUser.email,
          is_organic: item.isOrganic,
        });
        
        // Track items that need AI image generation
        if (needsAIImage && createdItem?.id) {
          itemsNeedingImages.push({
            id: createdItem.id,
            name: item.name,
            listId: targetListId
          });
        }
        
        itemsCreatedCount++;
      }
      
      // Helper function for background image generation (runs after navigation)
      const generateImagesInBackground = async (items) => {
        logger.background(`Starting image generation for ${items.length} items`);
        
        const BATCH_SIZE = 3; // Process 3 images concurrently
        
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          
          // Generate images for this batch in parallel
          const batchPromises = batch.map(async (item) => {
            try {
              const imagePrompt = `A clean, professional product photo of ${item.name} on a white background, centered, well-lit, product photography`;
              const imageResult = await GenerateImage({ prompt: imagePrompt, quality: 'medium' });
              
              if (imageResult?.url) {
                // Update the item with the generated image
                await Item.update(item.id, { photo_url: imageResult.url });
                
                // Consume 1 credit for image generation
                await consumeCredits(
                  'bulk_import_image',
                  `AI image generation for "${item.name}"`,
                  {
                    item_name: item.name,
                    list_id: item.listId
                  }
                );
                
                logger.success(`Image generated for "${item.name}"`);
                return { success: true, name: item.name };
              }
            } catch (imgError) {
              console.warn(`Background: Image generation failed for "${item.name}":`, imgError);
              return { success: false, name: item.name, error: imgError };
            }
          });
          
          // Wait for batch to complete before starting next batch
          await Promise.allSettled(batchPromises);
        }
        
        logger.success(`Background image generation complete for ${items.length} items`);
      };
      
      // Fire off background image generation (don't await - let it run in background)
      if (itemsNeedingImages.length > 0) {
        logger.background(`Scheduling image generation for ${itemsNeedingImages.length} items`);
        // This runs in background after navigation - images will appear as they're generated
        generateImagesInBackground(itemsNeedingImages).catch(err => 
          console.warn('Background image generation had errors:', err)
        );
      }
      
      // Update user's current_total_items count
      if (itemsCreatedCount > 0) {
        // Use incrementUsage for each item (handles batch correctly)
        for (let i = 0; i < itemsCreatedCount; i++) {
          await incrementUsage('current_total_items');
        }
        
        // Update statistics - atomic increment total_items
        await updateStatCount('total_items', itemsCreatedCount);
      }

      // Track bulk import activity
      if (itemsCreatedCount > 0) {
        const listName = createNewList 
          ? newListName.trim() 
          : userLists.find(l => l.id === targetListId)?.name || 'Unknown List';
        
        ActivityTracking.create({
          operation_type: 'CREATE',
          page: PAGES.IMPORT_LIST,
          operation_name: OPERATIONS.IMPORT.BULK_IMPORT,
          description: `User imported ${itemsCreatedCount} items to list "${listName}"`,
          user_id: currentUser.id,
          timestamp: new Date().toISOString()
        }).catch(err => console.warn('Activity tracking failed:', err));
      }

      const imagesNote = itemsNeedingImages.length > 0 
        ? ` (${itemsNeedingImages.length} images generating in background)` 
        : '';
      setCurrentStatus(`Import complete!${imagesNote} Navigating to list...`);
      
      // Clear cache for this list before navigating
      const { appCache } = await import('@/components/utils/appCache');
      appCache.clearShoppingList(targetListId);
      
      // Navigate immediately - images will appear in the list as they're generated
      setTimeout(() => {
        navigate(createPageUrl(`ListView?listId=${targetListId}`));
      }, 500); // Reduced from 1000ms for faster UX
    } catch (error) {
      console.error("Error importing items:", error);
      alert("Failed to import items. Please try again.");
      setIsImporting(false);
      setCurrentStatus('Import failed.');
    }
  };

  const canImport = organizedItems.length > 0 && (
    (createNewList && newListName.trim()) || (!createNewList && selectedListId)
  );

  // Calculate total credits for display
  // Note: This is a maximum estimate - items matching master list with photos won't need AI image generation
  const totalCreditsForImport = (withAutoCategorization ? 2 : 0) + (withAIImages ? organizedItems.length : 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (organizedItems.length > 0) {
              // Go back to paste section
              setOrganizedItems([]);
              setWithAutoCategorization(true);
              setWithAIImages(false);
              setSelectedListId('');
              setNewListName('');
              setCreateNewList(false);
            } else {
              // Go back to previous page
              window.history.back();
            }
          }}
          disabled={isImporting}
          className="dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Import List</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Quickly import multiple items at once</p>
        </div>
      </div>

      {/* Step 1: Text Input */}
      {organizedItems.length === 0 && (
        <Card className="p-6 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Paste Your List</h3>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900 dark:text-blue-50">
              <strong>Instructions:</strong> Paste your items below. You can separate items by:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-100 mt-2 ml-4 list-disc">
              <li>Commas (e.g., Milk, Bread, Eggs, Apples)</li>
              <li>New lines (one item per line)</li>
              <li>Quantities like "2l Milk", "3x Apples", "1kg Beef" will be automatically parsed.</li>
            </ul>
          </div>

          <Textarea
            placeholder="Milk, Bread, Eggs, Apples&#10;or&#10;Milk&#10;Bread&#10;Eggs&#10;Apples&#10;2l Milk&#10;3x Apples"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="min-h-[200px] mb-4 font-mono dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
            disabled={isOrganizing}
          />

          <Button
            onClick={handleOrganize}
            disabled={!rawText.trim() || isOrganizing}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          >
            {isOrganizing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Organizing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Organize Items
              </>
            )}
          </Button>
        </Card>
      )}

      {/* Step 2: Organized Items */}
      {organizedItems.length > 0 && !isImporting && (
        <>
          <Card className="p-6 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Organized Items ({organizedItems.length})</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOrganizedItems([]);
                  setWithAutoCategorization(true);
                  setWithAIImages(false);
                  setSelectedListId('');
                  setNewListName('');
                  setCreateNewList(false);
                }}
                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Review and edit your items. Remove any unwanted items or fix spelling. Quantities will be parsed during import.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
              {organizedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <Input
                    value={item.name}
                    onChange={(e) => handleEditItem(item.id, e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.id)}
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* Import Options */}
          <Card className="p-6 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Import Options</h3>

            <div className="space-y-4">
              {/* Auto Categorization Option */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  id="with-auto-categorization"
                  checked={withAutoCategorization}
                  onChange={(e) => setWithAutoCategorization(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 mt-0.5 flex-shrink-0 cursor-pointer"
                />
                <div className="flex-1">
                  <label htmlFor="with-auto-categorization" className="text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer block mb-1">
                    Auto-Categorize Items with AI
                  </label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Automatically categorize all items using AI (Produce, Dairy, etc.). Costs 2 credits for the entire batch.
                    {withAutoCategorization && (
                      <span className="block mt-2 text-blue-700 dark:text-blue-400 font-medium">
                        ✨ Enabled - Items will be intelligently categorized
                      </span>
                    )}
                    {!withAutoCategorization && (
                      <span className="block mt-2 text-slate-600 dark:text-slate-400 font-medium">
                        ⚪ Disabled - All items will be categorized as "Other"
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* With AI Images Option */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  id="with-ai-images"
                  checked={withAIImages}
                  onChange={(e) => setWithAIImages(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 mt-0.5 flex-shrink-0 cursor-pointer"
                />
                <div className="flex-1">
                  <label htmlFor="with-ai-images" className="text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer block mb-1">
                    Generate AI Images for New Items
                  </label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Items matching our master list will use existing photos (free). AI images will only be generated for items not in our database. 
                    {withAIImages && (
                      <span className="block mt-2 text-amber-700 dark:text-amber-400 font-medium">
                        🖼️ Enabled - AI images for items without master list photos
                      </span>
                    )}
                    {!withAIImages && (
                      <span className="block mt-2 text-slate-600 dark:text-slate-400 font-medium">
                        ⚪ Disabled - Only master list photos will be used
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Credit Summary */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  💰 Maximum Credits: {totalCreditsForImport}
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  {withAutoCategorization ? '2 credits for categorization (items not in master list)' : '0 credits (categorization disabled)'}
                  {withAutoCategorization && withAIImages && ' + '}
                  {withAIImages && `up to ${organizedItems.length} credits for images (only for items without master list photos)`}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  ✨ Items matching our master list use existing photos for free!
                </p>
              </div>
            </div>
          </Card>

          {/* List Selection */}
          <Card className="p-6 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Destination List</h3>

            <div className="space-y-4">
              {/* Existing List Option */}
              {userLists.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      id="existing-list"
                      checked={!createNewList}
                      onChange={() => setCreateNewList(false)}
                      className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                    />
                    <label htmlFor="existing-list" className="text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer">
                      Import to existing list
                    </label>
                  </div>
                  {!createNewList && (
                    <Select value={selectedListId} onValueChange={setSelectedListId}>
                      <SelectTrigger className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700">
                        <SelectValue placeholder="Select a list" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        {userLists.map((list) => (
                          <SelectItem 
                            key={list.id} 
                            value={list.id} 
                            className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                          >
                            {list.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* New List Option */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    id="new-list"
                    checked={createNewList}
                    onChange={() => setCreateNewList(true)}
                    className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                  />
                  <label htmlFor="new-list" className="text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer">
                    Create new list
                  </label>
                </div>
                {createNewList && (
                  <Input
                    placeholder="Enter new list name (e.g., Weekly Groceries)"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                )}
              </div>
            </div>
          </Card>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!canImport}
            className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Import {organizedItems.length} Items (up to {totalCreditsForImport} credits)
          </Button>
        </>
      )}

      {/* Step 4: Import Progress */}
      {isImporting && (
        <Card className="p-8 dark:bg-slate-900 dark:border-slate-700">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Importing Items...
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Processing {importProgress.current} of {importProgress.total}
            </p>
            {importProgress.currentItem && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">Current Item:</p>
                <p className="text-lg text-blue-700 dark:text-blue-300">{importProgress.currentItem}</p>
                {currentStatus && <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">{currentStatus}</p>}
              </div>
            )}
            <div className="mt-6">
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                {Math.round((importProgress.current / importProgress.total) * 100)}% complete
              </p>
            </div>
          </div>
        </Card>
      )}

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title={upgradeTitle}
        message={upgradeMessage}
        featureName="Additional Items"
      />
    </div>
  );
}