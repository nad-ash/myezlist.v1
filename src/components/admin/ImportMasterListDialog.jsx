
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { FileUp, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { CommonItem } from "@/api/entities";
import { GenerateImage } from "@/api/integrations";

const categories = [
  "Produce",
  "Pantry",
  "Dairy",
  "Meat & Seafood",
  "Frozen",
  "Beverages",
  "Snacks",
  "Household",
  "Bakery",
  "Personal Care",
  "Cleaning",
  "Baby",
  "Pet",
  "Other"
];

const capitalizeWords = (str) => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeName = (name) => {
  // Convert to lowercase, remove "organic", trim
  let normalized = name.toLowerCase().trim().replace(/\borganic\b/gi, '').trim();
  
  // Basic plural handling: remove trailing 's', 'es', 'ies'
  // Handle common plural patterns
  if (normalized.endsWith('ies') && normalized.length > 4) {
    // berries -> berry, cherries -> cherry
    normalized = normalized.slice(0, -3) + 'y';
  } else if (normalized.endsWith('es') && normalized.length > 3 && !normalized.endsWith('ss')) { // Avoid 'glass' -> 'glas'
    // tomatoes -> tomato, potatoes -> potato
    // Also covers 'boxes' -> 'box', 'dishes' -> 'dish'
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith('s') && normalized.length > 2 && !normalized.endsWith('us')) { // Avoid 'cactus' -> 'cactu'
    // apples -> apple, bananas -> banana
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
};

export default function ImportMasterListDialog({ open, onClose, onComplete }) {
  const [rawText, setRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);

  const parseInput = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const items = [];

    for (const line of lines) {
      // Support both comma and tab separation
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      
      // Need at least 3 columns: rank (ignored), item name, category
      if (parts.length >= 3) {
        // parts[0] is rank/popularity - ignore it
        const itemName = parts[1].trim();
        const category = parts[2].trim();
        
        if (itemName && category) {
          // Validate category
          const normalizedCategory = categories.find(
            cat => cat.toLowerCase() === category.toLowerCase()
          ) || 'Other';
          
          items.push({
            name: itemName,
            category: normalizedCategory
          });
        }
      }
    }

    return items;
  };

  const handleImport = async () => {
    if (!rawText.trim()) {
      alert('Please paste your item list first.');
      return;
    }

    const parsedItems = parseInput(rawText);
    
    if (parsedItems.length === 0) {
      alert('No valid items found. Please ensure each line has: Rank, Item Name, Category');
      return;
    }

    setIsImporting(true);
    setProgress({ current: 0, total: parsedItems.length });
    setResult(null);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // Get existing items to check for duplicates
      setStatus('Loading existing items...');
      const existingItems = await CommonItem.list();
      
      // Create a map with normalized names (handling plurals)
      const existingMap = new Map();
      existingItems.forEach(item => {
        const normalized = normalizeName(item.name);
        existingMap.set(normalized, item);
      });

      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        const normalizedNameRaw = item.name.toLowerCase().trim().replace(/\borganic\b/gi, '').trim(); // for storage
        const normalizedForComparison = normalizeName(item.name); // for duplicate check
        const displayName = capitalizeWords(item.name);
        
        setProgress({ current: i + 1, total: parsedItems.length });
        setStatus(`Processing: ${displayName}`);

        // Check for duplicate using normalized form (handles singular/plural)
        if (existingMap.has(normalizedForComparison)) {
          skipped++;
          continue;
        }

        try {
          // Generate image (optional - can be made faster by skipping)
          let photoUrl = '';
          try {
            setStatus(`Generating image for: ${displayName}...`);
            const imagePrompt = `A clean, professional product photo of ${displayName} on a white background, centered, well-lit, high quality product photography`;
            const imageResult = await GenerateImage({ prompt: imagePrompt });
            if (imageResult.url) {
              photoUrl = imageResult.url;
            }
          } catch (imgError) {
            console.warn(`Image generation failed for ${displayName}, continuing without image`);
          }

          // Create the item
          await CommonItem.create({
            name: normalizedNameRaw, // Store the slightly normalized name without plural handling
            display_name: displayName,
            category: item.category,
            photo_url: photoUrl,
            usage_count: 0
          });

          created++;
          
          // Add to existingMap so we don't create duplicates within the same import batch
          // The value associated with the key doesn't matter for `has()`, just that it exists.
          // Using a simple object for consistency with how existing items are stored.
          existingMap.set(normalizedForComparison, { name: normalizedNameRaw });
        } catch (error) {
          console.error(`Error creating item ${displayName}:`, error);
          failed++;
        }
      }

      setResult({ created, skipped, failed });
      setStatus('Import complete!');

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Error during import:", error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setRawText('');
      setProgress({ current: 0, total: 0 });
      setStatus('');
      setResult(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Items to Master List</DialogTitle>
        </DialogHeader>

        {!isImporting && !result && (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-700">
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
                <strong>Format Instructions:</strong>
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                <li>Each line should contain: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">Rank, Item Name, Category</code></li>
                <li>You can separate columns with comma or tab</li>
                <li>The first column (rank/popularity) will be ignored</li>
                <li>Categories: {categories.join(", ")}</li>
                <li>Duplicate items (including singular/plural variations) will be automatically skipped</li>
              </ul>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                <strong>Example:</strong><br />
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded block mt-1">
                  1, Milk, Dairy<br />
                  2, Apples, Produce<br />
                  3, Bread, Bakery
                </code>
              </p>
            </div>

            <Textarea
              placeholder="1, Milk, Dairy&#10;2, Apples, Produce&#10;3, Bread, Bakery&#10;..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              disabled={isImporting}
            />

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!rawText.trim()}>
                <FileUp className="w-4 h-4 mr-2" />
                Import Items
              </Button>
            </div>
          </div>
        )}

        {isImporting && (
          <div className="py-8">
            <div className="text-center mb-6">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                Importing Items...
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Processing {progress.current} of {progress.total}
              </p>
              {status && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">{status}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Progress value={(progress.current / progress.total) * 100} className="h-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                {Math.round((progress.current / progress.total) * 100)}% complete
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="py-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
                Import Complete!
              </h3>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">Items Created</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-300">{result.created}</span>
              </div>
              
              {result.skipped > 0 && (
                <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Items Skipped (Duplicates)</span>
                  <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{result.skipped}</span>
                </div>
              )}
              
              {result.failed > 0 && (
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-sm font-medium text-red-900 dark:text-red-100">Items Failed</span>
                  <span className="text-lg font-bold text-red-700 dark:text-red-300">{result.failed}</span>
                </div>
              )}
            </div>

            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
