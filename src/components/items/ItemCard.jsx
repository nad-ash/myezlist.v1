
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Star, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const getCategoryClassName = (category) => {
  const map = {
    "Produce": "item-card-produce",
    "Dairy": "item-card-dairy",
    "Meat & Seafood": "item-card-meat",
    "Bakery": "item-card-bakery",
    "Frozen": "item-card-frozen",
    "Pantry": "item-card-pantry",
    "Beverages": "item-card-beverages",
    "Snacks": "item-card-snacks",
    "Personal Care": "item-card-personal",
    "Household": "item-card-household",
    "Cleaning": "item-card-cleaning",
    "Baby": "item-card-baby",
    "Pet": "item-card-pet",
    "Other": "item-card-other"
  };
  return map[category] || "item-card-other";
};

export default function ItemCard({ item, onToggleCheck, onToggleFavorite, onDelete, onEdit, isShoppingMode = false, hideCheckbox = false, onCardClick = null, compactView = false }) {
  const categoryClass = getCategoryClassName(item.category);
  
  // Remove "Organic" word from name in compact view to save space
  const displayName = compactView 
    ? item.name.replace(/\borganic\b/gi, '').trim().replace(/\s+/g, ' ')
    : item.name;

  return (
    <Card
      onClick={onCardClick ? onCardClick : (isShoppingMode ? () => onToggleCheck(item) : undefined)}
      className={cn(
        "transition-all duration-300 border-2 w-full overflow-hidden",
        isShoppingMode ? "p-0 cursor-pointer" : "p-0.5",
        categoryClass,
        item.is_checked ? "bg-slate-50 opacity-60 dark:bg-slate-800/50" : "bg-white hover:shadow-md dark:bg-slate-800",
        (isShoppingMode || onCardClick) && "active:scale-95",
        onCardClick && "cursor-pointer"
      )}>

      <div className={cn("flex items-stretch w-full min-w-0 overflow-hidden", isShoppingMode ? "gap-1" : "gap-1.5")}>
        {/* Check Button - Hidden in Shopping Mode or when hideCheckbox is true */}
        {!isShoppingMode && !hideCheckbox &&
        <button
          onClick={() => onToggleCheck(item)}
          className={cn(
            "min-w-[30px] h-auto rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 self-stretch",
            item.is_checked ?
            "bg-green-500 border-green-500" :
            "border-slate-300 hover:border-slate-400 active:scale-95 dark:border-slate-600 dark:hover:border-slate-500"
          )}>

            {item.is_checked && <Check className="w-4 h-4 text-white" />}
          </button>
        }

        {/* Item Details */}
        <div className={cn("flex-1 min-w-0 flex flex-col justify-between overflow-hidden", isShoppingMode ? "py-1 px-2" : "py-0.5")}>
          <div className="min-w-0 w-full overflow-hidden">
            <div className={cn("flex items-center min-w-0 w-full overflow-hidden", isShoppingMode ? "gap-1" : "gap-1.5")}>
              <h4
                className={cn(
                  "font-semibold leading-tight flex-1 min-w-0 break-words",
                  compactView ? "text-sm line-clamp-1" : (isShoppingMode ? "text-base line-clamp-2" : "text-sm line-clamp-2"),
                  item.is_checked ? "line-through text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100"
                )}
                style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
              >
                {displayName}
              </h4>
            </div>
            
            <div className={cn("flex items-center flex-wrap min-w-0 w-full overflow-hidden", isShoppingMode ? "gap-0.5 mt-0" : "gap-1 mt-0.5")}>
              {item.quantity &&
              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 flex-shrink-0 max-w-[80px] truncate">
                  {item.quantity}
                </Badge>
              }
              {item.category && !compactView &&
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] h-4 px-1 bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 flex-shrink-0 truncate",
                  compactView && "max-w-[60px]" 
                )}
                title={item.category}
              >
                  {item.category}
                </Badge>
              }
              {item.store_section &&
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] h-4 px-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 flex-shrink-0 truncate",
                  compactView && "max-w-[50px]"
                )}
                title={item.store_section}
              >
                  {item.store_section}
                </Badge>
              }
            </div>

            {(item.brand || item.size_notes) &&
            <p className={cn("text-[10px] text-slate-600 leading-tight dark:text-slate-400 truncate w-full overflow-hidden", isShoppingMode ? "mt-0" : "mt-0.5")}>
                {[item.brand, item.size_notes].filter(Boolean).join(" • ")}
              </p>
            }
          </div>

          {/* Actions - Only show in non-shopping mode */}
          {!isShoppingMode && (
            <div className="flex items-center gap-2 mt-0.5 flex-shrink-0 overflow-hidden">
              {!hideCheckbox && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleFavorite(item)}
                  className={cn(
                    "h-5 px-1",
                    item.is_favorite && "text-yellow-500 dark:text-yellow-400"
                  )}
                >
                  <Star className={cn("w-3 h-3", item.is_favorite && "fill-current")} />
                </Button>
              )}
              {!onCardClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                  className="h-5 px-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(item)}
                className="h-5 px-1 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Photo Thumbnail - Full Card Height with Organic Badge */}
        {item.photo_url &&
        <div className={cn("rounded-lg overflow-visible bg-slate-100 flex-shrink-0 dark:bg-slate-700 relative", isShoppingMode ? "w-16" : "w-20")}>
            <img
            src={item.photo_url}
            alt={item.name}
            className="w-full h-full object-cover rounded-lg" />
            
            {item.is_organic && (
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e49376f2948d5caa147758/bb4a74a3b_Untitleddesign2.png" 
                alt="Organic"
                className={cn(
                  "absolute object-contain organic-badge",
                  compactView ? "w-12 h-12" : "w-[74px] h-[74px]"
                )}
                style={{ 
                  left: compactView ? '-120%' : '-145%',
                  bottom: '-8%',
                  marginBottom: '0',
                  paddingBottom: '0'
                }}
              />
            )}
          </div>
        }
      </div>
    </Card>);

}
