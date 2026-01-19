import React, { useState, useEffect } from "react";
import { User, Recipe, RecipeFavorite } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { trackRecipe, trackRecipeFavorite, PAGES } from "@/utils/trackingContext";
import { getFamilyMemberIds, getFamilyInfo } from "@/services/familyService";
import { InvokeLLM, GenerateImage, UploadFile, AI_USE_CASES } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChefHat, Search, Star, Clock, Users as UsersIcon, ArrowLeft, Sparkles, Plus, Trash2, Upload, Check, PenSquare, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { appCache } from "@/components/utils/appCache";
import { incrementUsage } from "@/components/utils/usageSync";
import { useRecipeLoadingPhrases } from "@/hooks/useRecipeLoadingPhrases";

const allCuisines = [
  "Italian", "Indian / Pakistani", "Chinese", "Mexican", "French", "Japanese",
  "Thai", "Middle Eastern", "American", "Spanish", "Mediterranean", "Greek",
  "Global Classics", "Others"
];

export default function MyRecipesPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("browse");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Create states
  const [searchTerm, setSearchTerm] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('recipe'); // 'recipe', 'image', 'saving'
  const [error, setError] = useState(null);
  
  // Rotating loading phrases
  const loadingPhrase = useRecipeLoadingPhrases(generating, generationStage);
  const [createMethod, setCreateMethod] = useState("ai");
  const [manualRecipe, setManualRecipe] = useState({
    full_title: '', cooking_time: '', cuisine: 'Italian', servings: 4,
    calories_per_serving: '', photo_url: '', ingredients: [''], steps: [{ title: '', instruction: '' }]
  });
  const [creatingManual, setCreatingManual] = useState(false);
  const [generatingManualImage, setGeneratingManualImage] = useState(false);
  const [manualImageOptions, setManualImageOptions] = useState([]);
  const [selectedManualImage, setSelectedManualImage] = useState(null);
  
  // Family sharing
  const [familyMemberMap, setFamilyMemberMap] = useState({}); // userId -> name/email
  const [showFamilyRecipes, setShowFamilyRecipes] = useState(true);

  useEffect(() => {
    checkAuth();
    
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

  const checkAuth = async () => {
    try {
      // Check cache first for user
      let currentUser = appCache.getUser();
      if (!currentUser) {
        console.log('🔄 MyRecipes: Fetching user from API (cache miss)');
        currentUser = await User.me();
        appCache.setUser(currentUser);
      } else {
        console.log('📦 MyRecipes: Using cached user data');
      }
      
      setUser(currentUser);
      setIsAuthChecking(false);
      loadData(currentUser);
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("MyRecipes"));
    }
  };

  const loadData = async (currentUser) => {
    setLoading(true);
    try {
      // Check cache first for recipes
      let allRecipes = appCache.getRecipes();
      
      if (!allRecipes) {
        console.log('🔄 MyRecipes: Fetching recipes from API (cache miss)');
        allRecipes = await Recipe.list('-created_date');
        appCache.setRecipes(allRecipes);
      } else {
        console.log('📦 MyRecipes: Using cached recipes data');
      }
      
      // Get family member IDs to show their recipes too
      let familyUserIds = [currentUser.id];
      let memberNameMap = {};
      
      try {
        const familyInfo = await getFamilyInfo();
        if (familyInfo.success && familyInfo.has_family && familyInfo.members) {
          // Get all approved family members
          const approvedMembers = familyInfo.members.filter(m => m.status === 'approved');
          familyUserIds = approvedMembers.map(m => m.user_id);
          
          // Create a map of userId -> display name for badges
          approvedMembers.forEach(m => {
            if (m.user_id !== currentUser.id) {
              memberNameMap[m.user_id] = m.full_name || m.email?.split('@')[0] || 'Family';
            }
          });
          console.log('👨‍👩‍👧‍👦 MyRecipes: Including recipes from', familyUserIds.length, 'family members');
        }
      } catch (familyError) {
        console.warn('👨‍👩‍👧‍👦 MyRecipes: Could not get family info, showing only own recipes');
      }
      
      setFamilyMemberMap(memberNameMap);
      
      // Filter to user-generated recipes from current user OR family members
      const myRecipes = allRecipes.filter(r => 
        r.is_user_generated && familyUserIds.includes(r.generated_by_user_id)
      );
      setRecipes(myRecipes);

      // Check cache first for recipe favorites
      let userFavorites = appCache.getRecipeFavorites(currentUser.id);
      
      if (!userFavorites) {
        console.log('🔄 MyRecipes: Fetching recipe favorites from API (cache miss)');
        userFavorites = await RecipeFavorite.filter({ user_id: currentUser.id });
        appCache.setRecipeFavorites(currentUser.id, userFavorites);
      } else {
        console.log('📦 MyRecipes: Using cached recipe favorites');
      }
      
      setFavorites(userFavorites.map(f => f.recipe_id));
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const toggleFavorite = async (recipeId, e) => {
    e.stopPropagation();
    try {
      const recipe = recipes.find(r => r.id === recipeId);
      const recipeTitle = recipe?.full_title || 'Unknown Recipe';
      
      if (favorites.includes(recipeId)) {
        const favRecords = await RecipeFavorite.filter({ recipe_id: recipeId, user_id: user.id });
        if (favRecords.length > 0) {
          await RecipeFavorite.delete(
            favRecords[0].id, 
            trackRecipeFavorite.remove(user.id, recipeTitle, PAGES.MY_RECIPES)
          );
        }
        setFavorites(prev => prev.filter(id => id !== recipeId));
      } else {
        await RecipeFavorite.create(
          { recipe_id: recipeId, user_id: user.id },
          trackRecipeFavorite.add(user.id, recipeTitle, PAGES.MY_RECIPES)
        );
        setFavorites(prev => [...prev, recipeId]);
      }
      
      // Clear recipe favorites cache since it changed
      console.log('🗑️ MyRecipes: Clearing recipe favorites cache (favorite toggled)');
      appCache.clearRecipeFavorites(user.id);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const handleRecipeClick = (recipeId) => {
    navigate(createPageUrl(`RecipeDetail?id=${recipeId}&from=myrecipes`));
  };

  const handleGenerateRecipe = async () => {
    setError(null);
    if (!searchTerm.trim()) { alert('Please enter a dish name'); return; }
    setGenerating(true); setGenerationStage('recipe');
    try {
      const recipePrompt = `Generate a detailed recipe for: "${searchTerm}". Return JSON with these exact fields:
- full_title: string (the complete dish name)
- cooking_time: string (e.g. "30-45 minutes")
- cuisine: string (one of: ${allCuisines.join(', ')})
- servings: integer
- calories_per_serving: string (e.g. "350-400 cal")
- ingredients: array of strings, each string containing quantity and ingredient (e.g. "2 cups all-purpose flour", "1 tsp vanilla extract")
- steps: array of objects, each with EXACTLY these two properties:
  - "title": string (short step title like "Prepare the Mixture")
  - "instruction": string (detailed step instructions - IMPORTANT: include ingredient quantities in each step, e.g. "Add 2 cups of flour and 1 tsp of salt" instead of just "Add flour and salt")
Do NOT use "description", "step_number", "name", or any other property names for steps.`;
      const response = await InvokeLLM({
        prompt: recipePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            full_title: { type: "string" }, cooking_time: { type: "string" },
            cuisine: { type: "string", enum: allCuisines }, servings: { type: "integer" },
            calories_per_serving: { type: "string" },
            ingredients: { type: "array", items: { type: "string" } },
            steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, instruction: { type: "string" } } } }
          }
        },
        useCase: AI_USE_CASES.RECIPE
      });
      setGenerationStage('image');
      const imageResult = await GenerateImage({ prompt: `A professional, appetizing food photography of ${response.full_title}, beautifully plated, well-lit, restaurant quality, high resolution` });
      setGenerationStage('saving');
      const savedRecipe = await Recipe.create(
        {
          recipe_name: searchTerm.trim(), ...response, photo_url: imageResult.url,
          is_user_generated: true, generated_by_user_id: user.id
        },
        trackRecipe.create(user.id, response.full_title)
      );

      // Increment custom recipes count
      await incrementUsage('current_custom_recipes');

      // Update statistics - atomic increment total_user_generated_recipes
      await updateStatCount('total_user_generated_recipes', 1);

      // Clear recipes cache since we created a new one
      console.log('🗑️ MyRecipes: Clearing recipes cache (recipe created)');
      appCache.clearRecipes();
      
      navigate(createPageUrl(`RecipeDetail?id=${savedRecipe.id}&from=myrecipes`));
    } catch (err) {
      console.error("Error generating recipe:", err);
      setError("Failed to generate recipe. Please try again.");
    } finally {
      setGenerating(false); setGenerationStage('recipe');
    }
  };

  const handleManualImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await UploadFile({ file });
      setManualRecipe({ ...manualRecipe, photo_url: result.file_url });
      setSelectedManualImage(null); setManualImageOptions([]);
    } catch (error) {
      alert("Failed to upload image.");
    }
  };

  const handleGenerateManualImage = async () => {
    if (!manualRecipe.full_title?.trim()) { alert("Please enter a dish name first"); return; }
    setGeneratingManualImage(true); setManualImageOptions([]); setSelectedManualImage(null);
    try {
      const prompt = `A professional, appetizing food photography of ${manualRecipe.full_title}, beautifully plated, well-lit, restaurant quality, high resolution`;
      const results = await Promise.all([
        GenerateImage({ prompt }),
        GenerateImage({ prompt })
      ]);
      setManualImageOptions([results[0].url, results[1].url]);
    } catch (error) {
      alert("Failed to generate images.");
    }
    setGeneratingManualImage(false);
  };

  const handleCreateManualRecipe = async () => {
    if (!manualRecipe.full_title?.trim()) { alert("Please enter a dish name"); return; }
    const validIngredients = manualRecipe.ingredients.filter(i => i.trim());
    if (validIngredients.length === 0) { alert("Please add at least one ingredient"); return; }
    const validSteps = manualRecipe.steps.filter(s => s.title.trim() && s.instruction.trim());
    if (validSteps.length === 0) { alert("Please add at least one cooking step"); return; }
    setCreatingManual(true);
    try {
      const savedRecipe = await Recipe.create(
        {
          recipe_name: manualRecipe.full_title, full_title: manualRecipe.full_title,
          cooking_time: manualRecipe.cooking_time || "Variable", cuisine: manualRecipe.cuisine,
          servings: manualRecipe.servings || 4, calories_per_serving: manualRecipe.calories_per_serving || null,
          photo_url: selectedManualImage || manualRecipe.photo_url || null,
          ingredients: validIngredients, steps: validSteps,
          is_user_generated: true, generated_by_user_id: user.id
        },
        trackRecipe.create(user.id, manualRecipe.full_title)
      );

      // Increment custom recipes count
      await incrementUsage('current_custom_recipes');

      // Update statistics - atomic increment total_user_generated_recipes
      await updateStatCount('total_user_generated_recipes', 1);

      // Clear recipes cache since we created a new one
      console.log('🗑️ MyRecipes: Clearing recipes cache (recipe created)');
      appCache.clearRecipes();
      
      navigate(createPageUrl(`RecipeDetail?id=${savedRecipe.id}&from=myrecipes`));
    } catch (error) {
      alert("Failed to create recipe.");
    }
    setCreatingManual(false);
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesCuisine = selectedCuisine === "All" || recipe.cuisine === selectedCuisine;
    const matchesSearch = !searchQuery.trim() || 
      recipe.full_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.recipe_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCuisine && matchesSearch;
  });

  const availableCuisines = ["All", ...new Set(recipes.map(r => r.cuisine).filter(Boolean))];

  if (isAuthChecking || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          {isAuthChecking ? "Checking authentication..." : "Loading your recipes..."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Recipe"))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">My Recipes</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Recipes you've created</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6" style={{ backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '' }}>
          <TabsTrigger 
            value="browse"
            style={{ 
              backgroundColor: activeTab === 'browse' ? (isDarkMode ? 'rgb(51 65 85)' : '') : '',
              color: isDarkMode ? (activeTab === 'browse' ? 'rgb(248 250 252)' : 'rgb(203 213 225)') : ''
            }}
          >
            Browse My Recipes
          </TabsTrigger>
          <TabsTrigger 
            value="create"
            style={{ 
              backgroundColor: activeTab === 'create' ? (isDarkMode ? 'rgb(51 65 85)' : '') : '',
              color: isDarkMode ? (activeTab === 'create' ? 'rgb(248 250 252)' : 'rgb(203 213 225)') : ''
            }}
          >
            Create New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input placeholder="Search my recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12" />
          </div>

          {availableCuisines.length > 1 && (
            <div className="w-screen -ml-4 sm:w-full sm:ml-0">
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 px-4 sm:px-0 pb-2">
                  {availableCuisines.map(cuisine => (
                    <Badge 
                      key={cuisine} 
                      variant={selectedCuisine === cuisine ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer whitespace-nowrap flex-shrink-0",
                        selectedCuisine === cuisine ? "bg-orange-600 text-white hover:bg-orange-700" : "hover:bg-slate-50 dark:hover:bg-slate-700"
                      )}
                      style={selectedCuisine !== cuisine ? {
                        backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                        color: isDarkMode ? 'rgb(226 232 240)' : '',
                        borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                      } : {}}
                      onClick={() => setSelectedCuisine(cuisine)}
                    >
                      {cuisine} ({cuisine === "All" ? recipes.length : recipes.filter(r => r.cuisine === cuisine).length})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading your recipes...</p>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-20 h-20 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No recipes yet</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Start creating your own delicious recipes!</p>
              <Button onClick={() => setActiveTab("create")} className="bg-orange-600 hover:bg-orange-700">
                Create First Recipe
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRecipes.map((recipe) => (
                <Card 
                  key={recipe.id} 
                  onClick={() => handleRecipeClick(recipe.id)}
                  className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-400 group overflow-hidden"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                    borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                  }}
                >
                  {recipe.photo_url && (
                    <div className="relative h-48 overflow-hidden">
                      <img src={recipe.photo_url} alt={recipe.full_title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <button onClick={(e) => toggleFavorite(recipe.id, e)}
                        className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-all hover:scale-110">
                        <Star className={cn("w-5 h-5", favorites.includes(recipe.id) ? "fill-yellow-500 text-yellow-500" : "text-slate-400")} />
                      </button>
                      {recipe.generated_by_user_id === user.id ? (
                        <Badge className="absolute top-3 left-3 bg-purple-500/90 text-white text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />My Recipe
                        </Badge>
                      ) : familyMemberMap[recipe.generated_by_user_id] ? (
                        <Badge className="absolute top-3 left-3 bg-pink-500/90 text-white text-xs">
                          <Heart className="w-3 h-3 mr-1" />From {familyMemberMap[recipe.generated_by_user_id]}
                        </Badge>
                      ) : (
                        <Badge className="absolute top-3 left-3 bg-purple-500/90 text-white text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />My Recipe
                        </Badge>
                      )}
                    </div>
                  )}
                  <div 
                    className="px-3 py-2 border-b"
                    style={{
                      background: isDarkMode 
                        ? 'linear-gradient(to right, rgba(234, 88, 12, 0.2), rgba(220, 38, 38, 0.2))'
                        : 'linear-gradient(to right, rgb(255 247 237), rgb(254 242 242))',
                      borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                    }}
                  >
                    <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
                      {recipe.cooking_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(234 88 12)' }} />
                          <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : '' }}>{recipe.cooking_time}</span>
                        </div>
                      )}
                      {recipe.servings && (
                        <div className="flex items-center gap-1">
                          <UsersIcon className="w-3 h-3" style={{ color: isDarkMode ? 'rgb(192 132 252)' : 'rgb(147 51 234)' }} />
                          <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : '' }}>{recipe.servings} servings</span>
                        </div>
                      )}
                      {recipe.cuisine && (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{
                            backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                            color: isDarkMode ? 'rgb(226 232 240)' : '',
                            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                          }}
                        >
                          {recipe.cuisine}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent 
                    className="p-4"
                    style={{ backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '' }}
                  >
                    <h3 
                      className="font-bold text-base mb-2 line-clamp-2"
                      style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}
                    >
                      {recipe.full_title}
                    </h3>
                    <p 
                      className="text-sm"
                      style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(71 85 105)' }}
                    >
                      {recipe.ingredients?.length || 0} Ingredients
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Create tab - same structure */}
        <TabsContent value="create" className="space-y-6">
          <div className="flex gap-3 justify-center mb-6">
            <Button 
              variant={createMethod === "ai" ? "default" : "outline"} 
              onClick={() => setCreateMethod("ai")}
              className={cn("flex-1 max-w-xs h-12", createMethod === "ai" && "bg-orange-600 hover:bg-orange-700")}
              style={createMethod !== "ai" && isDarkMode ? {
                backgroundColor: 'rgb(30 41 59)',
                color: 'rgb(226 232 240)',
                borderColor: 'rgb(71 85 105)'
              } : {}}
            >
              <Sparkles className="w-4 h-4 mr-2" />AI Generate
            </Button>
            <Button 
              variant={createMethod === "manual" ? "default" : "outline"} 
              onClick={() => setCreateMethod("manual")}
              className={cn("flex-1 max-w-xs h-12", createMethod === "manual" && "bg-orange-600 hover:bg-orange-700")}
              style={createMethod !== "manual" && isDarkMode ? {
                backgroundColor: 'rgb(30 41 59)',
                color: 'rgb(226 232 240)',
                borderColor: 'rgb(71 85 105)'
              } : {}}
            >
              <PenSquare className="w-4 h-4 mr-2" />Manual Create
            </Button>
          </div>

          {createMethod === "ai" ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3">
                  <Input placeholder="e.g., Chocolate Chip Cookies..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={generating} className="text-lg h-12" />
                  <Button onClick={handleGenerateRecipe} disabled={generating || !searchTerm.trim()} className="h-12 bg-orange-600 hover:bg-orange-700">
                    {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creating Magic...</> : <><Sparkles className="w-5 h-5 mr-2" />Generate</>}
                  </Button>
                </div>
                {generating && (
                  <div className="mt-4 text-center animate-pulse">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{loadingPhrase}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div><Label>Dish Name *</Label><Input placeholder="e.g., Grandma's Apple Pie" value={manualRecipe.full_title} onChange={(e) => setManualRecipe({ ...manualRecipe, full_title: e.target.value })} className="h-12" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Cooking Time</Label><Input placeholder="30-45 minutes" value={manualRecipe.cooking_time} onChange={(e) => setManualRecipe({ ...manualRecipe, cooking_time: e.target.value })} /></div>
                  <div><Label>Cuisine</Label><select value={manualRecipe.cuisine} onChange={(e) => setManualRecipe({ ...manualRecipe, cuisine: e.target.value })} className="w-full h-10 px-3 rounded-md border">{allCuisines.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><Label>Servings</Label><Input type="number" min="1" value={manualRecipe.servings} onChange={(e) => setManualRecipe({ ...manualRecipe, servings: parseInt(e.target.value) || 4 })} /></div>
                  <div><Label>Calories/Serving</Label><Input placeholder="350-400 cal" value={manualRecipe.calories_per_serving} onChange={(e) => setManualRecipe({ ...manualRecipe, calories_per_serving: e.target.value })} /></div>
                </div>
                <div><Label>Image (Optional)</Label>
                  <Tabs defaultValue="upload">
                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upload">Upload</TabsTrigger><TabsTrigger value="generate"><Sparkles className="w-4 h-4 mr-1" />AI</TabsTrigger></TabsList>
                    <TabsContent value="upload" className="mt-4"><label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:border-slate-400 bg-slate-50"><input type="file" accept="image/*" onChange={handleManualImageUpload} className="hidden" />{(selectedManualImage || manualRecipe.photo_url) ? <img src={selectedManualImage || manualRecipe.photo_url} alt="Recipe" className="w-full h-full object-cover rounded-lg" /> : <><Upload className="w-12 h-12 text-slate-400 mb-3" /><span className="text-sm text-slate-600">Click to upload</span></>}</label></TabsContent>
                    <TabsContent value="generate" className="mt-4 space-y-4"><Button onClick={handleGenerateManualImage} disabled={generatingManualImage || !manualRecipe.full_title.trim()} className="w-full bg-orange-600">{generatingManualImage ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating 2 options...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate AI Images</>}</Button>{manualImageOptions.length > 0 && <div className="space-y-2"><p className="text-sm">Select an image:</p><div className="grid grid-cols-2 gap-3">{manualImageOptions.map((url, idx) => <button key={idx} onClick={() => setSelectedManualImage(url)} className={cn("relative rounded-lg overflow-hidden border-2", selectedManualImage === url ? "border-orange-500 ring-2" : "border-slate-200")}><img src={url} alt={`Option ${idx + 1}`} className="w-full h-32 object-cover" />{selectedManualImage === url && <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}</button>)}</div></div>}</TabsContent>
                  </Tabs>
                </div>
                <div className="space-y-3"><div className="flex justify-between"><Label>Ingredients *</Label><Button onClick={() => setManualRecipe({ ...manualRecipe, ingredients: [...manualRecipe.ingredients, ''] })} size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Add</Button></div><div className="space-y-2">{manualRecipe.ingredients.map((ing, idx) => <div key={idx} className="flex gap-2"><Input placeholder="e.g., 2 cups flour" value={ing} onChange={(e) => { const n = [...manualRecipe.ingredients]; n[idx] = e.target.value; setManualRecipe({ ...manualRecipe, ingredients: n }); }} className="flex-1" />{manualRecipe.ingredients.length > 1 && <Button onClick={() => setManualRecipe({ ...manualRecipe, ingredients: manualRecipe.ingredients.filter((_, i) => i !== idx) })} size="icon" variant="ghost" className="text-red-500"><Trash2 className="w-4 h-4" /></Button>}</div>)}</div></div>
                <div className="space-y-3"><div className="flex justify-between"><Label>Steps *</Label><Button onClick={() => setManualRecipe({ ...manualRecipe, steps: [...manualRecipe.steps, { title: '', instruction: '' }] })} size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Add</Button></div><div className="space-y-3">{manualRecipe.steps.map((step, idx) => <Card key={idx} className="border-2 border-orange-200"><CardContent className="p-3 space-y-2"><div className="flex gap-2"><Badge className="bg-orange-500">Step {idx + 1}</Badge><Input placeholder="Title..." value={step.title} onChange={(e) => { const n = [...manualRecipe.steps]; n[idx].title = e.target.value; setManualRecipe({ ...manualRecipe, steps: n }); }} className="flex-1" />{manualRecipe.steps.length > 1 && <Button onClick={() => setManualRecipe({ ...manualRecipe, steps: manualRecipe.steps.filter((_, i) => i !== idx) })} size="icon" variant="ghost" className="text-red-500"><Trash2 className="w-4 h-4" /></Button>}</div><Textarea placeholder="Instructions..." value={step.instruction} onChange={(e) => { const n = [...manualRecipe.steps]; n[idx].instruction = e.target.value; setManualRecipe({ ...manualRecipe, steps: n }); }} rows={2} /></CardContent></Card>)}</div></div>
                <Button onClick={handleCreateManualRecipe} disabled={creatingManual || !manualRecipe.full_title.trim()} className="w-full h-12 bg-green-600 hover:bg-green-700">{creatingManual ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creating...</> : <><PenSquare className="w-5 h-5 mr-2" />Create My Recipe</>}</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}