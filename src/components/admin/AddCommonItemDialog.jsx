
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Upload, X, Check } from "lucide-react";
import { GenerateImage, UploadFile } from "@/api/integrations";

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

export default function AddCommonItemDialog({ open, onClose, onSave, editItem = null }) {
  const [item, setItem] = useState({
    name: "",
    display_name: "",
    category: "Other",
    photo_url: "",
  });
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedGenerated, setSelectedGenerated] = useState(null);

  useEffect(() => {
    if (editItem) {
      setItem({
        name: editItem.name || "",
        display_name: editItem.display_name || "",
        category: editItem.category || "Other",
        photo_url: editItem.photo_url || "",
      });
    } else {
      resetForm();
    }
  }, [editItem, open]);

  const handleSave = () => {
    if (item.display_name.trim()) {
      const normalized = item.display_name.toLowerCase().trim().replace(/\borganic\b/gi, '').trim();
      onSave({
        name: normalized,
        display_name: capitalizeWords(item.display_name.trim()),
        category: item.category,
        photo_url: selectedGenerated || item.photo_url,
        usage_count: editItem?.usage_count || 0,
      });
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setItem({
      name: "",
      display_name: "",
      category: "Other",
      photo_url: "",
    });
    setGeneratedImages([]);
    setSelectedGenerated(null);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setItem({ ...item, photo_url: file_url });
      setGeneratedImages([]);
      setSelectedGenerated(null);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    }
    setUploading(false);
  };

  const handleGenerateImages = async () => {
    if (!item.display_name.trim()) {
      alert("Please enter an item name first");
      return;
    }

    setGenerating(true);
    setGeneratedImages([]);
    setSelectedGenerated(null);

    try {
      const prompt = `A clean, professional product photo of ${item.display_name} on a white background, centered, well-lit, high quality product photography`;
      
      // Generate 2 variants
      const [image1, image2] = await Promise.all([
        GenerateImage({ prompt }),
        GenerateImage({ prompt })
      ]);

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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Master Item" : "Add Master Item"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="display_name" className="!text-slate-800 dark:!text-white">Item Name *</Label>
            <Input
              id="display_name"
              placeholder="e.g., Milk, Bread, Apples"
              value={item.display_name}
              onChange={(e) => setItem({ ...item, display_name: e.target.value })}
              className="!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-white !border-slate-300 dark:!border-slate-600 placeholder:!text-slate-400 dark:placeholder:!text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="!text-slate-800 dark:!text-white">Category</Label>
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

          <div className="space-y-2">
            <Label className="!text-slate-800 dark:!text-white">Image</Label>
            
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
                      alt={item.display_name}
                      className="w-full max-h-64 object-contain rounded-lg bg-slate-50 dark:bg-slate-800"
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
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors bg-white dark:bg-slate-800/50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
                        <span className="text-sm text-slate-500 dark:text-slate-400">Click to upload photo</span>
                      </>
                    )}
                  </label>
                )}
              </TabsContent>
              
              <TabsContent value="ai" className="mt-3">
                <div className="space-y-3">
                  <Button
                    onClick={handleGenerateImages}
                    disabled={generating || !item.display_name.trim()}
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
                      <p className="text-sm text-slate-600 dark:text-slate-400">Select an image:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {generatedImages.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectGenerated(url)}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                              selectedGenerated === url
                                ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-700"
                                : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                            }`}
                          >
                            <img
                              src={url}
                              alt={`Generated variant ${idx + 1}`}
                              className="w-full h-32 object-contain bg-slate-50 dark:bg-slate-800"
                            />
                            {selectedGenerated === url && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
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
                      <p className="text-sm text-slate-600 dark:text-slate-400">Creating beautiful images...</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">This may take 5-10 seconds</p>
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
          <Button onClick={handleSave} disabled={!item.display_name.trim()} className="!bg-blue-600 dark:!bg-blue-600 hover:!bg-blue-700 dark:hover:!bg-blue-700 !text-white">
            {editItem ? "Update" : "Add"} Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
