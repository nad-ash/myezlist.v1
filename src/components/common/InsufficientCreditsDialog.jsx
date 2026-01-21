import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Settings, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * InsufficientCreditsDialog - User-friendly dialog shown when user doesn't have enough credits
 * 
 * Props:
 * - open: boolean - Controls dialog visibility
 * - onClose: function - Called when dialog is closed
 * - creditsNeeded: number - How many credits are required
 * - creditsAvailable: number - How many credits user has
 * - featureName: string - Name of the feature (e.g., "Fast Add with AI")
 * - onAddManually: function - Optional callback when user clicks "Add Manually"
 * - itemName: string - Optional item name to show in the dialog
 */
export default function InsufficientCreditsDialog({
  open,
  onClose,
  creditsNeeded = 0,
  creditsAvailable = 0,
  featureName = "this feature",
  onAddManually,
  itemName = ""
}) {
  const navigate = useNavigate();

  const handleGoToSettings = () => {
    onClose();
    navigate(createPageUrl("Settings"));
  };

  const handleAddManually = () => {
    onClose();
    if (onAddManually) {
      onAddManually(itemName);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md max-h-[90vh] overflow-y-auto !bg-white dark:!bg-slate-900 dark:!border-slate-700"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl dark:text-slate-100">
                  Insufficient Credits
                </DialogTitle>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Main Message */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Insufficient credits left for current subscription month for <strong>{featureName}</strong>.
            </p>
            <p className="text-slate-700 dark:text-slate-300 mt-2">
              Need <strong className="text-amber-600 dark:text-amber-400">{creditsNeeded}</strong> credits but only have <strong className="text-amber-600 dark:text-amber-400">{creditsAvailable}</strong>.
            </p>
          </div>

          {/* Settings Link */}
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Go to{" "}
            <button
              onClick={handleGoToSettings}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            {" "}to view your credits or upgrade your plan.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {onAddManually && (
              <Button
                onClick={handleAddManually}
                variant="outline"
                className="w-full h-11 !bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Item Manually
              </Button>
            )}
            
            <Button
              onClick={handleGoToSettings}
              className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md"
            >
              <Settings className="w-4 h-4 mr-2" />
              View Credits & Plans
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

