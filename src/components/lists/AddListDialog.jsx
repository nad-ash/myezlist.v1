
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Store, ShoppingBasket, Apple, Home as HomeIcon, Sparkles, Gift, Utensils } from "lucide-react";

const icons = [
  { value: "shopping-cart", Icon: ShoppingCart },
  { value: "store", Icon: Store },
  { value: "basket", Icon: ShoppingBasket },
  { value: "apple", Icon: Apple },
  { value: "home", Icon: HomeIcon },
  { value: "sparkles", Icon: Sparkles },
  { value: "gift", Icon: Gift },
  { value: "utensils", Icon: Utensils },
];

const colors = [
  { value: "ocean", label: "Ocean Blue", class: "from-blue-400 to-blue-600" },
  { value: "forest", label: "Forest Green", class: "from-green-400 to-green-600" },
  { value: "sunset", label: "Sunset Orange", class: "from-orange-400 to-orange-600" },
  { value: "lavender", label: "Lavender", class: "from-purple-400 to-purple-600" },
  { value: "rose", label: "Rose Pink", class: "from-rose-400 to-rose-600" },
  { value: "charcoal", label: "Charcoal", class: "from-slate-400 to-slate-600" },
  { value: "mint", label: "Mint Fresh", class: "from-teal-400 to-teal-600" },
  { value: "beige", label: "Warm Beige", class: "from-amber-400 to-amber-600" },
];

export default function AddListDialog({ open, onClose, onSave }) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("shopping-cart");
  const [selectedColor, setSelectedColor] = useState("ocean");

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
      });
      setName("");
      setSelectedIcon("shopping-cart");
      setSelectedColor("ocean");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">List Name</Label>
            <Input
              id="name"
              placeholder="e.g., Costco, Target, Weekly Groceries"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              maxLength={50}
            />
            <p className="text-xs text-slate-500">
              {name.length}/50 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Choose Icon</Label>
            <div className="grid grid-cols-4 gap-2">
              {icons.map(({ value, Icon }) => (
                <button
                  key={value}
                  onClick={() => setSelectedIcon(value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedIcon === value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Icon className="w-6 h-6 mx-auto text-slate-700" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Choose Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map(({ value, class: colorClass }) => (
                <button
                  key={value}
                  onClick={() => setSelectedColor(value)}
                  className={`h-12 rounded-lg bg-gradient-to-br ${colorClass} transition-all ${
                    selectedColor === value
                      ? "ring-2 ring-offset-2 ring-slate-400 scale-105"
                      : "hover:scale-105"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Create List
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
