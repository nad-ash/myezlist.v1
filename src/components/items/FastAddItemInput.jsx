import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { User, Item, ActivityTracking, CommonItem } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { updateStatCount } from "@/api/functions";
import { InvokeLLM, GenerateImage } from "@/api/integrations";
import { consumeCredits, checkCreditsAvailable } from "@/components/utils/creditManager";
import { appCache } from "@/components/utils/appCache";
import { incrementUsage } from "@/components/utils/usageSync";
import { canAddItem } from "@/components/utils/tierManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";

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

export default function FastAddItemInput({ listId, onItemAdded }) {
  const [itemName, setItemName] = useState('');
  const [isFastAdding, setIsFastAdding] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [commonItemsCache, setCommonItemsCacheState] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingCache, setLoadingCache] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    loadCache();
  }, []);

  const loadCache = async () => {
    setLoadingCache(true);
    try {
      const { loadCommonItemsCache } = await import("@/components/utils/commonItemsCache");
      const cacheData = await loadCommonItemsCache();
      setCommonItemsCacheState(cacheData);
    } catch (error) {
      console.error("Error loading common items cache in component:", error);
      setCommonItemsCacheState([]);
    }
    setLoadingCache(false);
  };

  const extractQuantityFromName = (fullName) => {
    const quantityPattern = /\b(\d+(\.\d+)?\s*(kg|g|lb|lbs|oz|ml|l|litre|liter|pack|packs|x|dozen|piece|pieces)?)\b/i;
    const match = fullName.match(quantityPattern);
    
    if (match) {
      const extractedQty = match[0].trim();
      const cleanName = fullName.replace(match[0], '').trim();
      return { name: cleanName, quantity: extractedQty };
    }
    
    return { name: fullName, quantity: '' };
  };

  const handleNameChange = (value) => {
    setItemName(value);
    setSelectedSuggestion(null);
    
    if (value.trim().length >= 3) {
      const isOrganic = /\borganic\b/gi.test(value);
      const normalized = value.toLowerCase().trim().replace(/\borganic\b/gi, '').trim();
      const normalizedWords = normalized.split(/\s+/);
      
      // Score matches to prioritize better results
      // Higher score = better match
      const scoredMatches = commonItemsCache
        .map(ci => {
          const name = ci.name.toLowerCase();
          const displayName = ci.display_name.toLowerCase();
          const itemWords = name.split(/\s+/);
          
          let score = 0;
          
          // Exact match gets highest score
          if (name === normalized || displayName === normalized) {
            score = 1000;
          }
          // Plural/singular variation of a single word (e.g., "cranberry" → "cranberries")
          // Only if both are single words and one starts with the other
          else if (normalizedWords.length === 1 && itemWords.length === 1) {
            if (name.startsWith(normalized) || normalized.startsWith(name)) {
              score = 900 - Math.abs(name.length - normalized.length);
            }
          }
          // Multi-word search matching multi-word item (e.g., "orange juice" → "orange juice")
          else if (normalizedWords.length > 1 && name.startsWith(normalized)) {
            score = 800 - name.length;
          }
          // Single word search but item has multiple words - lower priority
          // (e.g., "cranberry" should NOT strongly match "cranberry juice")
          else if (normalizedWords.length === 1 && itemWords.length > 1) {
            // Only give points if the first word matches exactly or is a plural
            if (itemWords[0] === normalized || 
                itemWords[0].startsWith(normalized) && itemWords[0].length - normalized.length <= 3) {
              score = 200 - name.length; // Much lower score for compound items
            }
          }
          // Search term starts with item name
          else if (normalized.startsWith(name)) {
            score = 400 - name.length;
          }
          // Contains search term (fallback)
          else if (name.includes(normalized) || displayName.includes(normalized)) {
            score = 100 - name.length;
          }
          
          return { ...ci, _score: score };
        })
        .filter(ci => ci._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, 5)
        .map(ci => ({
          ...ci,
          // Show "Organic [Item]" if user typed organic and it's not already in the name
          display_name: isOrganic && !ci.display_name.toLowerCase().includes('organic')
            ? `Organic ${ci.display_name}`
            : ci.display_name,
          _isOrganic: isOrganic
        }));
      
      setSuggestions(scoredMatches);
      setShowSuggestions(scoredMatches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    // Keep the display name as shown (e.g., "Organic Orange")
    setItemName(suggestion.display_name);
    setSelectedSuggestion(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleAddItem = async () => {
    if (!itemName.trim()) {
      alert('Please enter an item name.');
      return;
    }

    // Check for duplicate item in the list
    const existingItems = await Item.filter({ list_id: listId });
    const normalizedName = itemName.toLowerCase().trim();
    const duplicate = existingItems.find(item => 
      item.name.toLowerCase().trim() === normalizedName
    );
    
    if (duplicate) {
      alert(`An item named "${itemName}" already exists in this list.`);
      setItemName('');
      setShowSuggestions(false);
      return;
    }

    // Check tier limits before adding item
    const tierCheck = await canAddItem();
    if (!tierCheck.canAdd) {
      setUpgradeMessage(tierCheck.message);
      setShowUpgradePrompt(true);
      return;
    }

    const needsAI = !selectedSuggestion;

    if (needsAI) {
      const creditCheck = await checkCreditsAvailable('fast_add_ai');
      if (!creditCheck.hasCredits) {
        alert(`Insufficient credits for Fast Add with AI. Need ${creditCheck.creditsNeeded} but only have ${creditCheck.creditsAvailable}. Go to Settings to view your credits.`);
        return;
      }
    }

    setIsFastAdding(true);
    setCurrentStatus('Processing...');
    let detectedCategory = 'Other';
    let photoUrl = '';

    try {
      const currentUser = await User.me();

      const { name: cleanName, quantity: extractedQty } = extractQuantityFromName(itemName);
      const capitalizedName = capitalizeWords(cleanName);
      const normalizedNameForLookup = cleanName.toLowerCase().trim().replace(/\borganic\b/gi, '').trim();
      
      const isOrganic = /\borganic\b/gi.test(itemName);

      let commonItemFound = null;

      if (selectedSuggestion) {
        commonItemFound = selectedSuggestion;
        setCurrentStatus('Using selected item data...');
      } else {
        setCurrentStatus('Checking item database...');
        
        const searchWords = normalizedNameForLookup.split(/\s+/);
        const isSingleWordSearch = searchWords.length === 1;
        
        // Smart matching: strict matching to avoid false positives
        // 1. Try exact match
        commonItemFound = commonItemsCache.find(ci => 
          ci.name === normalizedNameForLookup || 
          ci.display_name.toLowerCase() === normalizedNameForLookup
        );
        
        // 2. Try plural/singular match (only for single-word items)
        // "cranberry" should match "cranberries" but NOT "cranberry juice"
        if (!commonItemFound && isSingleWordSearch) {
          const singleWordMatches = commonItemsCache
            .filter(ci => {
              const itemWords = ci.name.split(/\s+/);
              // Only match single-word items
              if (itemWords.length !== 1) return false;
              // Check if one starts with the other (plural/singular variation)
              return ci.name.startsWith(normalizedNameForLookup) || 
                     normalizedNameForLookup.startsWith(ci.name);
            })
            .sort((a, b) => a.name.length - b.name.length);
          commonItemFound = singleWordMatches[0] || null;
        }
        
        // 3. For multi-word searches, match if item starts with the search term
        if (!commonItemFound && !isSingleWordSearch) {
          commonItemFound = commonItemsCache.find(ci => 
            ci.name.startsWith(normalizedNameForLookup)
          );
        }
        
        if (commonItemFound) {
          setCurrentStatus('Using existing item data...');
        }
      }

      if (commonItemFound) {
        detectedCategory = commonItemFound.category;
        photoUrl = commonItemFound.photo_url || '';
        
        // Increment usage count via secure RPC function (fire-and-forget)
        if (commonItemFound.id) {
          supabase.rpc('increment_common_item_usage', { item_id: commonItemFound.id })
            .catch(err => console.warn("Could not update usage count:", err));
        }
      } else {
        const creditResult = await consumeCredits(
          'fast_add_ai',
          `Fast add with AI: "${capitalizedName}"`,
          {}
        );

        if (!creditResult.success) {
          alert(creditResult.message);
          setIsFastAdding(false);
          setCurrentStatus('');
          return;
        }

        setCurrentStatus('Categorizing item...');
        try {
          const categoryPrompt = `Given this grocery/household item: "${capitalizedName}", classify it into one of these categories: ${categories.join(", ")}. Return ONLY the category name, nothing else.`;
          const categoryResponse = await InvokeLLM({
            prompt: categoryPrompt,
            response_json_schema: { type: "object", properties: { category: { type: "string", enum: categories } } }
          });
          if (categoryResponse.category && categories.includes(categoryResponse.category)) {
            detectedCategory = categoryResponse.category;
          }
        } catch (catError) {
          console.warn("Could not auto-categorize item:", catError);
        }

        setCurrentStatus('Generating image (may take 10-15 seconds)...');
        try {
          const imagePrompt = `A clean, professional product photo of ${capitalizedName} on a white background, centered, well-lit, high quality product photography`;
          const imageResult = await GenerateImage({ prompt: imagePrompt });
          if (imageResult.url) {
            photoUrl = imageResult.url;
          }
        } catch (imgError) {
          console.warn("Image generation failed, continuing without image:", imgError);
        }

        // Note: We don't add to CommonItem automatically
        // Only admins manually curate the Master Item List
        console.log('ℹ️ Skipping CommonItem creation - let admins curate the Master List manually');
      }

      setCurrentStatus(`Adding "${capitalizedName}" to list...`);
      await Item.create({
        list_id: listId,
        name: capitalizedName,
        quantity: extractedQty,
        category: detectedCategory,
        photo_url: photoUrl,
        added_by: currentUser.email,
        is_organic: isOrganic,
      });

      // Increment total items count
      await incrementUsage('current_total_items');

      // Update statistics - atomic increment total_items
      await updateStatCount('total_items', 1);

      // CRITICAL FIX: Clear cache for this specific list so ListView will reload fresh data
      console.log(`🗑️ FastAddItemInput: Clearing cache for list ${listId} (item added via quick add)`);
      appCache.clearShoppingList(listId);

      setItemName('');
      setSelectedSuggestion(null);
      setCurrentStatus('');
      onItemAdded();
    } catch (error) {
      console.error("Error during fast add item:", error);
      alert("Failed to add item. Please try again.");
      setCurrentStatus('');
    } finally {
      setIsFastAdding(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg p-3 mb-4 border border-blue-200 shadow-sm dark:bg-slate-800 dark:border-slate-600">
        <div className="flex items-center gap-2 mb-2">
          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Quick Add</h3>
          {loadingCache && (
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          )}
        </div>
      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <Input
            placeholder="Item name (e.g., Milk, 2lb Chicken)"
            value={itemName}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => e.key === 'Enter' && !isFastAdding && handleAddItem()}
            disabled={isFastAdding}
            className="h-9 text-sm dark:bg-slate-700 dark:text-white dark:border-slate-600"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto dark:bg-slate-800 dark:border-slate-600">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => handleSuggestionClick(suggestion)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center justify-between dark:hover:bg-slate-700"
                >
                  <span className="text-sm text-slate-800 dark:text-white">{suggestion.display_name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{suggestion.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          onClick={handleAddItem}
          disabled={isFastAdding || !itemName.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 text-sm"
        >
          {isFastAdding ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </>
          )}
        </Button>
      </div>
        {isFastAdding && currentStatus && (
          <div className="mt-2 text-xs text-blue-600 flex items-center gap-2 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{currentStatus}</span>
          </div>
        )}
      </div>

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title="Item Limit Reached"
        message={upgradeMessage}
        featureName="Additional Items"
      />
    </>
  );
}