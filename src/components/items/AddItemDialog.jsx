import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Upload, X, Loader2, Sparkles, Check, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommonItem, Item, ActivityTracking } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { InvokeLLM, GenerateImage, UploadFile } from "@/api/integrations";
import { getCommonItemsCache, loadCommonItemsCache } from "@/components/utils/commonItemsCache";
import { consumeCredits, checkCreditsAvailable } from "@/components/utils/creditManager";

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

export default function AddItemDialog({ open, onClose, onSave, listSections, editItem = null }) {
  const [item, setItem] = useState({
    name: "",
    quantity: "",
    category: "Other",
    brand: "",
    size_notes: "",
    photo_url: "",
    is_organic: false,
  });
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedGenerated, setSelectedGenerated] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [commonItemsCache, setCommonItemsCacheState] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingCache, setLoadingCache] = useState(false);

  useEffect(() => {
    if (open) {
      loadCache();
    }
  }, [open]);

  useEffect(() => {
    if (editItem) {
      setItem({
        name: editItem.name || "",
        quantity: editItem.quantity || "",
        category: editItem.category || "Other",
        brand: editItem.brand || "",
        size_notes: editItem.size_notes || "",
        photo_url: editItem.photo_url || "",
        is_organic: editItem.is_organic || false,
      });
      setSelectedGenerated(null);
      setGeneratedImages([]);
    } else {
      resetForm();
    }
  }, [editItem, open]);

  const loadCache = async () => {
    setLoadingCache(true);
    try {
      const cacheData = await loadCommonItemsCache();
      setCommonItemsCacheState(cacheData);
    } catch (error) {
      console.error("Error loading cache:", error);
    }
    setLoadingCache(false);
  };

  const handleSave = () => {
    if (item.name.trim()) {
      const finalItem = {
        ...item,
        name: capitalizeWords(item.name.trim()),
        photo_url: selectedGenerated || item.photo_url
      };
      onSave(finalItem);
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setItem({
      name: "",
      quantity: "",
      category: "Other",
      brand: "",
      size_notes: "",
      photo_url: "",
      is_organic: false,
    });
    setGeneratedImages([]);
    setSelectedGenerated(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const autoCategorizItem = async (itemName) => {
    if (!itemName.trim()) return;
    
    setCategorizing(true);
    try {
      const response = await InvokeLLM({
        prompt: `Given this grocery/household item: "${itemName}", classify it into one of these categories: ${categories.join(", ")}. Return ONLY the category name, nothing else.`,
        response_json_schema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: categories
            }
          }
        }
      });
      
      if (response.category && categories.includes(response.category)) {
        // Update the item category based on LLM response
        setItem(prev => ({ ...prev, category: response.category }));

        const normalizedNameForLookup = itemName.toLowerCase().trim();
        const capitalizedName = capitalizeWords(itemName.trim());
        const detectedCategory = response.category;
        const photoUrl = selectedGenerated || item.photo_url || null; // Use current photo if available

        // Check if item already exists in cache (which should reflect the database)
        // Only add if it's genuinely new to the common items list
        const existsInCache = commonItemsCache.some(ci => ci.name === normalizedNameForLookup);

        if (!existsInCache) {
          try {
            // Add to CommonItem table
            await CommonItem.create({
              name: normalizedNameForLookup,
              display_name: capitalizedName,
              category: detectedCategory,
              photo_url: photoUrl,
              usage_count: 1
            });
            
            // Update statistics - atomic increment total_common_items
            await updateStatCount('total_common_items', 1);
            
            // Refresh component's common items cache to include the newly added item in background
            loadCommonItemsCache().then(newCache => setCommonItemsCacheState(newCache)).catch(err => console.error("Error refreshing cache:", err));
          } catch (commonError) {
            console.warn("Could not add to common items:", commonError);
          }
        }
      }
    } catch (error) {
      console.error("Error categorizing item:", error);
    }
    setCategorizing(false);
  };

  const handleNameChange = (value) => {
    const isOrganic = /\borganic\b/gi.test(value);
    
    setItem({ ...item, name: value, is_organic: isOrganic });
    
    // Show suggestions after 3 characters
    if (value.trim().length >= 3) {
      const normalized = value.toLowerCase().trim().replace(/\borganic\b/gi, '').trim();
      
      const matches = commonItemsCache.filter(ci => 
        ci.name.includes(normalized) || ci.display_name.toLowerCase().includes(normalized)
      ).slice(0, 5); // Limit to 5 suggestions
      
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleNameBlur = async () => {
    // Delay to allow suggestion click to register before blur
    setTimeout(async () => {
      setShowSuggestions(false);
      
      // Only categorize if no match was found via suggestions (or if item name was just typed)
      // and if the category is still 'Other'
      if (item.name.trim().length > 0 && item.category === "Other") {
        const normalized = item.name.toLowerCase().trim().replace(/\borganic\b/gi, '').trim();
        // Check if an exact match exists in cache after typing
        const match = commonItemsCache.find(ci => ci.name === normalized || ci.display_name.toLowerCase() === normalized);
        
        if (!match) { // If no exact match found in cache, then auto-categorize
          await autoCategorizItem(item.name);
        } else { // If exact match found, apply its category and photo
          setItem(prev => ({
            ...prev,
            category: match.category,
            photo_url: match.photo_url || prev.photo_url
          }));
        }
      }
    }, 200); // Small delay
  };

  const handleSuggestionClick = (suggestion) => {
    setItem(prev => ({
      ...prev,
      name: suggestion.display_name,
      category: suggestion.category,
      photo_url: suggestion.photo_url || prev.photo_url
    }));
    setShowSuggestions(false);
    setSuggestions([]);
    setGeneratedImages([]);
    setSelectedGenerated(null);
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleNameChange(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        alert('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Check credits before upload
      const creditCheck = await checkCreditsAvailable('image_upload');
      if (!creditCheck.hasCredits) {
        alert(`Insufficient credits. Need ${creditCheck.creditsNeeded} but only have ${creditCheck.creditsAvailable}. Go to Settings to see your credit balance.`);
        setUploading(false);
        return;
      }

      const { file_url } = await UploadFile({ file });
      
      // Consume credits after successful upload
      const creditResult = await consumeCredits('image_upload', `Uploaded image for "${item.name || 'item'}"`);

      setItem({ ...item, photo_url: file_url });
      setGeneratedImages([]);
      setSelectedGenerated(null);

      if (creditResult.success) {
        // Optionally notify user about credit consumption
        // alert(`Image uploaded! ${creditResult.creditsRemaining} credits remaining.`);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    }
    setUploading(false);
  };

  const handleGenerateImages = async () => {
    if (!item.name.trim()) {
      alert("Please enter an item name first");
      return;
    }

    // Check credits before generation
    const creditCheck = await checkCreditsAvailable('ai_image_generation');
    if (!creditCheck.hasCredits) {
      alert(`Insufficient credits. Need ${creditCheck.creditsNeeded} but only have ${creditCheck.creditsAvailable}. Go to Settings to see your credit balance.`);
      return;
    }

    setGenerating(true);
    setGeneratedImages([]);
    setSelectedGenerated(null);

    try {
      const prompt = `A clean, professional product photo of ${item.name}${item.brand ? ` from ${item.brand}` : ''} on a white background, centered, well-lit, high quality product photography`;
      
      // Generate 2 variants
      const [image1, image2] = await Promise.all([
        GenerateImage({ prompt }),
        GenerateImage({ prompt })
      ]);

      // Consume credits after successful generation
      const creditResult = await consumeCredits('ai_image_generation', `Generated images for "${item.name}"`);

      setGeneratedImages([image1.url, image2.url]);
    } catch (error) {
      console.error("Error generating images:", error);
      alert("Failed to generate images. Please try again.");
    }
    setGenerating(false);
  };

  const handleSelectGenerated = (url) => {
    setSelectedGenerated(url);
    setItem({ ...item, photo_url: "" }); // Clear direct photo_url if a generated one is selected
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { // Corrected from onChangeChange to onOpenChange
      if (!isOpen) {
        resetForm();
      }
      onClose();
    }}>
      <DialogContent 
        className="sm:max-w-md max-h-[90vh] overflow-y-auto !bg-white dark:!bg-slate-900 dark:!border-slate-700"
        style={{ 
          backgroundColor: document.documentElement.classList.contains('theme-dark') ? 'rgb(15 23 42)' : 'white'
        }}
      >
        <DialogHeader>
          <DialogTitle className="!text-slate-800 dark:!text-white">{editItem ? "Edit Item" : "Add New Item"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2 relative">
            <Label htmlFor="name" className="!text-slate-700 dark:!text-white">
              Item Name *
              {loadingCache && (
                <Loader2 className="w-3 h-3 inline-block ml-2 animate-spin text-blue-500 dark:text-blue-400" />
              )}
              {categorizing && (
                <Loader2 className="w-3 h-3 inline-block ml-2 animate-spin text-blue-500 dark:text-blue-400" />
              )}
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="name"
                  placeholder="e.g., Milk, Bread, Apples"
                  value={item.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  maxLength={50}
                  className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600 placeholder:!text-slate-400 dark:placeholder:!text-slate-500"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        // Using onMouseDown to prevent blur event from hiding suggestions immediately
                        onMouseDown={() => handleSuggestionClick(suggestion)} 
                        className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                      >
                        <span className="text-slate-800 dark:text-white">{suggestion.display_name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{suggestion.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={startVoiceInput}
                disabled={isListening}
                className={cn(
                  "shrink-0 !bg-white dark:!bg-slate-700 !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600",
                  isListening && "!bg-red-50 !border-red-300 dark:!bg-red-900/30 dark:!border-red-700"
                )}
              >
                {isListening ? (
                  <Mic className="w-4 h-4 text-red-500 animate-pulse dark:text-red-400" />
                ) : (
                  <Mic className="w-4 h-4 !text-slate-600 dark:!text-slate-300" />
                )}
              </Button>
            </div>
            {isListening && (
              <p className="text-xs text-red-500 animate-pulse dark:text-red-400">Listening... Speak now</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="!text-slate-700 dark:!text-white">Quantity</Label>
              <Input
                id="quantity"
                placeholder="e.g., 2x, 1 lb"
                value={item.quantity}
                onChange={(e) => setItem({ ...item, quantity: e.target.value })}
                maxLength={20}
                className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600 placeholder:!text-slate-400 dark:placeholder:!text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="!text-slate-700 dark:!text-white">
                Category
                {categorizing && (
                  <Loader2 className="w-3 h-3 inline-block ml-2 animate-spin text-blue-500 dark:text-blue-400" />
                )}
              </Label>
              <Select
                value={item.category}
                onValueChange={(value) => setItem({ ...item, category: value })}
              >
                <SelectTrigger className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700">
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="!text-slate-800 dark:!text-white hover:!bg-slate-100 dark:hover:!bg-slate-700">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Organic Checkbox - Compact Version Above Brand */}
          <div className="flex items-center space-x-2 p-2 !bg-green-50 rounded-lg border !border-green-200 dark:!bg-green-900/20 dark:!border-green-700">
            <input
              type="checkbox"
              id="organic"
              checked={item.is_organic}
              onChange={(e) => setItem({ ...item, is_organic: e.target.checked })}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            <Label htmlFor="organic" className="flex items-center gap-2 cursor-pointer text-sm font-medium !text-green-800 dark:!text-white">
              <img 
                src="/icons/organic-badge.png" 
                alt="Organic"
                className="w-8 h-8 object-contain bg-transparent"
                style={{ mixBlendMode: 'multiply' }}
              />
              Organic Item
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand" className="!text-slate-700 dark:!text-white">Brand (Optional)</Label>
            <Input
              id="brand"
              placeholder="e.g., Organic Valley"
              value={item.brand}
              onChange={(e) => setItem({ ...item, brand: e.target.value })}
              maxLength={30}
              className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600 placeholder:!text-slate-400 dark:placeholder:!text-slate-500"
            />
          </div>

          {/* Store Section - REMOVED */}

          <div className="space-y-2">
            <Label htmlFor="notes" className="!text-slate-700 dark:!text-white">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Size, preferences, etc."
              value={item.size_notes}
              onChange={(e) => setItem({ ...item, size_notes: e.target.value })}
              rows={2}
              maxLength={150}
              className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600 placeholder:!text-slate-400 dark:placeholder:!text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="!text-slate-700 dark:!text-white">Photo (Optional)</Label>
            
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2 !bg-slate-100 dark:!bg-slate-700">
                <TabsTrigger value="upload" className="!text-slate-700 dark:!text-slate-300 data-[state=active]:!bg-white dark:data-[state=active]:!bg-slate-600 dark:data-[state=active]:!text-white">Upload</TabsTrigger>
                <TabsTrigger value="ai" className="!text-slate-700 dark:!text-slate-300 data-[state=active]:!bg-white dark:data-[state=active]:!bg-slate-600 dark:data-[state=active]:!text-white">
                  <Sparkles className="w-4 h-4 mr-1" />
                  AI Generate
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-3">
                {item.photo_url ? (
                  <div className="relative">
                    <img
                      src={item.photo_url}
                      alt="Item"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setItem({ ...item, photo_url: "" })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed !border-slate-300 dark:!border-slate-600 rounded-lg cursor-pointer hover:!border-slate-400 dark:hover:!border-slate-500 transition-colors !bg-white dark:!bg-slate-700/50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="w-8 h-8 !text-slate-400 dark:!text-slate-500 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 !text-slate-400 dark:!text-slate-500 mb-2" />
                        <span className="text-sm !text-slate-500 dark:!text-slate-400">Click to upload photo</span>
                      </>
                    )}
                  </label>
                )}
              </TabsContent>
              
              <TabsContent value="ai" className="mt-3">
                <div className="space-y-3">
                  <Button
                    onClick={handleGenerateImages}
                    disabled={generating || !item.name.trim()}
                    className="w-full !bg-white dark:!bg-slate-700 hover:!bg-slate-50 dark:hover:!bg-slate-600 !text-slate-800 dark:!text-white !border !border-slate-300 dark:!border-slate-600"
                    variant="outline"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating 2 variants...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate AI Images
                      </>
                    )}
                  </Button>

                  {generatedImages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm !text-slate-600 dark:!text-slate-400">Select an image:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {generatedImages.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectGenerated(url)}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                              selectedGenerated === url
                                ? "!border-blue-500 ring-2 !ring-blue-200 dark:!ring-blue-700"
                                : "!border-slate-200 dark:!border-slate-600 hover:!border-slate-300 dark:hover:!border-slate-500"
                            }`}
                          >
                            <img
                              src={url}
                              alt={`Generated variant ${idx + 1}`}
                              className="w-full h-32 object-cover"
                            />
                            {selectedGenerated === url && (
                              <div className="absolute top-2 right-2 w-6 h-6 !bg-blue-500 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {generating && (
                    <div className="text-center py-8">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-3" />
                      <p className="text-sm !text-slate-600 dark:!text-slate-400">Creating beautiful images...</p>
                      <p className="text-xs !text-slate-500 dark:!text-slate-500 mt-1">This may take 5-10 seconds</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => {
            resetForm();
            onClose();
          }} className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600 hover:!bg-slate-50 dark:hover:!bg-slate-600">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!item.name.trim()} className="!bg-blue-600 dark:!bg-blue-600 hover:!bg-blue-700 dark:hover:!bg-blue-700 !text-white">
            {editItem ? "Update Item" : "Add Item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}