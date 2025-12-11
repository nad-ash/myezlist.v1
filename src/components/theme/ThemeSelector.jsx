import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Palette, Check, Lock } from "lucide-react";
import { canAccessTheme, getUserTierInfo } from "@/components/utils/tierManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { cn } from "@/lib/utils";

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('familycart-theme') || 'default';
  });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [themeAccessInfo, setThemeAccessInfo] = useState({});
  const [tierInfo, setTierInfo] = useState(null);

  useEffect(() => {
    // Remove all existing theme classes from the document element
    document.documentElement.classList.remove('theme-dark', 'theme-colorful');
    
    // Add the current theme class if it's not the default
    if (currentTheme !== 'default') {
      document.documentElement.classList.add(`theme-${currentTheme}`);
    }
    
    // Save the current theme to localStorage (ensures consistency on initial load)
    localStorage.setItem('familycart-theme', currentTheme);

    // Load user tier information
    loadTierInfo();
  }, []);

  const loadTierInfo = async () => {
    try {
      const info = await getUserTierInfo();
      setTierInfo(info);
    } catch (error) {
      console.error("Error loading tier info:", error);
    }
  };

  const handleThemeChange = async (themeValue) => {
    // Check if the user has access to the selected theme
    const accessCheck = await canAccessTheme(themeValue);
    
    // Fixed: Check for 'canAccess' not 'hasAccess'
    if (!accessCheck.canAccess) {
      // If access is denied, show the upgrade prompt
      setThemeAccessInfo({
        message: accessCheck.message,
        themeName: themeValue
      });
      setShowUpgradePrompt(true);
      return;
    }
    
    // Apply the selected theme directly to the document element
    const root = document.documentElement;
    root.classList.remove("theme-default", "theme-dark", "theme-colorful");
    root.classList.add(`theme-${themeValue}`);
    
    // Update the React state with the new theme
    setCurrentTheme(themeValue);
    // Save the new theme to localStorage
    localStorage.setItem("familycart-theme", themeValue);
  };

  const themes = [
    { value: 'default', label: 'Default', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'colorful', label: 'Colorful', icon: Palette },
  ];

  // Determine the icon for the dropdown trigger based on the current active theme
  const currentIconDefinition = themes.find(t => t.value === currentTheme);
  const CurrentIcon = currentIconDefinition?.icon || Sun;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <CurrentIcon className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {themes.map((t) => {
            // Check if the theme is locked based on the user's tier information
            // Admin users will have all themes in allowedThemes due to the bypass
            const isLocked = tierInfo && !tierInfo.limits.allowedThemes.includes(t.value);
            
            return (
              <DropdownMenuItem
                key={t.value}
                onClick={() => !isLocked && handleThemeChange(t.value)}
                className={cn(
                  "flex items-center justify-between",
                  currentTheme === t.value && "bg-blue-50 dark:bg-blue-900/20",
                  isLocked && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2">
                  <t.icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </div>
                {isLocked && <Lock className="w-3 h-3 text-amber-500" />}
                {currentTheme === t.value && <Check className="w-4 h-4 text-blue-600" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title="Premium Theme Locked"
        message={themeAccessInfo.message}
        featureName={`${themeAccessInfo.themeName} Theme`}
      />
    </>
  );
}