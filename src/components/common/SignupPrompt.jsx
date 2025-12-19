import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Star, 
  ShoppingCart, 
  Pencil, 
  ChefHat,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Feature icons mapping
const featureIcons = {
  favorites: Star,
  shopping: ShoppingCart,
  edit: Pencil,
  create: ChefHat,
  default: Sparkles,
};

// Feature-specific messaging
const featureMessages = {
  favorites: {
    title: "Save Your Favorites",
    description: "Create a free account to save recipes you love and access them anytime!",
    benefits: [
      "Save unlimited recipes to your favorites",
      "Access your saved recipes on any device",
      "Get personalized recipe recommendations",
    ],
  },
  shopping: {
    title: "Add to Shopping List",
    description: "Sign up to add ingredients directly to your shopping list with one tap!",
    benefits: [
      "Add recipe ingredients to your list instantly",
      "Organize items by category automatically",
      "Share lists with family members",
    ],
  },
  edit: {
    title: "Customize This Recipe",
    description: "Create a free account to customize recipes and make them your own!",
    benefits: [
      "Modify ingredients and instructions",
      "Save your personalized versions",
      "Share your creations with others",
    ],
  },
  create: {
    title: "Create Your Own Recipes",
    description: "Sign up to create and save your own recipes!",
    benefits: [
      "Create unlimited custom recipes",
      "Add photos and detailed instructions",
      "Share your recipes with the community",
    ],
  },
  default: {
    title: "Join MyEZList",
    description: "Create a free account to unlock all features!",
    benefits: [
      "Save and organize your favorite recipes",
      "Create smart shopping lists",
      "Access from any device",
    ],
  },
};

export default function SignupPrompt({ 
  open, 
  onOpenChange, 
  feature = "default",
  recipeName = null 
}) {
  const navigate = useNavigate();
  const Icon = featureIcons[feature] || featureIcons.default;
  const messages = featureMessages[feature] || featureMessages.default;

  const handleSignUp = () => {
    // Store the current URL to redirect back after signup
    localStorage.setItem('redirectAfterLogin', window.location.href);
    navigate(createPageUrl('Login'));
    onOpenChange(false);
  };

  const handleSignIn = () => {
    localStorage.setItem('redirectAfterLogin', window.location.href);
    navigate(createPageUrl('Login'));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md !bg-white dark:!bg-slate-900 dark:!border-slate-700">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-xl !text-slate-800 dark:!text-white">
            {messages.title}
          </DialogTitle>
          <DialogDescription className="!text-slate-600 dark:!text-slate-400">
            {recipeName 
              ? `Sign up to ${feature === 'favorites' ? 'save' : 'use this feature for'} "${recipeName}"`
              : messages.description
            }
          </DialogDescription>
        </DialogHeader>

        {/* Benefits List */}
        <div className="space-y-2 py-4">
          {messages.benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">{benefit}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleSignUp}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignIn}
            className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Already have an account? Sign in
          </Button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-center text-slate-500 dark:text-slate-500 pt-2">
          Free forever • No credit card required
        </p>
      </DialogContent>
    </Dialog>
  );
}
