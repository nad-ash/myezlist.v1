
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShoppingCart, BarChart3, Settings, LogOut, CheckCircle2, Utensils, ListChecks, Home } from "lucide-react";
import { User, AUTH_PROVIDER } from "@/api/entities";
import { clearBase44Session } from "@/api/base44Link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeSelector from "../components/theme/ThemeSelector";
import { cn } from "@/lib/utils";
import { appCache } from "../components/utils/appCache";

const navigationItems = [
  { title: "Home", url: "Home", icon: Home },
  { title: "Shopping", url: "ShoppingMode", icon: ShoppingCart },
  { title: "Recipe", url: "Recipe", icon: Utensils },
  { title: "Tasks", url: "Todos", icon: CheckCircle2 },
  { title: "Settings", url: "Settings", icon: Settings },
];

const adminNavigationItems = [
  { title: "Home", url: "Home", icon: Home },
  { title: "Shopping", url: "ShoppingMode", icon: ShoppingCart },
  { title: "Recipe", url: "Recipe", icon: Utensils },
  { title: "Tasks", url: "Todos", icon: CheckCircle2 },
  { title: "Admin", url: "Admin", icon: Settings },
];

// Unified Sidebar component that works for both admin and regular users
const DesktopSidebar = React.memo(({ navItems }) => {
  const location = useLocation();
  
  return (
    <aside className="hidden md:block w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 min-h-screen fixed top-16 left-0 bottom-0 overflow-y-auto">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === createPageUrl(item.url);
          return (
            <Link
              key={item.url}
              to={createPageUrl(item.url)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all nav-item",
                isActive 
                  ? "bg-blue-50 text-blue-600 font-semibold dark:bg-blue-900/30 dark:text-blue-400" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="w-5 h-5 nav-icon" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}, (prevProps, nextProps) => prevProps.navItems === nextProps.navItems);

DesktopSidebar.displayName = 'DesktopSidebar';

// Independent MobileNavigation
const MobileNavigation = React.memo(({ isAdmin }) => {
  const location = useLocation();
  const navItems = isAdmin ? adminNavigationItems : navigationItems;
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 z-50 dark:bg-slate-900/95 dark:border-slate-700 transition-colors duration-300 pb-safe">
      <div className="flex justify-around items-center h-20 px-2 pt-2 pb-4">
        {navItems.map((item) => {
          const isActive = location.pathname === createPageUrl(item.url);
          return (
            <Link
              key={item.url}
              to={createPageUrl(item.url)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors nav-item ${
                isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <item.icon className={`w-6 h-6 nav-icon ${isActive ? "stroke-2" : ""}`} />
              <span className="text-xs mt-1 font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}, (prevProps, nextProps) => prevProps.isAdmin === nextProps.isAdmin);

MobileNavigation.displayName = 'MobileNavigation';

const UserContext = React.createContext(null);

export default function Layout({ children, currentPageName }) {
  // Initialize user from cache immediately to prevent navigation flicker
  const cachedUserInitial = React.useMemo(() => appCache.getUser(), []);
  const [user, setUser] = React.useState(cachedUserInitial);
  const [isLoadingUser, setIsLoadingUser] = React.useState(!cachedUserInitial);
  const loadAttempted = React.useRef(false);
  const hardRefreshHandled = React.useRef(false);

  // Detect hard refresh and clear cache - only run once on initial mount
  React.useEffect(() => {
    if (hardRefreshHandled.current) return;
    hardRefreshHandled.current = true;
    
    const perfEntries = performance.getEntriesByType('navigation');
    if (perfEntries.length > 0) {
      const navTiming = perfEntries[0];
      // Check if this was a hard reload
      if (navTiming.type === 'reload') {
        console.log('🔄 Hard refresh detected - clearing all app cache');
        appCache.clearAll();
        console.log('✅ Cache cleared after reload');
      }
    }
  }, []);

  const isLandingPage = currentPageName === "Landing";
  const isJoinPage = currentPageName === "JoinListViaLink";
  const isLoginPage = currentPageName === "Login";

  // Reset loadAttempted when navigating to a new page (allows re-fetching after login)
  React.useEffect(() => {
    // Reset the flag when page changes, so user can be re-fetched after login redirect
    if (!isLandingPage && !isLoginPage && !user) {
      loadAttempted.current = false;
    }
  }, [currentPageName, isLandingPage, isLoginPage, user]);

  React.useEffect(() => {
    // Don't load user on Landing page or Login page - they're for logged out users
    if (isLandingPage || isLoginPage) {
      setIsLoadingUser(false);
      return;
    }

    // If we already have a user from cache, don't show loading
    if (user) {
      setIsLoadingUser(false);
    }

    if (loadAttempted.current) return;
    
    loadAttempted.current = true;
    let mounted = true;
    
    const loadUser = async () => {
      try {
        console.log('🔄 Layout: Fetching user from API');
        const currentUser = await User.me();
        
        // Check if cached user exists and if it's the same user
        const existingCachedUser = appCache.getUser();
        if (existingCachedUser && existingCachedUser.id !== currentUser.id) {
          console.log('⚠️ Layout: Different user detected! Clearing all cache');
          appCache.clearAll();
        }
        
        if (mounted) {
          setUser(currentUser);
          appCache.setUser(currentUser);
        }
      } catch (error) {
        console.error("Not authenticated");
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoadingUser(false);
        }
      }
    };
    
    loadUser();
    
    return () => {
      mounted = false;
    };
  }, [isLandingPage, isLoginPage, user]);

  const handleLogout = React.useCallback(async () => {
    console.log('🚪 LOGOUT: Clearing cache and logging out');
    
    // Clear all app cache first
    appCache.clearAll();
    
    // Clear Base44 session if using hybrid auth
    clearBase44Session();
    
    // Clear localStorage and sessionStorage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
    
    // Let auth SDK handle logout and redirect
    await User.logout(createPageUrl("Landing"));
  }, []);

  const isAdmin = user?.role === 'admin';
  
  const showDesktopSidebar = !isJoinPage && !isLandingPage && user;
  const showMobileNav = !isJoinPage && !isLandingPage && user;
  const showHeader = !isJoinPage;
  
  const sidebarNavItems = isAdmin ? adminNavigationItems : navigationItems;

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 transition-colors duration-300">
        <style>{`
          :root {
            --color-ocean: #0ea5e9;
            --color-forest: #10b981;
            --color-sunset: #f97316;
            --color-lavender: #a855f7;
            --color-rose: #f43f5e;
            --color-charcoal: #475569;
            --color-mint: #14b8a6;
            --color-beige: #d97706;
          }

          /* Safe area padding for iPhone home indicator */
          .pb-safe {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          /* Hide scrollbar for category filters and horizontal scrolling */
          .scrollbar-hide::-webkit-scrollbar,
          [style*="scrollbarWidth"]::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide,
          [style*="scrollbarWidth"] {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          /* Organic Badge Blend Mode */
          .organic-badge {
            mix-blend-mode: multiply;
          }
          
          .theme-dark .organic-badge {
            mix-blend-mode: normal;
            filter: brightness(1.2) contrast(1.1);
          }

          /* Default Theme - Category Border Colors */
          .item-card-produce { border-color: rgb(134 239 172) !important; }
          .item-card-dairy { border-color: rgb(147 197 253) !important; }
          .item-card-meat { border-color: rgb(252 165 165) !important; }
          .item-card-bakery { border-color: rgb(254 243 199) !important; }
          .item-card-frozen { border-color: rgb(103 232 249) !important; }
          .item-card-pantry { border-color: rgb(251 191 36) !important; }
          .item-card-beverages { border-color: rgb(196 181 253) !important; }
          .item-card-snacks { border-color: rgb(244 114 182) !important; }
          .item-card-personal { border-color: rgb(165 180 252) !important; }
          .item-card-household { border-color: rgb(203 213 225) !important; }
          .item-card-cleaning { border-color: rgb(94 234 212) !important; }
          .item-card-baby { border-color: rgb(251 113 133) !important; }
          .item-card-pet { border-color: rgb(190 242 100) !important; }
          .item-card-other { border-color: rgb(209 213 219) !important; }

          /* Dark Mode Styles */
          .theme-dark {
            color-scheme: dark;
          }
          
          .theme-dark,
          .theme-dark body,
          .theme-dark #root {
            background: linear-gradient(to bottom right, rgb(15 23 42), rgb(30 41 59), rgb(15 23 42)) !important;
          }
          
          .theme-dark header {
            background: rgba(30, 41, 59, 0.95) !important;
            backdrop-filter: blur(12px);
            border-bottom-color: rgb(71 85 105) !important;
          }
          
          .theme-dark nav {
            background: rgba(30, 41, 59, 0.98) !important;
            backdrop-filter: blur(12px);
            border-top-color: rgb(71 85 105) !important;
          }
          
          .theme-dark .bg-white {
            background-color: rgb(30 41 59) !important;
            color: rgb(241 245 249);
          }
          
          .theme-dark .bg-slate-50,
          .theme-dark .bg-slate-100 {
            background-color: rgb(51 65 85) !important;
            color: rgb(226 232 240);
          }
          
          .theme-dark .text-slate-800 {
            color: rgb(248 250 252) !important;
          }
          
          .theme-dark .text-slate-700 {
            color: rgb(241 245 249) !important;
          }
          
          .theme-dark .text-slate-600 {
            color: rgb(203 213 225) !important;
          }
          
          .theme-dark .text-slate-500 {
            color: rgb(148 163 184) !important;
          }
          
          .theme-dark .text-slate-400 {
            color: rgb(148 163 184) !important;
          }
          
          .theme-dark .border-slate-200,
          .theme-dark .border-slate-300 {
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark .bg-gradient-to-br {
            background: linear-gradient(to bottom right, rgb(15 23 42), rgb(30 41 59), rgb(15 23 42)) !important;
          }

          /* Dark Mode - Dialog Background Override */
          .theme-dark [role="dialog"],
          .theme-dark [data-radix-dialog-content] {
            background-color: rgb(15 23 42) !important;
            color: rgb(241 245 249) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark [data-radix-dialog-overlay] {
            background-color: rgba(0, 0, 0, 0.8) !important;
          }

          /* Dark Mode - Card shadows */
          .theme-dark .shadow-lg {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3) !important;
          }
          
          .theme-dark .shadow-md,
          .theme-dark .hover\\:shadow-md:hover {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3) !important;
          }

          /* Dark Mode - Buttons and interactive elements */
          .theme-dark button {
            color: rgb(241 245 249);
          }
          
          .theme-dark .bg-gradient-to-r {
            color: rgb(248 250 252) !important;
          }
          
          /* Dark Mode - Exception for white background buttons (should keep dark text) */
          .theme-dark button.bg-white,
          .theme-dark button[class*="bg-white"] {
            color: rgb(51 65 85) !important;
          }
          
          /* Dark Mode - Outline variant buttons should have white text */
          .theme-dark button[class*="variant-outline"],
          .theme-dark button[data-variant="outline"] {
            color: rgb(241 245 249) !important;
            background-color: rgb(51 65 85) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark button[class*="variant-outline"]:hover,
          .theme-dark button[data-variant="outline"]:hover {
            background-color: rgb(71 85 105) !important;
          }

          /* Dark Mode - Master List Action Buttons */
          .theme-dark .master-list-action-btn {
            color: rgb(241 245 249) !important;
            background-color: rgb(51 65 85) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark .master-list-action-btn:hover:not(:disabled) {
            background-color: rgb(71 85 105) !important;
          }
          
          .theme-dark .master-list-action-btn svg {
            color: rgb(241 245 249) !important;
          }
          
          /* Dark Mode - Input fields */
          .theme-dark input,
          .theme-dark textarea {
            background-color: rgb(51 65 85) !important;
            color: rgb(241 245 249) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark input::placeholder,
          .theme-dark textarea::placeholder {
            color: rgb(148 163 184) !important;
          }
          
          /* Dark Mode - Labels */
          .theme-dark label,
          .theme-dark [class*="label"] {
            color: rgb(248 250 252) !important;
          }
          
          /* Dark Mode - Dialog Titles */
          .theme-dark [role="dialog"] h2,
          .theme-dark [data-radix-dialog-content] h2 {
            color: rgb(248 250 252) !important;
          }
          
          /* Dark Mode - Badges */
          .theme-dark .badge,
          .theme-dark [class*="badge"] {
            color: rgb(241 245 249) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          /* Dark Mode - Outline variant badges (filters) */
          .theme-dark [class*="badge"][class*="outline"] {
            color: rgb(248 250 252) !important;
            border-color: rgb(100 116 139) !important;
            background-color: transparent !important;
          }

          /* Dark Mode - Select/Dropdown components */
          .theme-dark [role="combobox"],
          .theme-dark button[role="combobox"] {
            background-color: rgb(51 65 85) !important;
            color: rgb(248 250 252) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark [data-radix-select-trigger] {
            background-color: rgb(51 65 85) !important;
            color: rgb(248 250 252) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark [data-radix-select-content] {
            background-color: rgb(30 41 59) !important;
            border-color: rgb(71 85 105) !important;
          }
          
          .theme-dark [data-radix-select-item] {
            color: rgb(241 245 249) !important;
          }

          /* Dark Mode - Category border colors (brighter for better visibility) */
          .theme-dark .item-card-produce { border-color: rgb(74 222 128) !important; }
          .theme-dark .item-card-dairy { border-color: rgb(96 165 250) !important; }
          .theme-dark .item-card-meat { border-color: rgb(248 113 113) !important; }
          .theme-dark .item-card-bakery { border-color: rgb(250 204 21) !important; }
          .theme-dark .item-card-frozen { border-color: rgb(34 211 238) !important; }
          .theme-dark .item-card-pantry { border-color: rgb(251 146 60) !important; }
          .theme-dark .item-card-beverages { border-color: rgb(167 139 250) !important; }
          .theme-dark .item-card-snacks { border-color: rgb(236 72 153) !important; }
          .theme-dark .item-card-personal { border-color: rgb(129 140 248) !important; }
          .theme-dark .item-card-household { border-color: rgb(148 163 184) !important; }
          .theme-dark .item-card-cleaning { border-color: rgb(45 212 191) !important; }
          .theme-dark .item-card-baby { border-color: rgb(244 63 94) !important; }
          .theme-dark .item-card-pet { border-color: rgb(163 230 53) !important; }
          .theme-dark .item-card-other { border-color: rgb(156 163 175) !important; }

          /* Colorful Mode Styles */
          .theme-colorful .item-card-produce {
            background-color: rgb(220 252 231) !important;
            border: 2px solid rgb(134 239 172) !important;
          }
          
          .theme-colorful .item-card-dairy {
            background-color: rgb(219 234 254) !important;
            border: 2px solid rgb(147 197 253) !important;
          }
          
          .theme-colorful .item-card-meat {
            background-color: rgb(254 226 226) !important;
            border: 2px solid rgb(252 165 165) !important;
          }
          
          .theme-colorful .item-card-bakery {
            background-color: rgb(254 243 199) !important;
            border: 2px solid rgb(253 224 71) !important;
          }
          
          .theme-colorful .item-card-frozen {
            background-color: rgb(207 250 254) !important;
            border: 2px solid rgb(103 232 249) !important;
          }
          
          .theme-colorful .item-card-pantry {
            background-color: rgb(254 237 220) !important;
            border: 2px solid rgb(251 191 36) !important;
          }
          
          .theme-colorful .item-card-beverages {
            background-color: rgb(237 233 254) !important;
            border: 2px solid rgb(196 181 253) !important;
          }
          
          .theme-colorful .item-card-snacks {
            background-color: rgb(252 231 243) !important;
            border: 2px solid rgb(244 114 182) !important;
          }
          
          .theme-colorful .item-card-personal {
            background-color: rgb(224 231 255) !important;
            border: 2px solid rgb(165 180 252) !important;
          }
          
          .theme-colorful .item-card-household {
            background-color: rgb(241 245 249) !important;
            border: 2px solid rgb(203 213 225) !important;
          }
          
          .theme-colorful .item-card-cleaning {
            background-color: rgb(204 251 241) !important;
            border: 2px solid rgb(94 234 212) !important;
          }
          
          .theme-colorful .item-card-baby {
            background-color: rgb(255 228 230) !important;
            border: 2px solid rgb(251 113 133) !important;
          }
          
          .theme-colorful .item-card-pet {
            background-color: rgb(236 252 203) !important;
            border: 2px solid rgb(190 242 100) !important;
          }
          
          .theme-colorful .item-card-other {
            background-color: rgb(243 244 246) !important;
            border: 2px solid rgb(209 213 219) !important;
          }

          /* Colorful Theme - Colorful Navigation Icons */
          .theme-colorful .nav-item:nth-child(1) .nav-icon {
            color: #3b82f6 !important; /* Blue for Home */
          }
          
          .theme-colorful .nav-item:nth-child(2) .nav-icon {
            color: #10b981 !important; /* Green for Shopping */
          }
          
          .theme-colorful .nav-item:nth-child(3) .nav-icon {
            color: #ef4444 !important; /* Red for Recipe */
          }
          
          .theme-colorful .nav-item:nth-child(4) .nav-icon {
            color: #f59e0b !important; /* Amber for Tasks */
          }
          
          .theme-colorful .nav-item:nth-child(5) .nav-icon {
            color: #8b5cf6 !important; /* Purple for Admin */
          }

          /* Colorful Theme - Active state icons (slightly darker) */
          .theme-colorful .nav-item:nth-child(1).bg-blue-50 .nav-icon,
          .theme-colorful .nav-item:nth-child(1).text-blue-600 .nav-icon {
            color: #2563eb !important;
          }
          
          .theme-colorful .nav-item:nth-child(2).bg-blue-50 .nav-icon,
          .theme-colorful .nav-item:nth-child(2).text-blue-600 .nav-icon {
            color: #059669 !important;
          }
          
          .theme-colorful .nav-item:nth-child(3).bg-blue-50 .nav-icon,
          .theme-colorful .nav-item:nth-child(3).text-blue-600 .nav-icon {
            color: #dc2626 !important;
          }
          
          .theme-colorful .nav-item:nth-child(4).bg-blue-50 .nav-icon,
          .theme-colorful .nav-item:nth-child(4).text-blue-600 .nav-icon {
            color: #d97706 !important;
          }
          
          .theme-colorful .nav-item:nth-child(5).bg-blue-50 .nav-icon,
          .theme-colorful .nav-item:nth-child(5).text-blue-600 .nav-icon {
            color: #7c3aed !important;
          }
        `}</style>

        {/* Header */}
        {showHeader && (
          <header className="bg-white/60 backdrop-blur-lg border-b border-slate-200 fixed top-0 left-0 right-0 z-50 dark:bg-slate-900/70 dark:border-slate-700 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <Link to={createPageUrl(user ? "Home" : "Landing")} className="flex items-center gap-2">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e49376f2948d5caa147758/52890d187_MyEZList_Icon_512x512.png"
                    alt="MyEZList"
                    className="w-9 h-9 object-contain"
                  />
                  <span className="text-2xl font-bold">
                    <span className="text-slate-800 dark:text-slate-100">My</span>
                    <span className="text-orange-700 dark:text-orange-500">EZ</span>
                    <span className="text-slate-800 dark:text-slate-100">List</span>
                  </span>
                </Link>

                <div className="flex items-center gap-2">
                  {user && <ThemeSelector />}
                  
                  {!isLoadingUser && (
                    <>
                      {user ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center dark:from-blue-500 dark:to-indigo-600">
                                <span className="text-white text-sm font-semibold">
                                  {user.full_name?.charAt(0) || user.email?.charAt(0)}
                                </span>
                              </div>
                              <span className="hidden sm:inline text-sm font-medium dark:text-slate-200">{user.full_name}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="dark:bg-slate-800 dark:border-slate-700">
                            <DropdownMenuItem 
                              onClick={() => window.location.href = createPageUrl("Settings")}
                              className="dark:hover:bg-slate-700 cursor-pointer"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout} className="dark:hover:bg-slate-700 cursor-pointer">
                              <LogOut className="w-4 h-4 mr-2" />
                              Logout
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button 
                          onClick={() => User.redirectToLogin(createPageUrl("Home"))}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                        >
                          Sign In
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        {showDesktopSidebar ? (
          <div className="flex pt-16">
            <DesktopSidebar navItems={sidebarNavItems} />
            <main className="flex-1 pb-20 md:pb-8 md:ml-64">
              {children}
            </main>
          </div>
        ) : (
          <main className={isJoinPage ? "pt-16" : "pt-16 pb-20 md:pb-8"}>
            {children}
          </main>
        )}

        {showMobileNav && (
          <MobileNavigation isAdmin={isAdmin} />
        )}
      </div>
    </UserContext.Provider>
  );
}
