import React, { useState, useEffect } from "react";
import { User, ListMember, ShoppingList, Item } from "@/api/entities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, List, CheckSquare, Loader2, ChevronRight, Plus, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { appCache } from "@/components/utils/appCache";

export default function ShoppingModePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [stats, setStats] = useState({
    totalLists: 0,
    totalItems: 0,
    activeItems: 0
  });
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    manage: true,
    shopping: true
  });

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

  // Set initial expanded state based on screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobile = window.innerWidth < 640; // sm breakpoint
      setExpandedSections({
        manage: !isMobile, // Collapsed on mobile, expanded on desktop
        shopping: !isMobile
      });
    };

    // Check on mount
    checkScreenSize();

    // Add resize listener
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const checkAuth = async () => {
    try {
      // Check cache first for user
      let currentUser = appCache.getUser();
      if (!currentUser) {
        console.log('🔄 ShoppingMode: Fetching user from API (cache miss)');
        currentUser = await User.me();
        appCache.setUser(currentUser);
      } else {
        console.log('📦 ShoppingMode: Using cached user data');
      }
      
      setUser(currentUser);
      setIsAuthChecking(false);
      loadStats(currentUser);
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("ShoppingMode"));
    }
  };

  const loadStats = async (currentUser) => {
    setLoading(true);
    try {
      // ✅ NEW: Check cache for ListMember first
      let memberships = appCache.getListMemberships(currentUser.id);
      
      if (!memberships) {
        console.log('🔄 ShoppingMode: Fetching ListMember from API (cache miss)');
        memberships = await ListMember.filter({ user_id: currentUser.id });
        appCache.setListMemberships(currentUser.id, memberships);
      } else {
        console.log('📦 ShoppingMode: Using cached ListMember data');
      }
      
      const approvedMemberships = memberships.filter(m => m.status === 'approved' || m.role === 'owner');
      const listIds = approvedMemberships.map(m => m.list_id);

      if (listIds.length > 0) {
        // Try to get all ShoppingList entities from cache first
        let allLists = appCache.getShoppingListEntities();
        
        if (!allLists) {
          console.log('🔄 ShoppingMode: Fetching ShoppingList entities from API (cache miss)');
          allLists = await ShoppingList.list();
          appCache.setShoppingListEntities(allLists);
        } else {
          console.log('📦 ShoppingMode: Using cached ShoppingList entities');
        }
        
        const userLists = allLists.filter(list => listIds.includes(list.id) && !list.archived);
        
        let totalItemsCount = 0;
        let activeItemsCount = 0;

        for (const list of userLists) {
          // Try to get from cache first
          const cachedList = appCache.getShoppingList(list.id);
          
          if (cachedList && cachedList.itemCounts) {
            console.log(`📦 ShoppingMode: Using cached item counts for list ${list.id}`);
            totalItemsCount += (cachedList.itemCounts.total || 0) + (cachedList.itemCounts.checked || 0);
            activeItemsCount += cachedList.itemCounts.total || 0;
          } else {
            console.log(`🔄 ShoppingMode: Fetching items for list ${list.id} from API (cache miss)`);
            const items = await Item.filter({ list_id: list.id });
            const activeItems = items.filter(item => !item.is_checked);
            const checkedItems = items.filter(item => item.is_checked);
            
            totalItemsCount += items.length;
            activeItemsCount += activeItems.length;
            
            // Cache this list with its item counts
            appCache.setShoppingList(list.id, {
              list: list,
              items: items,
              itemCounts: {
                total: activeItems.length,
                checked: checkedItems.length
              },
              timestamp: Date.now()
            });
          }
        }

        setStats({
          totalLists: userLists.length,
          totalItems: totalItemsCount,
          activeItems: activeItemsCount
        });
      } else {
        setStats({
          totalLists: 0,
          totalItems: 0,
          activeItems: 0
        });
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
    setLoading(false);
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleIconClick = (e, page) => {
    e.stopPropagation(); // Prevent card toggle when clicking icon
    navigate(createPageUrl(page));
  };

  const sections = [
    {
      id: "manage",
      title: "Manage My Shopping Lists",
      titleMobile: "Manage Lists",
      description: "Create, edit, and organize your shopping lists. Add items, share lists with family members, and keep everything organized.",
      descriptionMobile: "Create and organize your lists",
      icon: List,
      color: "from-blue-500 to-indigo-600",
      bgColor: "bg-blue-50",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      stats: [
        { label: "Active Lists", labelMobile: "Lists", value: stats.totalLists },
        { label: "Total Items", labelMobile: "Items", value: stats.totalItems }
      ],
      features: [
        "Create and manage multiple lists",
        "Add items with photos and details",
        "Share lists with family",
        "Organize by categories"
      ],
      featuresMobile: [
        "Multiple lists",
        "Add with photos",
        "Share with family"
      ],
      action: "Manage Lists",
      page: "ManageLists"
    },
    {
      id: "shopping",
      title: "Enter Shopping Mode",
      titleMobile: "Shopping Mode",
      description: "Start shopping! Check off items as you add them to your cart. Perfect for when you're at the store and need a streamlined experience.",
      descriptionMobile: "Check off items as you shop",
      icon: ShoppingCart,
      color: "from-green-500 to-emerald-600",
      bgColor: "bg-green-50",
      iconBg: "bg-gradient-to-br from-green-500 to-emerald-600",
      stats: [
        { label: "Items to Buy", labelMobile: "To Buy", value: stats.activeItems },
        { label: "Ready to Shop", labelMobile: "Ready", value: stats.totalLists > 0 ? "Yes" : "No" }
      ],
      features: [
        "Check off items as you shop",
        "View by category for easy navigation",
        "Track shopping progress",
        "Optimized for quick actions"
      ],
      featuresMobile: [
        "Check off items",
        "View by category",
        "Quick actions"
      ],
      action: "Start Shopping",
      page: "ShoppingModeActive"
    }
  ];

  if (isAuthChecking || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          {isAuthChecking ? "Checking authentication..." : "Loading..."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">Shopping</h1>
        </div>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          <span className="hidden sm:inline">Manage your shopping lists and enter shopping mode for a seamless grocery experience</span>
          <span className="sm:hidden">Manage lists and shop seamlessly</span>
        </p>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections[section.id];
          
          return (
            <Card
              key={section.id}
              className="transition-all duration-300 transform overflow-hidden border-2 bg-white dark:bg-slate-800 dark:border-slate-700"
            >
              <div className={cn("h-2 bg-gradient-to-r", section.color)} />
              
              <CardContent className="p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-800">
                {/* Header with Toggle - Entire header is clickable */}
                <div 
                  className="flex items-start gap-3 sm:gap-4 mb-4 cursor-pointer"
                  onClick={() => toggleSection(section.id)}
                >
                  {/* Icon - Clickable for navigation */}
                  <div 
                    className={cn(
                      "w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 cursor-pointer hover:scale-110 transition-transform",
                      section.iconBg
                    )}
                    onClick={(e) => handleIconClick(e, section.page)}
                  >
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-100">
                        <span className="sm:hidden">{section.titleMobile}</span>
                        <span className="hidden sm:inline">{section.title}</span>
                      </h3>
                      <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm lg:text-base text-slate-600 dark:text-slate-400 leading-snug sm:leading-relaxed mt-1">
                      <span className="sm:hidden">{section.descriptionMobile}</span>
                      <span className="hidden sm:inline">{section.description}</span>
                    </p>
                  </div>
                </div>

                {/* Collapsible Content */}
                <div
                  className={cn(
                    "transition-all duration-300 overflow-hidden",
                    isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  {/* Stats */}
                  <div 
                    className="rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border-2"
                    style={{
                      backgroundColor: isDarkMode 
                        ? 'rgb(51 65 85)'
                        : section.id === 'manage' ? 'rgb(239 246 255)' : 'rgb(240 253 244)',
                      borderColor: isDarkMode
                        ? 'rgb(71 85 105)'
                        : section.id === 'manage' ? 'rgb(191 219 254)' : 'rgb(220 252 231)'
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {section.stats.map((stat, idx) => (
                        <div key={idx}>
                          <div 
                            className="text-xl sm:text-2xl lg:text-3xl font-bold"
                            style={{ color: isDarkMode ? 'rgb(255 255 255)' : 'rgb(30 41 59)' }}
                          >
                            {stat.value}
                          </div>
                          <div 
                            className="text-xs sm:text-sm"
                            style={{ color: isDarkMode ? 'rgb(226 232 240)' : 'rgb(71 85 105)' }}
                          >
                            <span className="sm:hidden">{stat.labelMobile}</span>
                            <span className="hidden sm:inline">{stat.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                    {/* Mobile - Show compact features */}
                    <div className="sm:hidden">
                      {section.featuresMobile.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <CheckSquare className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    {/* Desktop - Show full features */}
                    <div className="hidden sm:block">
                      {section.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <CheckSquare className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(createPageUrl(section.page));
                    }}
                    className={cn(
                      "w-full h-10 sm:h-12 text-sm sm:text-base font-semibold bg-gradient-to-r hover:shadow-lg transition-all",
                      section.color
                    )}
                  >
                    {section.action}
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Start Tip */}
      {stats.totalLists === 0 && (
        <div className="mt-8">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700">
            <CardContent className="p-4 sm:p-6 bg-transparent">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 text-sm sm:text-base">
                    Getting Started
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-3 sm:mb-4">
                    <span className="sm:hidden">Create your first list to start shopping!</span>
                    <span className="hidden sm:inline">You don't have any shopping lists yet. Start by creating your first list to organize your shopping!</span>
                  </p>
                  <Button
                    onClick={() => navigate(createPageUrl("ManageLists") + "?openCreate=true")}
                    className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base h-9 sm:h-10"
                  >
                    Create Your First List
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}