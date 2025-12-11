
import React, { useState, useEffect } from "react";
import { User, Recipe as RecipeEntity, RecipeFavorite } from "@/api/entities";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat, TrendingUp, Heart, User as UserIcon, Sparkles, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { appCache } from "@/components/utils/appCache";

export default function RecipePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [recipeStats, setRecipeStats] = useState({
    totalPopular: 0,
    totalFavorites: 0,
    totalMyRecipes: 0
  });
  const [user, setUser] = useState(null);
  const [carouselRecipes, setCarouselRecipes] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isColorfulTheme, setIsColorfulTheme] = useState(false);

  useEffect(() => {
    checkAuth();
    
    // Check initial theme
    setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    setIsColorfulTheme(document.documentElement.classList.contains('theme-colorful'));
    
    // Watch for theme changes
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
      setIsColorfulTheme(document.documentElement.classList.contains('theme-colorful'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Auto-rotate carousel
  useEffect(() => {
    if (carouselRecipes.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselRecipes.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [carouselRecipes]);

  const checkAuth = async () => {
    try {
      // Check cache first for user
      let currentUser = appCache.getUser();
      if (!currentUser) {
        console.log('🔄 Recipe: Fetching user from API (cache miss)');
        currentUser = await User.me();
        appCache.setUser(currentUser);
      } else {
        console.log('📦 Recipe: Using cached user data');
      }
      
      setUser(currentUser);
      setIsAuthChecking(false);
      loadRecipeStats(currentUser);
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("Recipe"));
    }
  };

  const loadRecipeStats = async (currentUser) => {
    setLoading(true);
    try {
      // Check cache first for recipes
      let allRecipes = appCache.getRecipes();
      
      if (!allRecipes) {
        console.log('🔄 Recipe: Fetching recipes from API (cache miss)');
        allRecipes = await RecipeEntity.list();
        appCache.setRecipes(allRecipes);
      } else {
        console.log('📦 Recipe: Using cached recipes data');
      }
      
      // Calculate stats
      const popularRecipes = allRecipes.filter(r => !r.is_user_generated);
      const myRecipes = allRecipes.filter(r => r.is_user_generated && r.generated_by_user_id === currentUser.id);
      
      // Check cache first for recipe favorites
      let userFavorites = appCache.getRecipeFavorites(currentUser.id);
      
      if (!userFavorites) {
        console.log('🔄 Recipe: Fetching recipe favorites from API (cache miss)');
        userFavorites = await RecipeFavorite.filter({ user_id: currentUser.id });
        appCache.setRecipeFavorites(currentUser.id, userFavorites);
      } else {
        console.log('📦 Recipe: Using cached recipe favorites');
      }
      
      setRecipeStats({
        totalPopular: popularRecipes.length,
        totalFavorites: userFavorites.length,
        totalMyRecipes: myRecipes.length
      });
      
      // Select random recipes for carousel (only those with photos)
      const recipesWithPhotos = allRecipes.filter(r => r.photo_url);
      const shuffled = [...recipesWithPhotos].sort(() => Math.random() - 0.5);
      setCarouselRecipes(shuffled.slice(0, 5));
    } catch (error) {
      console.error("Error loading recipe stats:", error);
    }
    setLoading(false);
  };

  const sections = [
    {
      title: "Popular Recipes",
      description: "Browse our collection of delicious recipes",
      icon: TrendingUp,
      gradient: "from-orange-500 to-red-600",
      colorfulBg: "bg-orange-100",
      colorfulBorder: "border-orange-400",
      count: recipeStats.totalPopular,
      page: "PopularRecipes"
    },
    {
      title: "My Favorites",
      description: "Your bookmarked recipes for quick access",
      icon: Heart,
      gradient: "from-pink-500 to-rose-600",
      colorfulBg: "bg-pink-100",
      colorfulBorder: "border-pink-400",
      count: recipeStats.totalFavorites,
      page: "FavoriteRecipes"
    },
    {
      title: "My Recipes",
      description: "Recipes you've created or customized",
      icon: UserIcon,
      gradient: "from-purple-500 to-indigo-600",
      colorfulBg: "bg-purple-100",
      colorfulBorder: "border-purple-400",
      count: recipeStats.totalMyRecipes,
      page: "MyRecipes"
    }
  ];

  const handleCarouselClick = (index) => {
    const recipe = carouselRecipes[index];
    navigate(createPageUrl(`RecipeDetail?id=${recipe.id}&from=recipe`), {
      state: { recipe }
    });
  };

  if (isAuthChecking || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          {isAuthChecking ? "Checking authentication..." : "Loading recipes..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-slate-900 dark:via-orange-900/20 dark:to-pink-900/20"
          style={{
            backgroundImage: isDarkMode 
              ? 'radial-gradient(circle at 20% 50%, rgba(249, 115, 22, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 20% 50%, rgba(249, 115, 22, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)'
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                <ChefHat className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <h1 
                className="text-3xl sm:text-4xl md:text-5xl font-bold"
                style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
              >
                Recipes
              </h1>
            </div>
            <p 
              className="text-sm sm:text-lg"
              style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
            >
              Discover and create delicious recipes
            </p>
          </div>

          {/* Recipe Carousel */}
          {carouselRecipes.length > 0 && (
            <div className="relative mb-8 sm:mb-12 max-w-4xl mx-auto">
              <div className="relative h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden shadow-2xl">
                {carouselRecipes.map((recipe, index) => (
                  <div
                    key={recipe.id}
                    onClick={() => handleCarouselClick(index)}
                    className={cn(
                      "absolute inset-0 transition-opacity duration-500 cursor-pointer",
                      index === currentSlide ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                  >
                    <img
                      src={recipe.photo_url}
                      alt={recipe.full_title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
                        {recipe.full_title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-white/90 text-xs sm:text-sm">
                        {recipe.cooking_time && (
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                            {recipe.cooking_time}
                          </span>
                        )}
                        {recipe.cuisine && (
                          <span>{recipe.cuisine}</span>
                        )}
                        {recipe.servings && (
                          <span>{recipe.servings} servings</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Navigation Arrows */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlide((prev) => (prev - 1 + carouselRecipes.length) % carouselRecipes.length);
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all z-10"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlide((prev) => (prev + 1) % carouselRecipes.length);
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all z-10"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800" />
                </button>

                {/* Dots Indicator */}
                <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1 sm:gap-2 z-10">
                  {carouselRecipes.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSlide(index);
                      }}
                      className={cn(
                        "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all",
                        index === currentSlide 
                          ? "bg-white w-4 sm:w-6" 
                          : "bg-white/50"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recipe Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <Card
                  key={index}
                  onClick={() => navigate(createPageUrl(section.page))}
                  className={cn(
                    "group cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2",
                    isColorfulTheme 
                      ? `${section.colorfulBg} border-2 ${section.colorfulBorder}` 
                      : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
                  )}
                >
                  <div className={cn("h-2 bg-gradient-to-r", section.gradient)} />
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform", section.gradient)}>
                        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="text-lg sm:text-xl font-bold truncate"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(30 41 59)' }}
                        >
                          {section.title}
                        </h3>
                        <p 
                          className="text-2xl sm:text-3xl font-bold"
                          style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(234 88 12)' }}
                        >
                          {section.count}
                        </p>
                      </div>
                    </div>
                    <p 
                      className="text-sm"
                      style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                    >
                      {section.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
