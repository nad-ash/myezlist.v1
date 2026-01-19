import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Store, ShoppingBasket, Apple, Home as HomeIcon, Sparkles, Gift, Utensils, ChevronRight, Trash2, Edit, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const iconMap = {
  "shopping-cart": ShoppingCart,
  "store": Store,
  "basket": ShoppingBasket,
  "apple": Apple,
  "home": HomeIcon,
  "sparkles": Sparkles,
  "gift": Gift,
  "utensils": Utensils,
};

const colorMap = {
  ocean: "from-blue-400 to-blue-600",
  forest: "from-green-400 to-green-600",
  sunset: "from-orange-400 to-orange-600",
  lavender: "from-purple-400 to-purple-600",
  rose: "from-rose-400 to-rose-600",
  charcoal: "from-slate-400 to-slate-600",
  mint: "from-teal-400 to-teal-600",
  beige: "from-amber-400 to-amber-600",
};

export default function ListCard({ list, itemCount, checkedCount, onClick, onDelete, onEdit, isOwner, isFamilyShared }) {
  const Icon = iconMap[list.icon] || ShoppingCart;
  const gradient = colorMap[list.color] || colorMap.ocean;

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent card click
    onDelete();
  };

  const handleEdit = (e) => {
    e.stopPropagation(); // Prevent card click
    if (onEdit) onEdit();
  };

  return (
    <Card 
      onClick={onClick}
      className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden group relative bg-white dark:bg-slate-800 border dark:border-slate-700 dark:hover:shadow-slate-900/50 touch-manipulation"
    >
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      
      <CardContent className="p-3 relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform flex-shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold line-clamp-1 text-slate-800 dark:text-slate-100">{list.name}</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all dark:text-slate-500 dark:group-hover:text-slate-400 flex-shrink-0" />
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 text-xs px-1.5 py-0">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Badge>
            {checkedCount > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs px-1.5 py-0">
                {checkedCount} done
              </Badge>
            )}
            {isOwner && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-1.5 py-0">
                Owner
              </Badge>
            )}
            {isFamilyShared && !isOwner && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs px-1.5 py-0 flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                Family
              </Badge>
            )}
          </div>

          {/* Action Buttons - Always visible */}
          {isOwner && (
            <div className="flex gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEdit}
                  className="h-7 w-7 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex-shrink-0"
                >
                  <Edit className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="h-7 w-7 hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}