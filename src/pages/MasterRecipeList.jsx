import React, { useState, useEffect } from "react";
import { User, Recipe } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { InvokeLLM, GenerateImage, UploadFile, AI_USE_CASES } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat,
  Plus,
  Search,
  Loader2,
  ArrowLeft,
  Sparkles,
  Trash2,
  Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { consumeCredits, checkCreditsAvailable } from "@/components/utils/creditManager";

export default function MasterRecipeListPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showBulkGenerateDialog, setShowBulkGenerateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false); // New state for import dialog
  const [generating, setGenerating] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [importLoading, setImportLoading] = useState(false); // New state for import loading
  const [newRecipeName, setNewRecipeName] = useState('');
  const [bulkDishNames, setBulkDishNames] = useState('');
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, currentDish: '' });
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadRecipes();

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

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const allRecipes = await Recipe.list('-created_date');
      // Filter to show ONLY admin recipes (not user-generated ones)
      const adminRecipes = allRecipes.filter(recipe => !recipe.is_user_generated);
      setRecipes(adminRecipes);
    } catch (error) {
      console.error("Error loading recipes:", error);
    }
    setLoading(false);
  };

  const handleDeleteRecipe = async (recipe, event) => {
    event.stopPropagation(); // Prevent card click/navigation

    if (!confirm(`Are you sure you want to delete "${recipe.full_title}"?`)) {
      return;
    }

    try {
      await Recipe.delete(recipe.id);

      // Update statistics - atomic decrement total_common_recipes
      await updateStatCount('total_common_recipes', -1);

      loadRecipes();
    } catch (error) {
      console.error("Error deleting recipe:", error);
      alert("Failed to delete recipe. Please try again.");
    }
  };

  const handleGenerateRecipe = async () => {
    if (!newRecipeName.trim()) {
      alert('Please enter a recipe name');
      return;
    }

    // Check credits before generation
    const creditCheck = await checkCreditsAvailable('recipe_generation');
    if (!creditCheck.hasCredits) {
      alert(`Insufficient credits. Need ${creditCheck.creditsNeeded} but only have ${creditCheck.creditsAvailable}. Go to Settings to manage your subscription.`);
      return;
    }

    setGenerating(true);
    try {
      const user = await User.me();

      // Consume credits before expensive operation
      const creditResult = await consumeCredits('recipe_generation', {
        description: `Generated recipe: "${newRecipeName.trim()}"`
      });

      if (!creditResult.success) {
        alert(creditResult.message);
        setGenerating(false);
        return;
      }

      const recipePrompt = `Create a detailed recipe for: ${newRecipeName.trim()}

Return a JSON with these exact fields:
- full_title: Complete dish name
- cooking_time: Duration (e.g., "30-45 minutes")
- cuisine: One of: Italian, Indian / Pakistani, Chinese, Mexican, French, Japanese, Thai, Middle Eastern, American, Spanish, Mediterranean, Greek, Global Classics, Others
- servings: Number of servings (integer)
- calories_per_serving: Calorie range (e.g., "350-400 cal")
- ingredients: Array of strings, each containing quantity and ingredient (e.g., "2 cups flour")
- steps: Array of objects, each with EXACTLY these two properties:
  - "title": string (short step title like "Prepare the Mixture")
  - "instruction": string (detailed step instructions - IMPORTANT: include ingredient quantities in each step, e.g. "Add 2 cups of flour and 1 tsp of salt" instead of just "Add flour and salt")
Do NOT use "description", "step_number", "name", or any other property names for steps.`;

      const recipeData = await InvokeLLM({
        prompt: recipePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            full_title: { type: "string" },
            cooking_time: { type: "string" },
            cuisine: {
              type: "string",
              enum: ["Italian", "Indian / Pakistani", "Chinese", "Mexican", "French", "Japanese", "Thai", "Middle Eastern", "American", "Spanish", "Mediterranean", "Greek", "Global Classics", "Others"]
            },
            servings: { type: "integer" },
            calories_per_serving: { type: "string" },
            ingredients: { type: "array", items: { type: "string" } },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  instruction: { type: "string" }
                }
              }
            }
          }
        },
        useCase: AI_USE_CASES.RECIPE
      });

      // Generate dish image
      const imagePrompt = `Professional food photography of ${recipeData.full_title}, beautifully plated, well-lit, appetizing, restaurant quality`;
      let photoUrl = '';
      try {
        const imageResult = await GenerateImage({ prompt: imagePrompt });
        photoUrl = imageResult.url;
      } catch (error) {
        console.warn('Image generation failed:', error);
      }

      await Recipe.create({
        recipe_name: newRecipeName.trim(),
        full_title: recipeData.full_title,
        photo_url: photoUrl,
        cooking_time: recipeData.cooking_time,
        cuisine: recipeData.cuisine,
        servings: recipeData.servings,
        calories_per_serving: recipeData.calories_per_serving,
        ingredients: recipeData.ingredients,
        steps: recipeData.steps,
        is_user_generated: user.role !== 'admin',
        generated_by_user_id: user.id
      });

      setNewRecipeName('');
      setShowGenerateDialog(false);
      loadRecipes();
      alert(`Recipe generated successfully! ${creditResult.creditsRemaining} credits remaining.`);
    } catch (error) {
      console.error('Error generating recipe:', error);
      alert('Failed to generate recipe. Please try again.');
    }
    setGenerating(false);
  };

  const handleBulkGenerateRecipes = async () => {
    if (!bulkDishNames.trim()) {
      alert('Please enter at least one dish name');
      return;
    }

    const dishNames = bulkDishNames
      .split(/[,\n]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (dishNames.length === 0) {
      alert('Please enter valid dish names');
      return;
    }

    // Check credits
    const creditsNeeded = dishNames.length * 5; // 5 credits per recipe
    const creditCheck = await checkCreditsAvailable('recipe_generation');

    if (!creditCheck.hasCredits || creditCheck.creditsAvailable < creditsNeeded) {
      alert(`Insufficient credits. You need ${creditsNeeded} credits (${dishNames.length} recipes × 5 credits) but only have ${creditCheck.creditsAvailable}. Go to Settings to manage your subscription.`);
      return;
    }

    const confirmGenerate = confirm(`This will generate ${dishNames.length} recipes and consume ${creditsNeeded} credits. Continue?`);
    if (!confirmGenerate) {
      return;
    }

    setBulkGenerating(true);
    setGenerationProgress({ current: 0, total: dishNames.length, currentDish: '' });

    try {
      const user = await User.me();
      let successCount = 0;
      let creditsUsed = 0;

      for (let i = 0; i < dishNames.length; i++) {
        const dishName = dishNames[i];
        setGenerationProgress({ current: i + 1, total: dishNames.length, currentDish: dishName });

        try {
          // Consume credits for this recipe
          const creditResult = await consumeCredits('recipe_generation', {
            description: `Bulk generate recipe: "${dishName}"`
          });

          if (!creditResult.success) {
            alert(`Credit limit reached after ${i} recipes. ${creditResult.message}`);
            break;
          }

          creditsUsed += 5;

          const recipePrompt = `Create a detailed recipe for: ${dishName}

Return a JSON with these exact fields:
- full_title: Complete dish name
- cooking_time: Duration (e.g., "30-45 minutes")
- cuisine: One of: Italian, Indian / Pakistani, Chinese, Mexican, French, Japanese, Thai, Middle Eastern, American, Spanish, Mediterranean, Greek, Global Classics, Others
- servings: Number of servings (integer)
- calories_per_serving: Calorie range (e.g., "350-400 cal")
- ingredients: Array of strings, each containing quantity and ingredient (e.g., "2 cups flour")
- steps: Array of objects, each with EXACTLY these two properties:
  - "title": string (short step title like "Prepare the Mixture")
  - "instruction": string (detailed step instructions - IMPORTANT: include ingredient quantities in each step, e.g. "Add 2 cups of flour and 1 tsp of salt" instead of just "Add flour and salt")
Do NOT use "description", "step_number", "name", or any other property names for steps.`;

          const recipeData = await InvokeLLM({
            prompt: recipePrompt,
            response_json_schema: {
              type: "object",
              properties: {
                full_title: { type: "string" },
                cooking_time: { type: "string" },
                cuisine: {
                  type: "string",
                  enum: ["Italian", "Indian / Pakistani", "Chinese", "Mexican", "French", "Japanese", "Thai", "Middle Eastern", "American", "Spanish", "Mediterranean", "Greek", "Global Classics", "Others"]
                },
                servings: { type: "integer" },
                calories_per_serving: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      instruction: { type: "string" }
                    }
                  }
                }
              }
            },
            useCase: AI_USE_CASES.RECIPE
          });

          const imagePrompt = `Professional food photography of ${recipeData.full_title}, beautifully plated, well-lit, appetizing, restaurant quality`;
          let photoUrl = '';
          try {
            const imageResult = await GenerateImage({ prompt: imagePrompt });
            photoUrl = imageResult.url;
          } catch (error) {
            console.warn(`Image generation failed for ${dishName}:`, error);
          }

          await Recipe.create({
            recipe_name: dishName,
            full_title: recipeData.full_title,
            photo_url: photoUrl,
            cooking_time: recipeData.cooking_time,
            cuisine: recipeData.cuisine,
            servings: recipeData.servings,
            calories_per_serving: recipeData.calories_per_serving,
            ingredients: recipeData.ingredients,
            steps: recipeData.steps,
            is_user_generated: user.role !== 'admin',
            generated_by_user_id: user.id
          });

          successCount++;
        } catch (error) {
          console.error(`Error generating recipe for ${dishName}:`, error);
        }
      }

      setBulkDishNames('');
      setShowBulkGenerateDialog(false);
      setGenerationProgress({ current: 0, total: 0, currentDish: '' });
      loadRecipes();
      alert(`Successfully generated ${successCount} recipes using ${creditsUsed} credits!`);
    } catch (error) {
      console.error('Error in bulk generation:', error);
      alert('Failed to complete bulk generation. Please try again.');
    }
    setBulkGenerating(false);
  };

  const handleExportRecipes = () => {
    if (recipes.length === 0) {
      alert("No recipes to export");
      return;
    }

    try {
      // Create JSON string with proper formatting
      const jsonData = JSON.stringify(recipes, null, 2);
      
      // Create blob and download
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recipes-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully exported ${recipes.length} recipes to JSON`);
    } catch (error) {
      console.error("Error exporting recipes:", error);
      alert("Failed to export recipes. Please try again.");
    }
  };

  const handleImportRecipes = async (recipesData) => {
    try {
      setImportLoading(true);

      let successCount = 0;
      let errorCount = 0;

      for (const recipe of recipesData) {
        try {
          await Recipe.create(recipe);
          successCount++;

          // Update statistics - atomic increment total_common_recipes
          await updateStatCount('total_common_recipes', 1);
        } catch (err) {
          console.error("Error importing recipe:", err);
          errorCount++;
        }
      }

      alert(`Import complete!\n✅ ${successCount} recipes added\n${errorCount > 0 ? `❌ ${errorCount} recipes failed` : ''}`);
      loadRecipes();
      setShowImportDialog(false);
    } catch (error) {
      console.error("Error importing recipes:", error);
      alert("Failed to import recipes. Please try again.");
    } finally {
      setImportLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.full_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.recipe_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Admin"))}
            className="dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <ChefHat className="w-8 h-8 text-orange-600 flex-shrink-0" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 break-words">
            Master Recipe List
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} available
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={handleExportRecipes}
            variant="outline"
            className="w-full sm:w-auto"
            disabled={recipes.length === 0}
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              color: isDarkMode ? 'rgb(226 232 240)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button
            onClick={() => setShowBulkGenerateDialog(true)}
            variant="outline"
            className="w-full sm:w-auto"
            style={{
              backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
              color: isDarkMode ? 'rgb(226 232 240)' : '',
              borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
            }}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Dish Recipes
          </Button>
          <Button
            onClick={() => setShowGenerateDialog(true)}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Recipe
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </div>

      {/* Recipe List */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading recipes...</p>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="text-center py-16">
          <ChefHat className="w-16 h-16 sm:w-20 sm:h-20 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
            {searchQuery ? 'No recipes found' : 'No recipes yet'}
          </h3>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 px-4">
            {searchQuery
              ? 'Try a different search term'
              : 'Generate your first recipe or bulk generate multiple recipes'}
          </p>
          {!searchQuery && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
              <Button
                onClick={() => setShowGenerateDialog(true)}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Generate Recipe
              </Button>
              <Button onClick={() => setShowBulkGenerateDialog(true)} variant="outline">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Dish Recipes
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              onClick={() => navigate(createPageUrl(`RecipeDetail?id=${recipe.id}`))}
              className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-400 group overflow-hidden bg-white dark:bg-slate-900 dark:border-slate-700 relative"
            >
              {recipe.photo_url && (
                <div className="relative h-40 sm:h-48 overflow-hidden">
                  <img
                    src={recipe.photo_url}
                    alt={recipe.full_title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <Badge
                    className="absolute bottom-3 left-3 text-xs"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)'
                    }}
                  >
                    {recipe.steps?.length || 0} Steps
                  </Badge>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteRecipe(recipe, e)}
                    className="absolute top-2 right-2 h-8 w-8 bg-red-500/90 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </Button>
                </div>
              )}

              {/* Info Bar */}
              {(recipe.cooking_time || recipe.cuisine) && (
                <div
                  className="px-3 py-2 border-b"
                  style={{
                    background: isDarkMode
                      ? 'linear-gradient(to right, rgba(234, 88, 12, 0.2), rgba(220, 38, 38, 0.2))'
                      : 'linear-gradient(to right, rgb(255 247 237), rgb(254 242 242))',
                    borderColor: isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)'
                  }}
                >
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    {recipe.cooking_time && (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.4)' : 'rgb(254 243 199)'
                          }}
                        >
                          <span className="text-sm">⏱️</span>
                        </div>
                        <span
                          className="text-xs font-medium"
                          style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(51 65 85)' }}
                        >
                          {recipe.cooking_time}
                        </span>
                      </div>
                    )}
                    {recipe.cuisine && (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.4)' : 'rgb(219 234 254)'
                          }}
                        >
                          <span className="text-sm">🌍</span>
                        </div>
                        <span
                          className="text-xs font-medium"
                          style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(51 65 85)' }}
                        >
                          {recipe.cuisine}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <CardContent className="p-3 sm:p-4 bg-white dark:bg-slate-900">
                <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-slate-100 mb-1 line-clamp-2 break-words">
                  {recipe.full_title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  {recipe.ingredients?.length || 0} Ingredients
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Single Recipe Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate New Recipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dish Name</Label>
              <Input
                placeholder="e.g., Chocolate Cake, Chicken Curry..."
                value={newRecipeName}
                onChange={(e) => setNewRecipeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !generating && handleGenerateRecipe()}
                disabled={generating}
              />
            </div>
            {generating && (
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Generating recipe with AI... (10-15 seconds)
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)} disabled={generating}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateRecipe}
              disabled={!newRecipeName.trim() || generating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Recipes Dialog */}
      <Dialog open={showBulkGenerateDialog} onOpenChange={setShowBulkGenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Multiple Recipes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dish Names</Label>
              <Textarea
                placeholder="Enter dish names (comma-separated or one per line)&#10;&#10;Example:&#10;Chocolate Cake&#10;Chicken Tikka Masala&#10;Caesar Salad&#10;&#10;or&#10;&#10;Chocolate Cake, Chicken Tikka Masala, Caesar Salad"
                value={bulkDishNames}
                onChange={(e) => setBulkDishNames(e.target.value)}
                disabled={bulkGenerating}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Separate dish names with commas or put each on a new line
              </p>
            </div>
            {bulkGenerating && (
              <div className="text-center py-4 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Generating {generationProgress.current} of {generationProgress.total}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Currently generating: {generationProgress.currentDish}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  This may take 10-15 seconds per recipe...
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowBulkGenerateDialog(false)}
              disabled={bulkGenerating}
              style={{
                backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                color: isDarkMode ? 'rgb(226 232 240)' : '',
                borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkGenerateRecipes}
              disabled={!bulkDishNames.trim() || bulkGenerating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {bulkGenerating ? 'Generating...' : 'Generate All'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}