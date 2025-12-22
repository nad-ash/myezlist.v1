import React, { useState, useEffect } from "react";
import { User, Recipe, RecipeFavorite, ShoppingList, ListMember, Item, ActivityTracking, CommonItem } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { trackRecipe, trackRecipeFavorite } from "@/utils/trackingContext";
import { InvokeLLM, GenerateImage, UploadFile, AI_USE_CASES } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  ChefHat,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  RotateCcw,
  Check,
  Sparkles,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Upload,
  Star,
  Share2,
  ShoppingCart,
  CheckCircle
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { parseIngredients } from "@/components/utils/ingredientParser";
import { checkCreditsAvailable, consumeCredits } from "@/components/utils/creditManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import ShareRecipeDialog from "@/components/recipes/ShareRecipeDialog";
import SignupPrompt from "@/components/common/SignupPrompt";
import { incrementUsage } from "@/components/utils/usageSync";
import { appCache } from "@/components/utils/appCache";
import { canCreateCustomRecipe } from "@/components/utils/tierManager";

export default function RecipeDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState({});
  const [stepTimers, setStepTimers] = useState({});
  const [completedSteps, setCompletedSteps] = useState({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [isColorfulTheme, setIsColorfulTheme] = useState(false);

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageOptions, setGeneratedImageOptions] = useState([]);
  const [selectedImageOption, setSelectedImageOption] = useState(null);
  const [user, setUser] = useState(null);

  // New states for shopping list integration
  const [showAddToListDialog, setShowAddToListDialog] = useState(false);
  const [userLists, setUserLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [createNewList, setCreateNewList] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importStatus, setImportStatus] = useState('');
  const [importItems, setImportItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [importTargetListId, setImportTargetListId] = useState('');
  const [includeQuantities, setIncludeQuantities] = useState(false);

  // Credit management states
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Delete recipe state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Signup prompt state for guest users
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [signupFeature, setSignupFeature] = useState("default");

  const urlParams = new URLSearchParams(window.location.search);
  const recipeId = urlParams.get("id");
  const fromTab = urlParams.get("from") || "browse";

  // New function to load user and favorite status
  const loadUserAndFavorite = async (currentRecipeId) => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      if (currentUser && currentUser.id && currentRecipeId) {
        const userFavorites = await RecipeFavorite.filter({
          user_id: currentUser.id,
          recipe_id: currentRecipeId
        });
        setIsFavorite(userFavorites.length > 0);
      } else {
        setIsFavorite(false);
      }
    } catch (error) {
      console.error("Error loading user/favorites:", error);
    }
  };

  useEffect(() => {
    // ✅ Check if recipe was passed via navigation state AND matches the URL ID
    if (location.state?.recipe && location.state.recipe.id === recipeId) {
      console.log('📦 RecipeDetail: Using recipe from navigation state');
      const recipeFromState = location.state.recipe;
      setRecipe(recipeFromState);

      // Initialize timers for the recipe
      const timers = {};
      (recipeFromState.steps || []).forEach((_, idx) => {
        timers[idx] = { seconds: 0, isRunning: false };
      });
      setStepTimers(timers);

      // Load user and check if favorited
      loadUserAndFavorite(recipeFromState.id);
      setLoading(false);
    } else if (recipeId) {
      // Fallback to loading from API if no state or ID mismatch
      console.log('🔄 RecipeDetail: Loading recipe from API');
      loadRecipe();
    } else {
      setLoading(false);
    }

    // Check initial theme
    setIsColorfulTheme(document.documentElement.classList.contains('theme-colorful'));

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      setIsColorfulTheme(document.documentElement.classList.contains('theme-colorful'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [recipeId, location.state]);

  const loadRecipe = async () => {
    setLoading(true);
    try {
      // ✅ Try to get recipe from cache first
      let allRecipes = appCache.getRecipes();
      
      if (allRecipes) {
        console.log('📦 RecipeDetail: Using cached recipes');
      } else {
        console.log('🔄 RecipeDetail: Fetching recipes from API (cache miss)');
        allRecipes = await Recipe.list();
        appCache.setRecipes(allRecipes);
      }
      
      const foundRecipe = allRecipes.find((r) => r.id === recipeId);
      if (foundRecipe) {
        setRecipe(foundRecipe);

        // Call the common function to load user and favorite status
        loadUserAndFavorite(foundRecipe.id);

        const timers = {};
        (foundRecipe.steps || []).forEach((_, idx) => {
          timers[idx] = { seconds: 0, isRunning: false };
        });
        setStepTimers(timers);
      }
    } catch (error) {
      console.error("Error loading recipe:", error);
    }
    setLoading(false);
  };

  const handleBackClick = () => {
    // Map 'from' parameter to actual page names
    const pageMap = {
      'popular': 'PopularRecipes',
      'favorites': 'FavoriteRecipes',
      'myrecipes': 'MyRecipes',
      'recipe': 'Recipe',
      'browse': 'PopularRecipes'
    };

    const targetPage = pageMap[fromTab] || 'Recipe';
    navigate(createPageUrl(targetPage));
  };

  const toggleFavorite = async () => {
    if (!user || !user.id || !recipe?.id) {
      // Show signup prompt for guests
      setSignupFeature("favorites");
      setShowSignupPrompt(true);
      return;
    }
    try {
      if (isFavorite) {
        // Unfavorite
        const favRecords = await RecipeFavorite.filter({
          recipe_id: recipe.id,
          user_id: user.id
        });
        if (favRecords.length > 0) {
          await RecipeFavorite.delete(
            favRecords[0].id,
            trackRecipeFavorite.remove(user.id, recipe.full_title)
          );
        }
        setIsFavorite(false);

        // Clear recipe favorites cache so Recipe page sees updated count
        appCache.clearRecipeFavorites(user.id);
      } else {
        // Favorite
        await RecipeFavorite.create(
          {
            recipe_id: recipe.id,
            user_id: user.id
          },
          trackRecipeFavorite.add(user.id, recipe.full_title)
        );
        setIsFavorite(true);

        // Clear recipe favorites cache so Recipe page sees updated count
        appCache.clearRecipeFavorites(user.id);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      alert("Failed to update favorite. Please try again.");
    }
  };

  // Handle share button click - opens share dialog
  const handleShareClick = () => {
    setShowShareDialog(true);
  };

  // Track share activity when user shares via any platform
  const handleShareTracking = (platform) => {
    if (!user?.id || !recipe) return;
    
    ActivityTracking.create({
      operation_type: 'CREATE',
      page: 'RecipeDetail',
      operation_name: 'Share Recipe',
      description: `User shared recipe "${recipe.full_title}" via ${platform}`,
      user_id: user.id
    });
  };

  // Handle delete recipe
  const handleDeleteRecipe = async () => {
    if (!user || !recipe) return;
    
    setDeleting(true);
    try {
      // Delete the recipe
      await Recipe.delete(recipe.id);
      
      // Decrement custom recipes count for this user
      const currentUser = await User.me();
      const newRecipeCount = Math.max(0, (currentUser.current_custom_recipes || 1) - 1);
      await User.updateMe({ current_custom_recipes: newRecipeCount });
      
      // Update statistics - atomic decrement total_user_generated_recipes
      await updateStatCount('total_user_generated_recipes', -1);
      
      // Clear recipes cache
      appCache.clearRecipes();
      appCache.clearUser();
      
      // Track activity
      ActivityTracking.create({
        operation_type: 'DELETE',
        page: 'RecipeDetail',
        operation_name: 'Delete Custom Recipe',
        description: `User deleted custom recipe "${recipe.full_title}"`,
        user_id: user.id,
        timestamp: new Date().toISOString()
      });
      
      // Navigate back to My Recipes
      navigate(createPageUrl('MyRecipes'));
    } catch (error) {
      console.error("Error deleting recipe:", error);
      alert("Failed to delete recipe. Please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditClick = async () => {
    // Check if user is logged in
    if (!user || !user.id) {
      setSignupFeature("edit");
      setShowSignupPrompt(true);
      return;
    }

    // If editing own recipe, no need to check limits (not creating new one)
    const isOwnRecipe = recipe.is_user_generated && recipe.generated_by_user_id === user?.id;
    
    if (!isOwnRecipe) {
      // Only check limits when customizing someone else's recipe (creating new)
      try {
        const canCreate = await canCreateCustomRecipe();
        if (!canCreate.canCreate) {
          setUpgradeMessage(canCreate.message);
          setShowUpgradePrompt(true);
          return;
        }
      } catch (error) {
        console.error("Error checking custom recipe limits:", error);
        setUpgradeMessage("Failed to check custom recipe limits. Please try again.");
        setShowUpgradePrompt(true);
        return;
      }
    }
    
    setEditedRecipe(JSON.parse(JSON.stringify(recipe)));
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (confirm("Are you sure you want to discard all changes?")) {
      setIsEditMode(false);
      setEditedRecipe(null);
      setGeneratedImageOptions([]);
      setSelectedImageOption(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedRecipe.full_title?.trim()) {
      alert("Please enter a dish name");
      return;
    }

    if (!editedRecipe.ingredients || editedRecipe.ingredients.length === 0) {
      alert("Please add at least one ingredient");
      return;
    }

    if (!editedRecipe.steps || editedRecipe.steps.length === 0) {
      alert("Please add at least one cooking step");
      return;
    }

    setSaving(true);
    try {
      // Only update existing recipe if it's the user's own recipe
      const isOwnRecipe = recipe.is_user_generated && recipe.generated_by_user_id === user?.id;
      
      if (isOwnRecipe) {
        // Update existing recipe - no count increment
        await Recipe.update(recipe.id, {
          recipe_name: editedRecipe.full_title,
          full_title: editedRecipe.full_title,
          cooking_time: editedRecipe.cooking_time,
          cuisine: editedRecipe.cuisine,
          servings: editedRecipe.servings,
          calories_per_serving: editedRecipe.calories_per_serving,
          photo_url: selectedImageOption || editedRecipe.photo_url,
          ingredients: editedRecipe.ingredients,
          steps: editedRecipe.steps
        });

        // Track activity
        ActivityTracking.create({
          operation_type: 'UPDATE',
          page: 'RecipeDetail',
          operation_name: 'Update Custom Recipe',
          description: `User updated custom recipe "${editedRecipe.full_title}"`,
          user_id: user.id
        });

        // Clear recipes cache
        appCache.clearRecipes();

        // Refresh the current page with updated data
        setRecipe({ ...recipe, ...editedRecipe, photo_url: selectedImageOption || editedRecipe.photo_url });
        setIsEditMode(false);
        setEditedRecipe(null);
        setGeneratedImageOptions([]);
        setSelectedImageOption(null);
      } else {
        // Create new recipe - increment count
        const newRecipe = await Recipe.create({
          recipe_name: editedRecipe.full_title,
          full_title: editedRecipe.full_title,
          cooking_time: editedRecipe.cooking_time,
          cuisine: editedRecipe.cuisine,
          servings: editedRecipe.servings,
          calories_per_serving: editedRecipe.calories_per_serving,
          photo_url: selectedImageOption || editedRecipe.photo_url,
          ingredients: editedRecipe.ingredients,
          steps: editedRecipe.steps,
          is_user_generated: true,
          generated_by_user_id: user.id
        });

        // Increment custom recipes count
        await incrementUsage('current_custom_recipes');

        // Update statistics - atomic increment total_user_generated_recipes
        await updateStatCount('total_user_generated_recipes', 1);

        // Track activity
        ActivityTracking.create({
          operation_type: 'CREATE',
          page: 'RecipeDetail',
          operation_name: 'Save Customized Recipe',
          description: `User saved customized version of "${recipe.full_title}" as "${editedRecipe.full_title}"`,
          user_id: user.id
        });

        // Clear recipes cache
        appCache.clearRecipes();

        // Exit edit mode before navigating to prevent stale state
        setIsEditMode(false);
        setEditedRecipe(null);
        setGeneratedImageOptions([]);
        setSelectedImageOption(null);

        navigate(createPageUrl(`RecipeDetail?id=${newRecipe.id}&from=${fromTab}`));
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      alert("Failed to save recipe. Please try again.");
    }
    setSaving(false);
  };

  const handleUploadImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = UploadFile({ file }); // Await this call if it's asynchronous
      setEditedRecipe({ ...editedRecipe, photo_url: result.file_url });
      setSelectedImageOption(null);
      setGeneratedImageOptions([]);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image. Please try again.");
    }
  };

  const handleGenerateImage = async () => {
    if (!editedRecipe.full_title?.trim()) {
      alert("Please enter a dish name first");
      return;
    }

    setGeneratingImage(true);
    setGeneratedImageOptions([]);
    setSelectedImageOption(null);

    try {
      const prompt = `A professional, appetizing food photography of ${editedRecipe.full_title}, beautifully plated, well-lit, restaurant quality, high resolution`;

      const results = await Promise.all([
        GenerateImage({ prompt }),
        GenerateImage({ prompt })
      ]);

      setGeneratedImageOptions([results[0].url, results[1].url]);
    } catch (error) {
      console.error("Error generating images:", error);
      alert("Failed to generate images. Please try again.");
    }
    setGeneratingImage(false);
  };

  const handleSelectImageOption = (url) => {
    setSelectedImageOption(url);
  };

  const addIngredient = () => {
    setEditedRecipe({
      ...editedRecipe,
      ingredients: [...(editedRecipe.ingredients || []), ""]
    });
  };

  const updateIngredient = (index, value) => {
    const newIngredients = [...editedRecipe.ingredients];
    newIngredients[index] = value;
    setEditedRecipe({ ...editedRecipe, ingredients: newIngredients });
  };

  const removeIngredient = (index) => {
    const newIngredients = editedRecipe.ingredients.filter((_, i) => i !== index);
    setEditedRecipe({ ...editedRecipe, ingredients: newIngredients });
  };

  const addStep = () => {
    setEditedRecipe({
      ...editedRecipe,
      steps: [...(editedRecipe.steps || []), { title: "", instruction: "" }]
    });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...editedRecipe.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setEditedRecipe({ ...editedRecipe, steps: newSteps });
  };

  const removeStep = (index) => {
    const newSteps = editedRecipe.steps.filter((_, i) => i !== index);
    setEditedRecipe({ ...editedRecipe, steps: newSteps });
  };

  const toggleStep = (index) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleTimer = (index) => {
    setStepTimers((prev) => {
      const newTimers = { ...prev };
      newTimers[index] = {
        ...newTimers[index],
        isRunning: !newTimers[index].isRunning
      };
      return newTimers;
    });
  };

  const resetTimer = (index) => {
    setStepTimers((prev) => {
      const newTimers = { ...prev };
      newTimers[index] = { seconds: 0, isRunning: false };
      return newTimers;
    });
  };

  const toggleStepComplete = (index) => {
    setCompletedSteps((prev) => {
      const newCompleted = { ...prev };
      newCompleted[index] = !newCompleted[index];

      if (newCompleted[index]) {
        setStepTimers((prevTimers) => {
          const newTimers = { ...prevTimers };
          newTimers[index] = { ...newTimers[index], isRunning: false };
          return newTimers;
        });
      }

      return newCompleted;
    });
  };

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStepTimers((prev) => {
        const newTimers = { ...prev };
        Object.keys(newTimers).forEach((key) => {
          if (newTimers[key].isRunning) {
            newTimers[key] = {
              ...newTimers[key],
              seconds: newTimers[key].seconds + 1
            };
          }
        });
        return newTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor(seconds % 3600 / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine button text based on where user came from and recipe ownership
  const getEditButtonText = () => {
    // If it's the user's own recipe, show "Edit Recipe"
    const isOwnRecipe = recipe?.is_user_generated && recipe?.generated_by_user_id === user?.id;
    if (isOwnRecipe) {
      return 'Edit Recipe';
    }
    
    // For master recipes or other users' recipes, show "Customize as My Own"
    if (fromTab === 'popular' || fromTab === 'browse' || fromTab === 'recipe') {
      return 'Customize as My Own';
    }
    return 'Edit Recipe';
  };

  // New functions for shopping list integration
  const loadUserLists = async () => {
    try {
      const currentUser = await User.me();
      if (!currentUser) {
        // Handle case where user is not logged in, e.g., redirect or show message
        alert("Please log in to access shopping lists.");
        return;
      }
      setUser(currentUser); // Ensure user state is set
      const memberships = await ListMember.filter({ user_id: currentUser.id });
      const listIds = memberships.filter((m) => m.status === 'approved' || m.role === 'owner').map((m) => m.list_id);

      if (listIds.length > 0) {
        const allLists = await ShoppingList.list();
        const lists = allLists.filter((list) => listIds.includes(list.id) && !list.archived);
        setUserLists(lists);
        if (lists.length > 0 && !importTargetListId) {
          setImportTargetListId(lists[0].id); // Pre-select the first list
        }
      } else {
        setUserLists([]);
        setImportTargetListId('');
        // If no lists, automatically set to create new list
        setCreateNewList(true);
      }
    } catch (error) {
      console.error("Error loading lists:", error);
      alert("Failed to load shopping lists. Please try again.");
    }
  };

  const handleAddToShoppingList = async () => {
    if (!user || !user.id) {
      // Show signup prompt for guests
      setSignupFeature("shopping");
      setShowSignupPrompt(true);
      return;
    }
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      alert('No ingredients to add.');
      return;
    }

    // Check credit availability for this premium feature
    const creditCheck = await checkCreditsAvailable('recipe_add_to_list');

    if (!creditCheck.hasCredits) {
      setUpgradeMessage(creditCheck.message || `You need ${creditCheck.creditsNeeded} credits but only have ${creditCheck.creditsAvailable} remaining.`);
      setShowUpgradePrompt(true);
      return;
    }

    setImporting(true);
    setShowAddToListDialog(true);
    
    try {
      // Log the ingredients we're processing
      console.log('Recipe ingredients to process:', recipe.ingredients);
      console.log('Ingredients count:', recipe.ingredients?.length || 0);
      
      // Normalize ingredients to strings (handle both string and object formats)
      const normalizedIngredients = recipe.ingredients.map(ing => {
        if (typeof ing === 'string') return ing;
        // Object format: { name, quantity, notes }
        return (ing.quantity ? `${ing.quantity} ${ing.name}` : ing.name) + (ing.notes ? ` (${ing.notes})` : '');
      });
      
      // Use LLM to extract clean ingredient names and categorize in ONE call
      const ingredientsList = normalizedIngredients.map((ing, idx) => `${idx + 1}. ${ing}`).join('\n');
      console.log('Formatted ingredients list for LLM:', ingredientsList);
      
      const extractionResponse = await InvokeLLM({
        prompt: `Extract clean ingredient names (without quantities, measurements, or descriptors) from these recipe ingredients and categorize each.

Ingredients:
${ingredientsList}

For each ingredient, extract ONLY the core item name (e.g., "tomatoes" from "2 large ripe tomatoes", "flour" from "2 cups all-purpose flour").
Remove all: quantities, measurements, descriptors (fresh, ripe, chopped), preparation notes.
Keep plurals as-is. Return item names in their natural form.

Return JSON with an array of objects, each containing:
- original: the full original ingredient text
- item: the clean extracted item name
- quantity: the quantity/measurement part (e.g., "2 cups", "1 lb")
- category: one of these categories: Produce, Pantry, Dairy, Meat & Seafood, Frozen, Beverages, Snacks, Household, Bakery, Personal Care, Cleaning, Baby, Pet, Other`,
        response_json_schema: {
          type: "object",
          properties: {
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  original: { type: "string" },
                  item: { type: "string" },
                  quantity: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["Produce", "Pantry", "Dairy", "Meat & Seafood", "Frozen", "Beverages", "Snacks", "Household", "Bakery", "Personal Care", "Cleaning", "Baby", "Pet", "Other"]
                  }
                },
                required: ["original", "item", "category"]
              }
            }
          },
          required: ["ingredients"]
        }
      });

      console.log('LLM extraction response:', extractionResponse);
      
      // Handle both response formats:
      // 1. { ingredients: [...] } - wrapped in object
      // 2. [...] - direct array
      let extractedIngredients = [];
      if (Array.isArray(extractionResponse)) {
        // Response is a direct array
        extractedIngredients = extractionResponse;
      } else if (extractionResponse?.ingredients) {
        // Response is wrapped in { ingredients: [...] }
        extractedIngredients = extractionResponse.ingredients;
      } else if (typeof extractionResponse === 'object' && extractionResponse !== null) {
        // Response might be an object with numeric keys (array-like)
        const keys = Object.keys(extractionResponse);
        if (keys.length > 0 && keys.every(k => !isNaN(parseInt(k)))) {
          extractedIngredients = Object.values(extractionResponse);
        }
      }
      
      console.log('Extracted ingredients count:', extractedIngredients.length);
      
      if (extractedIngredients.length === 0) {
        console.warn('No ingredients extracted from LLM response. Raw response:', JSON.stringify(extractionResponse));
      }
      
      const items = extractedIngredients.map((extracted, idx) => ({
        id: `temp-${idx}`,
        quantity: extracted.quantity || '',
        item: extracted.item || '',
        category: extracted.category || 'Other',
        editing: false
      }));

      setImportItems(items);
      setSelectedItemIds([]); // Start with no items selected so user can choose
      setImportTargetListId(''); // Reset target list
      setCreateNewList(false);
      setNewListName('');
      setIncludeQuantities(false);
      await loadUserLists();
    } catch (error) {
      console.error("Error extracting ingredients:", error);
      alert("Failed to process ingredients. Please try again.");
      setShowAddToListDialog(false);
    }
    
    setImporting(false);
  };

  const handleUpdateImportItem = (itemId, field, newValue) => {
    setImportItems((items) =>
      items.map((item) => item.id === itemId ? { ...item, [field]: newValue } : item)
    );
  };

  const handleRemoveImportItem = (itemId) => {
    setImportItems((items) => items.filter((item) => item.id !== itemId));
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
  };

  const handleToggleItemSelection = (itemId) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === importItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(importItems.map((item) => item.id));
    }
  };

  const handleImportSelectedItems = async () => {
    if (selectedItemIds.length === 0) {
      alert('Please select at least one ingredient.');
      return;
    }

    if (selectedItemIds.length > 25) {
      alert('Maximum 25 ingredients allowed per import. Please select fewer items and try again.');
      return;
    }

    if (!createNewList && !importTargetListId) {
      alert('Please select a list or create a new one.');
      return;
    }

    if (createNewList && !newListName.trim()) {
      alert('Please enter a name for the new list.');
      return;
    }

    const itemsToImport = importItems.filter((item) => selectedItemIds.includes(item.id));
    setImportProgress({ current: 0, total: itemsToImport.length });
    setImportStatus('Preparing...');
    setImporting(true);

    try {
      let targetListId = importTargetListId;

      // Create new list if needed
      if (createNewList) {
        setImportStatus('Creating new list...');
        const newList = await ShoppingList.create({
          name: newListName.trim(),
          owner_id: user.id,
          icon: 'utensils',
          color: 'sunset'
        });

        await ListMember.create({
          list_id: newList.id,
          user_id: user.id,
          user_email: user.email,
          role: 'owner',
          status: 'approved'
        });

        // Increment shopping list count (per-user)
        await incrementUsage('current_shopping_lists');
        
        // Update statistics - atomic increment total_lists (global)
        await updateStatCount('total_lists', 1);

        // Clear caches so the new list and membership are visible
        appCache.clearShoppingListEntities();
        appCache.clearListMemberships(user.id);
        appCache.clearAllShoppingLists();

        targetListId = newList.id;
      }

      setImportStatus('Checking for duplicates...');
      const existingItems = await Item.filter({ list_id: targetListId });
      const existingItemsMap = new Map(
        existingItems.map((item) => [item.name.toLowerCase().trim(), item])
      );

      // Load master item list for intelligent image matching
      setImportStatus('Loading item database...');
      const masterItems = await CommonItem.list();
      
      // Helper function to normalize item names for matching (handles plurals, organic, etc.)
      const normalizeForMatching = (name) => {
        let normalized = name.toLowerCase().trim();
        // Remove common prefixes
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
          'cherry': 'cherries'
        };
        
        // Try to match both forms
        return {
          exact: normalized,
          variants: [
            normalized,
            // Try plural if it's singular
            singularToPlural[normalized] || normalized + 's',
            // Try singular if it's plural (remove 's')
            normalized.endsWith('s') ? normalized.slice(0, -1) : normalized,
            // Try removing 'es' ending
            normalized.endsWith('es') ? normalized.slice(0, -2) : normalized
          ].filter((v, i, arr) => arr.indexOf(v) === i) // unique values
        };
      };
      
      // Build master item lookup with variants
      const masterItemLookup = new Map();
      masterItems.forEach(item => {
        const variants = normalizeForMatching(item.name);
        variants.variants.forEach(variant => {
          if (!masterItemLookup.has(variant)) {
            masterItemLookup.set(variant, item);
          }
        });
      });

      // Process items - check existing and prepare new items with master images
      setImportStatus('Processing ingredients...');
      const itemsToCreate = [];
      let processedCount = 0;

      for (const importItem of itemsToImport) {
        processedCount++;
        setImportProgress({ current: processedCount, total: itemsToImport.length });
        setImportStatus(`Processing ${processedCount} of ${itemsToImport.length}...`);

        const capitalizedName = importItem.item.replace(/\b\w/g, (char) => char.toUpperCase());
        const existingItem = existingItemsMap.get(capitalizedName.toLowerCase().trim());

        if (existingItem) {
          if (existingItem.is_checked) {
            await Item.update(existingItem.id, {
              is_checked: false,
              checked_date: null
            });
          }
        } else {
          // Find matching master item using intelligent matching
          const variants = normalizeForMatching(capitalizedName);
          let masterItem = null;
          
          for (const variant of variants.variants) {
            if (masterItemLookup.has(variant)) {
              masterItem = masterItemLookup.get(variant);
              console.log(`✅ Master match: "${capitalizedName}" → "${masterItem.name}" (via "${variant}")`);
              break;
            }
          }
          
          itemsToCreate.push({
            name: capitalizedName,
            quantity: includeQuantities ? importItem.quantity : '',
            category: importItem.category || 'Other',
            photo_url: masterItem?.photo_url || null
          });
        }
      }

      // Create all items with their categories and images from master list
      setImportStatus('Adding items to list...');
      let createdCount = 0;
      for (const itemData of itemsToCreate) {
        createdCount++;
        setImportStatus(`Adding item ${createdCount} of ${itemsToCreate.length}...`);
        console.log(`🔎 Creating: "${itemData.name}" → category: ${itemData.category} → photo: ${itemData.photo_url ? '✅' : '❌'}`);

        await Item.create({
          list_id: targetListId,
          name: itemData.name,
          quantity: itemData.quantity,
          category: itemData.category,
          photo_url: itemData.photo_url,
          added_by: user.email
        });
      }

      // Increment total items count by number of items created
      if (itemsToCreate.length > 0) {
        const currentUser = await User.me();
        const newItemCount = (currentUser.current_total_items || 0) + itemsToCreate.length;
        await User.updateMe({ current_total_items: newItemCount });
        appCache.clearUser();
        
        // Update statistics - atomic increment total_items (global)
        await updateStatCount('total_items', itemsToCreate.length);
      }

      // Clear the specific list's cache so items are visible
      appCache.clearShoppingList(targetListId);

      // SUCCESS! Now consume credits for this premium feature
      const listName = createNewList ? newListName.trim() : userLists.find((l) => l.id === targetListId)?.name || 'the list';

      await consumeCredits(
        'recipe_add_to_list',
        `Added ${itemsToImport.length} ingredients from "${recipe.full_title}" to ${listName}`,
        {
          recipe_id: recipe.id,
          recipe_name: recipe.full_title,
          list_id: targetListId,
          list_name: listName,
          ingredients_count: itemsToImport.length
        }
      );

      // Track activity
      setImportStatus('Finishing up...');
      ActivityTracking.create({
        operation_type: 'CREATE',
        page: 'RecipeDetail',
        operation_name: 'Add Recipe Ingredients to Shopping List',
        description: `User added ${itemsToImport.length} ingredients from recipe "${recipe.full_title}" to list "${listName}"`,
        user_id: user.id,
        timestamp: new Date().toISOString()
      });

      setImportProgress({ current: itemsToImport.length, total: itemsToImport.length });
      setImportStatus('Complete!');
      setImporting(false);
      setShowAddToListDialog(false);

      // Show success message
      alert(`Successfully added ${itemsToImport.length} ingredients to ${listName}!`);

      // Navigate to the list view page
      navigate(createPageUrl(`ListView?listId=${targetListId}`));
    } catch (error) {
      console.error("Error importing ingredients:", error);
      alert("Failed to add ingredients. Please try again.");
      setImporting(false);
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading recipe...</p>
      </div>);

  }

  if (!recipe) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <ChefHat className="w-20 h-20 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
            Recipe not found
          </h3>
          <Button onClick={handleBackClick}>
            Back to Recipes
          </Button>
        </div>
      </div>);

  }

  const displayRecipe = isEditMode ? editedRecipe : recipe;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 overflow-x-hidden">
      <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={isEditMode ? handleCancelEdit : handleBackClick}
          className="dark:text-slate-200 dark:hover:bg-slate-700 flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10">

          {isEditMode ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
        </Button>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex-1 min-w-0 truncate">
          {isEditMode ? "Edit Recipe" : "Recipe Details"}
        </h1>
        {!isEditMode &&
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Share Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleShareClick}
              className="border-2 border-blue-500 hover:bg-blue-50 dark:border-blue-600 dark:hover:bg-blue-900/20 h-9 w-9 sm:h-10 sm:w-10"
              title="Share Recipe">

              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </Button>
            {/* Favorite Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFavorite}
              className={cn(
                "border-2 transition-all h-9 w-9 sm:h-10 sm:w-10",
                isFavorite ?
                  "bg-yellow-50 border-yellow-400 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-600" :
                  "border-slate-300 hover:border-yellow-400 dark:border-slate-600 dark:hover:bg-slate-700"
              )}>

              <Star
                className={cn(
                  "w-4 h-4 sm:w-5 sm:h-5",
                  isFavorite ? "fill-yellow-500 text-yellow-500" : "text-slate-400"
                )} />

            </Button>
            {/* Delete Button - Only for user's own recipes */}
            {recipe?.is_user_generated && recipe?.generated_by_user_id === user?.id && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-2 border-red-400 hover:bg-red-50 dark:border-red-600 dark:hover:bg-red-900/20 h-9 w-9 sm:h-10 sm:w-10"
                title="Delete Recipe">
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 dark:text-red-400" />
              </Button>
            )}
            {/* Edit/Customize Button - Hidden on mobile, show below */}
            <Button
              onClick={handleEditClick}
              className="hidden sm:flex bg-orange-600 hover:bg-orange-700 h-10 px-4">

              <Pencil className="w-4 h-4 mr-2" />
              <span>{getEditButtonText()}</span>
            </Button>
          </div>
        }
        {isEditMode &&
          <Button
            onClick={handleSaveEdit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 h-9 px-3 sm:h-10 sm:px-4 text-sm sm:text-base flex-shrink-0">

            {saving ?
              <>
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                <span className="hidden sm:inline">Saving...</span>
                <span className="sm:hidden">Save</span>
              </> :

              <>
                <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Save as My Recipe</span>
                <span className="sm:hidden">Save</span>
              </>
            }
          </Button>
        }
      </div>

      {/* Mobile Edit Button - Full width below header */}
      {!isEditMode &&
        <Button
          onClick={handleEditClick}
          className="sm:hidden w-full bg-orange-600 hover:bg-orange-700 mb-4 h-10">
          <Pencil className="w-4 h-4 mr-2" />
          <span>{getEditButtonText()}</span>
        </Button>
      }

      {/* Add to Shopping List Dialog */}
      {showAddToListDialog &&
        <Dialog open={showAddToListDialog} onOpenChange={(open) => {
          if (!importing) {
            setShowAddToListDialog(open);
            if (!open) {
              setCreateNewList(false);
              setNewListName('');
              setImportItems([]);
              setSelectedItemIds([]);
              setImportTargetListId('');
              setIncludeQuantities(false); // Reset Include Qty checkbox on close
            }
          }
        }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto !bg-white dark:!bg-slate-900 dark:!border-slate-700">
            <DialogHeader>
              <DialogTitle className="!text-slate-800 dark:!text-white">
                Add Ingredients to Shopping Lists
              </DialogTitle>
              <DialogDescription className="!text-slate-600 dark:!text-slate-400">
                Select ingredients to add to your shopping list
              </DialogDescription>
            </DialogHeader>

            {!importing ?
              <div className="space-y-4 py-4">
                {/* Instructions */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>How it works:</strong> Review parsed ingredients with quantities. Select items using checkboxes, choose a shopping list (or create new), and click "Add to List".
                    You can add different ingredients to different lists. Edit or remove items as needed.
                  </p>
                </div>

                {/* Include Qty Checkbox */}
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    id="include-qty"
                    checked={includeQuantities}
                    onChange={(e) => setIncludeQuantities(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />

                  <Label htmlFor="include-qty" className="text-sm font-medium !text-slate-700 dark:!text-slate-200 cursor-pointer">
                    Include Quantities in Shopping List
                  </Label>
                </div>

                {/* Ingredients List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Ingredients ({importItems.length} remaining)
                    </h3>
                    {importItems.length > 0 &&
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleToggleSelectAll}
                        className="text-xs font-bold !text-blue-600 dark:!text-blue-400 hover:!bg-blue-50 dark:hover:!bg-blue-900/20">

                        {selectedItemIds.length === importItems.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    }
                  </div>

                  {importItems.length === 0 ?
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-slate-600 dark:text-slate-400 font-medium">All ingredients added!</p>
                      <Button
                        onClick={() => setShowAddToListDialog(false)}
                        className="mt-4 bg-blue-600 hover:bg-blue-700">

                        Done
                      </Button>
                    </div> :

                    <div className="space-y-2 max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                      {importItems.map((item) =>
                        <div key={item.id} className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={() => handleToggleItemSelection(item.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0 mt-2 md:mt-6" />


                          {/* Mobile Layout - Labels on left, stacked */}
                          <div className="flex-1 flex flex-col gap-2 md:hidden">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs !text-slate-600 dark:!text-slate-400 min-w-[36px]">Item</Label>
                              <Input
                                value={item.item}
                                onChange={(e) => handleUpdateImportItem(item.id, 'item', e.target.value)}
                                placeholder="Item name"
                                className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600 text-sm flex-1" />

                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs !text-slate-600 dark:!text-slate-400 min-w-[36px]">Qty</Label>
                              <Input
                                value={item.quantity}
                                onChange={(e) => handleUpdateImportItem(item.id, 'quantity', e.target.value)}
                                placeholder="e.g., 2 cups"
                                disabled={!includeQuantities}
                                className={cn(
                                  "text-sm flex-1",
                                  includeQuantities ?
                                    "!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600" :
                                    "!bg-slate-100 dark:!bg-slate-900 !text-slate-400 dark:!text-slate-500 !border-slate-200 dark:!border-slate-800"
                                )} />

                            </div>
                          </div>

                          {/* Tablet/Desktop Layout - Labels on top, same row */}
                          <div className="flex-1 hidden md:grid md:grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <Label className="text-xs !text-slate-600 dark:!text-slate-400 mb-1 block">Item</Label>
                              <Input
                                value={item.item}
                                onChange={(e) => handleUpdateImportItem(item.id, 'item', e.target.value)}
                                placeholder="Item name"
                                className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600 text-sm" />

                            </div>
                            <div className="col-span-1">
                              <Label className="text-xs !text-slate-600 dark:!text-slate-400 mb-1 block">Qty</Label>
                              <Input
                                value={item.quantity}
                                onChange={(e) => handleUpdateImportItem(item.id, 'quantity', e.target.value)}
                                placeholder="e.g., 2 cups"
                                disabled={!includeQuantities}
                                className={cn(
                                  "text-sm",
                                  includeQuantities ?
                                    "!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600" :
                                    "!bg-slate-100 dark:!bg-slate-900 !text-slate-400 dark:!text-slate-500 !border-slate-200 dark:!border-slate-800"
                                )} />

                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveImportItem(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 flex-shrink-0">

                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  }
                </div>

                {/* List Selection - Only show when items exist and some are selected */}
                {importItems.length > 0 && selectedItemIds.length > 0 &&
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium !text-slate-700 dark:!text-slate-200">
                        Add {selectedItemIds.length} selected item{selectedItemIds.length !== 1 ? 's' : ''} to:
                      </Label>
                    </div>

                    <div className="space-y-4">
                      {/* Existing List Option */}
                      {userLists.length > 0 &&
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="radio"
                              id="existing-list"
                              checked={!createNewList}
                              onChange={() => setCreateNewList(false)}
                              className="w-4 h-4 accent-blue-600" />

                            <Label htmlFor="existing-list" className="text-sm font-medium !text-slate-700 dark:!text-slate-200">
                              Add to existing list
                            </Label>
                          </div>
                          {!createNewList &&
                            <Select value={importTargetListId} onValueChange={setImportTargetListId}>
                              <SelectTrigger className="w-full !bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600">
                                <SelectValue placeholder="Choose a shopping list" />
                              </SelectTrigger>
                              <SelectContent className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700">
                                {userLists.map((list) =>
                                  <SelectItem key={list.id} value={list.id} className="!text-slate-800 dark:!text-slate-100 hover:!bg-slate-100 dark:hover:!bg-slate-700">
                                    {list.name}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          }
                        </div>
                      }

                      {/* New List Option */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="radio"
                            id="new-list"
                            checked={createNewList || userLists.length === 0}
                            onChange={() => setCreateNewList(true)}
                            className="w-4 h-4 accent-blue-600" />

                          <Label htmlFor="new-list" className="text-sm font-medium !text-slate-700 dark:!text-slate-200">
                            Create new list
                          </Label>
                        </div>
                        {(createNewList || userLists.length === 0) &&
                          <Input
                            placeholder={`${recipe.full_title} Shopping`}
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600" />

                        }
                      </div>
                    </div>

                    <Button
                      onClick={handleImportSelectedItems}
                      disabled={selectedItemIds.length === 0 || (!createNewList && !importTargetListId) || (createNewList && !newListName.trim())}
                      className="w-full bg-blue-600 hover:bg-blue-700">

                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to List
                    </Button>
                  </div>
                }

                {/* Close Button */}
                {importItems.length > 0 &&
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddToListDialog(false)}
                      className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600">

                      Close
                    </Button>
                  </div>
                }
              </div> :

              <div className="py-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
                    Adding Ingredients...
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    {importStatus || 'Preparing...'}
                  </p>
                  {importProgress.total > 0 && (
                    <>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (importProgress.current / importProgress.total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        {Math.round((importProgress.current / importProgress.total) * 100)}% complete
                      </p>
                    </>
                  )}
                </div>
              </div>
            }
          </DialogContent>
        </Dialog>
      }

      <Card className={cn(
        "overflow-hidden",
        isColorfulTheme ? "bg-orange-50 border-2 border-orange-300" : "dark:bg-slate-900 dark:border-slate-700"
      )}>
        {isEditMode ?
          <div className="p-4 sm:p-6 bg-gradient-to-r from-orange-500 to-red-500">
        <Input
        value={displayRecipe.full_title}
        onChange={(e) => setEditedRecipe({ ...editedRecipe, full_title: e.target.value })}
        placeholder="Dish name..."
        className="text-lg sm:text-2xl font-bold bg-white/90 text-slate-800 border-none" />

        </div> :

        <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 sm:p-6 text-left hover:from-orange-600 hover:to-red-600 transition-all">

        <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold pr-2 break-words">{displayRecipe.full_title}</h2>
        {isCollapsed ?
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" /> :

          <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
        }
        </div>
        </button>
        }

        <AnimatePresence>
        {(!isCollapsed || isEditMode) &&
        <motion.div
        initial={!isEditMode ? { height: 0, opacity: 0 } : false}
        animate={{ height: "auto", opacity: 1 }}
        exit={!isEditMode ? { height: 0, opacity: 0 } : false}
        transition={{ duration: 0.3 }}>

        {isEditMode ?
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <Label className="text-sm font-semibold mb-3 block text-slate-800 dark:text-slate-100">Recipe Image</Label>

                  <Tabs defaultValue="current" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 !bg-slate-200 dark:!bg-slate-700 border border-slate-300 dark:!border-slate-600">
                      <TabsTrigger
                        value="current"
                        className="!text-slate-800 dark:!text-slate-100 font-medium data-[state=active]:!bg-white dark:data-[state=active]:!bg-slate-600 data-[state=active]:!text-slate-900 dark:data-[state=active]:!text-white data-[state=active]:shadow-sm"
                      >
                        Current
                      </TabsTrigger>
                      <TabsTrigger
                        value="upload"
                        className="!text-slate-800 dark:!text-slate-100 font-medium data-[state=active]:!bg-white dark:data-[state=active]:!bg-slate-600 data-[state=active]:!text-slate-900 dark:data-[state=active]:!text-white data-[state=active]:shadow-sm"
                      >
                        Upload
                      </TabsTrigger>
                      <TabsTrigger
                        value="generate"
                        className="!text-slate-800 dark:!text-slate-100 font-medium data-[state=active]:!bg-white dark:data-[state=active]:!bg-slate-600 data-[state=active]:!text-slate-900 dark:data-[state=active]:!text-white data-[state=active]:shadow-sm"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        AI Generate
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="current" className="mt-4">
                      <img
                        src={selectedImageOption || displayRecipe.photo_url}
                        alt={displayRecipe.full_title}
                        className="w-full h-64 object-cover rounded-lg" />

                    </TabsContent>

                    <TabsContent value="upload" className="mt-4">
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-slate-400 dark:hover:border-slate-400 transition-colors bg-slate-50 dark:bg-slate-700">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadImage}
                          className="hidden" />

                        <Upload className="w-12 h-12 text-slate-400 dark:text-slate-200 mb-3" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-200">Click to upload image</span>
                      </label>
                    </TabsContent>

                    <TabsContent value="generate" className="mt-4 space-y-4">
                      <Button
                        onClick={handleGenerateImage}
                        disabled={generatingImage}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium">

                        {generatingImage ?
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating 2 options...
                          </> :

                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate AI Images
                          </>
                        }
                      </Button>

                      {generatedImageOptions.length > 0 &&
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-200">Select an image:</p>
                          <div className="grid grid-cols-2 gap-3">
                            {generatedImageOptions.map((url, idx) =>
                              <button
                                key={idx}
                                onClick={() => handleSelectImageOption(url)}
                                className={cn(
                                  "relative rounded-lg overflow-hidden border-2 transition-all",
                                  selectedImageOption === url ?
                                    "border-orange-500 ring-2 ring-orange-200 dark:ring-orange-700" :
                                    "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                                )}>

                                <img
                                  src={url}
                                  alt={`Option ${idx + 1}`}
                                  className="w-full h-32 object-cover" />

                                {selectedImageOption === url &&
                                  <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                }
                              </button>
                            )}
                          </div>
                        </div>
                      }
                    </TabsContent>
                  </Tabs>
                </div> :

                <div className="relative group">
                  <img
                    src={displayRecipe.photo_url}
                    alt={displayRecipe.full_title}
                    className="w-full h-48 sm:h-64 md:h-80 object-cover" />

                  {displayRecipe.is_user_generated && displayRecipe.generated_by_user_id === user?.id && (
                    <Badge className="absolute top-3 left-3 bg-purple-500/90 text-white text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />My Recipe
                    </Badge>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 sm:p-4">
                    <Badge className="bg-white/90 !text-slate-800 dark:!bg-slate-800/90 dark:!text-slate-100 font-medium">
                      {displayRecipe.steps?.length || 0} Steps
                    </Badge>
                  </div>
                </div>
              }

              <div className={cn(
                "px-4 py-2 border-b",
                isColorfulTheme
                  ? "bg-gradient-to-r from-orange-100 to-red-100 border-orange-300"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              )}>
                <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
                  {displayRecipe.cooking_time &&
                    <div className="flex items-center gap-2">
                      <span className="text-orange-500 dark:text-orange-400">⏱️</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{displayRecipe.cooking_time}</span>
                    </div>
                  }
                  {displayRecipe.servings &&
                    <div className="flex items-center gap-2">
                      <span className="text-purple-500 dark:text-purple-400">🍽️</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{displayRecipe.servings} Servings</span>
                    </div>
                  }
                  {displayRecipe.calories_per_serving &&
                    <div className="flex items-center gap-2">
                      <span className="text-red-500 dark:text-red-400">🔥</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{displayRecipe.calories_per_serving}</span>
                    </div>
                  }
                  {displayRecipe.cuisine &&
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500 dark:text-blue-400">🌍</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{displayRecipe.cuisine}</span>
                    </div>
                  }
                  {displayRecipe.ingredients &&
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 dark:text-green-400">🥘</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{displayRecipe.ingredients.length} Ingredients</span>
                    </div>
                  }
                </div>
              </div>

              <div className={cn(
                "p-4 sm:p-6 border-b",
                isColorfulTheme
                  ? "bg-orange-50/50 border-orange-200"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <div className={cn(
                      "w-1 h-5 sm:h-6 rounded",
                      isColorfulTheme ? "bg-orange-600" : "bg-orange-500"
                    )}></div>
                    Ingredients
                  </h3>
                  {!isEditMode &&
                    <Button
                      onClick={handleAddToShoppingList}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white flex items-center gap-1.5">

                      <ShoppingCart className="w-4 h-4" />
                      <span className="hidden sm:inline">Add to List</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  }
                  {isEditMode &&
                    <Button
                      onClick={addIngredient}
                      size="sm"
                      variant="outline"
                      className="!bg-white dark:!bg-slate-700 !text-slate-900 dark:!text-white !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600 font-medium"
                    >
                      <Plus className="w-4 h-4 mr-1 !text-slate-900 dark:!text-white" />
                      <span className="!text-slate-900 dark:!text-white">Add</span>
                    </Button>
                  }
                </div>
                <div className="space-y-2">
                  {(displayRecipe.ingredients || []).map((ingredient, idx) => {
                    // Handle both string and object formats for ingredients
                    // Object format: { name, quantity, notes } | String format: "2 cups flour"
                    const ingredientText = typeof ingredient === 'string' 
                      ? ingredient 
                      : (ingredient.quantity ? `${ingredient.quantity} ${ingredient.name}` : ingredient.name) + (ingredient.notes ? ` (${ingredient.notes})` : '');
                    
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        {isEditMode ?
                          <>
                            <Input
                              value={ingredientText}
                              onChange={(e) => updateIngredient(idx, e.target.value)}
                              placeholder="e.g., 2 cups all-purpose flour"
                              className="flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700" />

                            <Button
                              onClick={() => removeIngredient(idx)}
                              size="icon"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 flex-shrink-0 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20">

                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </> :

                          <>
                            <span className="text-orange-500 font-bold mt-1 shrink-0">•</span>
                            <span className="text-sm sm:text-base text-slate-700 dark:text-slate-300 break-words">{ingredientText}</span>
                          </>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={cn(
                "p-4 sm:p-6",
                isColorfulTheme ? "bg-orange-50/50" : "bg-white dark:bg-slate-900"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <div className={cn(
                      "w-1 h-5 sm:h-6 rounded",
                      isColorfulTheme ? "bg-orange-600" : "bg-orange-500"
                    )}></div>
                    Cooking Steps
                  </h3>
                  {isEditMode &&
                    <Button
                      onClick={addStep}
                      size="sm"
                      variant="outline"
                      className="!bg-white dark:!bg-slate-700 !text-slate-900 dark:!text-white !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600 font-medium"
                    >
                      <Plus className="w-4 h-4 mr-1 !text-slate-900 dark:!text-white" />
                      <span className="!text-slate-900 dark:!text-white">Add Step</span>
                    </Button>
                  }
                </div>
                <div className="space-y-3">
                  {(displayRecipe.steps || []).map((step, idx) => {
                    // Normalize step format - handle string, different property names, etc.
                    // Expected: { title: string, instruction: string }
                    // Possible formats: string, { name, description }, { step, details }, { title, text }, etc.
                    const normalizeStep = (s) => {
                      if (typeof s === 'string') {
                        return { title: `Step ${idx + 1}`, instruction: s };
                      }
                      return {
                        title: s.title || s.name || s.step || s.heading || `Step ${idx + 1}`,
                        instruction: s.instruction || s.description || s.details || s.text || s.content || s.instructions || ''
                      };
                    };
                    
                    const normalizedStep = normalizeStep(step);
                    
                    if (isEditMode) {
                      return (
                        <Card key={idx} className={cn(
                          "border-2",
                          isColorfulTheme
                            ? "border-orange-300 bg-orange-50"
                            : "border-orange-200 dark:border-orange-700/50 bg-white dark:bg-slate-800"
                        )}>
                          <CardContent className="p-3 sm:p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-orange-500 text-white text-xs">
                                Step {idx + 1}
                              </Badge>
                              <Input
                                value={normalizedStep.title}
                                onChange={(e) => updateStep(idx, 'title', e.target.value)}
                                placeholder="Step title..."
                                className="flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" />

                              <Button
                                onClick={() => removeStep(idx)}
                                size="icon"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 flex-shrink-0 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20">

                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <Textarea
                              value={normalizedStep.instruction}
                              onChange={(e) => updateStep(idx, 'instruction', e.target.value)}
                              placeholder="Step instructions..."
                              rows={3}
                              className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" />

                          </CardContent>
                        </Card>);

                    }

                    const timer = stepTimers[idx] || { seconds: 0, isRunning: false };
                    const isCompleted = completedSteps[idx] || false;
                    const isExpanded = expandedSteps[idx] || false;

                    return (
                      <Card
                        key={idx}
                        className={cn(
                          "border-2 transition-all",
                          isCompleted ?
                            "bg-slate-50 opacity-60 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700" :
                            (isColorfulTheme
                              ? "bg-orange-50 border-orange-300"
                              : "bg-white border-orange-200 dark:bg-slate-800 dark:border-orange-700/50")
                        )}>

                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <button
                              onClick={() => toggleStepComplete(idx)}
                              className={cn(
                                "mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                isCompleted ?
                                  "bg-green-500 border-green-500" :
                                  "border-slate-300 hover:border-slate-400 dark:border-slate-600"
                              )}>

                              {isCompleted && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />}
                            </button>

                            <button
                              onClick={() => toggleStep(idx)}
                              className="flex-1 text-left min-w-0">

                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs w-fit">
                                  Step {idx + 1}
                                </Badge>
                                <h4 className={cn(
                                  "text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 break-words",
                                  isCompleted && "line-through text-slate-500 dark:text-slate-400"
                                )}>
                                  {normalizedStep.title}
                                </h4>
                              </div>
                            </button>

                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
                              <span className="text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 min-w-[45px] sm:min-w-[60px] text-right">
                                {formatTime(timer.seconds)}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleTimer(idx)}
                                  disabled={isCompleted}
                                  className="h-7 w-7 sm:h-7 sm:w-7">

                                  {timer.isRunning ?
                                    <Pause className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" /> :

                                    <Play className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                                  }
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => resetTimer(idx)}
                                  disabled={isCompleted}
                                  className="h-7 w-7 sm:h-7 sm:w-7">

                                  <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-400" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded &&
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-3 ml-7 sm:ml-8">

                                <p className={cn(
                                  "text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words",
                                  isCompleted && "line-through"
                                )}>
                                  {normalizedStep.instruction}
                                </p>
                              </motion.div>
                            }
                          </AnimatePresence>
                        </CardContent>
                      </Card>);

                  })}
                </div>
              </div>

              {!isEditMode &&
                <div className="px-4 sm:px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-600 dark:text-amber-400 text-xl flex-shrink-0">⚠️</span>
                    <div className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-semibold mb-1">Disclaimer</p>
                      <p className="leading-relaxed">
                        This recipe is AI-generated and provided for informational purposes only. Cooking times, calorie counts, and nutritional information are estimates and may vary based on ingredients, cooking methods, and portion sizes. Please use your judgment and adjust according to your dietary needs and preferences. Always follow safe food handling practices.
                      </p>
                    </div>
                  </div>
                </div>
              }
            </motion.div>
          }
        </AnimatePresence>
      </Card>

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title="Upgrade Required"
        message={upgradeMessage}
        featureName="Custom Recipe Creation" />

      {/* Share Recipe Dialog */}
      <ShareRecipeDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        recipe={recipe}
        onShare={handleShareTracking}
      />

      {/* Signup Prompt for Guest Users */}
      <SignupPrompt
        open={showSignupPrompt}
        onOpenChange={setShowSignupPrompt}
        feature={signupFeature}
        recipeName={recipe?.full_title}
      />

      {/* Delete Recipe Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md !bg-white dark:!bg-slate-900 dark:!border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 !text-slate-800 dark:!text-white">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Recipe
            </DialogTitle>
            <DialogDescription className="!text-slate-600 dark:!text-slate-400">
              Are you sure you want to delete "{recipe?.full_title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100 !border-slate-300 dark:!border-slate-600">
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRecipe}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>);

}