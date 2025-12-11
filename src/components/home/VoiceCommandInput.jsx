import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import { User, ShoppingList, ListMember, Item, ActivityTracking, CommonItem } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { InvokeLLM, GenerateImage } from "@/api/integrations";
import { Card } from "@/components/ui/card";
import { consumeCredits, checkCreditsAvailable } from "@/components/utils/creditManager";
import { canAddItem } from "@/components/utils/tierManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { incrementUsage } from "@/components/utils/usageSync";
import { appCache } from "@/components/utils/appCache";

const categories = [
  "Produce", "Dairy", "Meat", "Seafood", "Bakery", "Frozen", 
  "Pantry", "Beverages", "Snacks", "Health & Beauty", 
  "Household", "Baby", "Pet", "Other"
];

function capitalizeWords(str) {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export default function VoiceCommandInput({ userLists, onItemAdded }) {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  const findMatchingList = (listNameFromVoice, lists) => {
    const normalized = listNameFromVoice.toLowerCase().trim();
    return lists.find(list => {
      const listNameNormalized = list.name.toLowerCase().trim();
      return listNameNormalized.includes(normalized) || normalized.includes(listNameNormalized);
    });
  };

  function extractQuantityFromName(name) {
    const qtyRegex = /^(\d+(\.\d+)?)\s*x?\s*/i;
    const match = name.match(qtyRegex);
    if (match) {
      return {
        quantity: parseFloat(match[1]),
        name: name.replace(qtyRegex, '').trim()
      };
    }
    return { quantity: 1, name: name.trim() };
  }

  function extractOrganicFlag(name) {
    // Check if "organic" is in the name (case-insensitive)
    // Keep the name as-is, just detect the flag
    const organicRegex = /\borganic\b/i;
    const isOrganic = organicRegex.test(name);
    return { isOrganic, name: name };
  }

  const processVoiceCommand = async (command) => {
    setLastCommand(command);
    setIsProcessing(true);
    setStatus('Understanding your command...');

    try {
      const currentUser = await User.me();

      // Step 1: Parse the command using LLM
      setStatus('Parsing command...');
      const parsePrompt = `Parse this voice command and extract the item name and list name: "${command}". 
      The command format is typically "Add [item] to [list name]" or similar variations.
      Return a JSON with "item_name" and "list_name" fields.`;
      
      const parsed = await InvokeLLM({
        prompt: parsePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            item_name: { type: "string" },
            list_name: { type: "string" }
          },
          required: ["item_name", "list_name"]
        }
      });

      if (!parsed.item_name || !parsed.list_name) {
        setStatus('❌ Could not understand the command. Try: "Add Milk to Costco List"');
        setIsProcessing(false);
        return;
      }

      // Extract quantity and organic flag from item name
      const { name: nameAfterQty, quantity: extractedQty } = extractQuantityFromName(parsed.item_name);
      const { name: cleanItemName, isOrganic } = extractOrganicFlag(nameAfterQty);
      const capitalizedName = capitalizeWords(cleanItemName);
      
      if (isOrganic) {
        console.log(`🌿 Detected organic item: "${capitalizedName}"`);
      }

      // Step 2: Find the matching list
      setStatus(`Looking for "${parsed.list_name}" list...`);
      const matchedList = findMatchingList(parsed.list_name, userLists);
      
      if (!matchedList) {
        setStatus(`❌ List "${parsed.list_name}" not found. Please check the list name.`);
        setIsProcessing(false);
        return;
      }

      // Step 3: Check if item exists in common/master items list FIRST
      setStatus(`Checking common items for "${capitalizedName}"...`);
      let detectedCategory = 'Other';
      let photoUrl = '';
      let foundInCommonItems = false;

      try {
        // Search for the item in common_items (case-insensitive match)
        const allCommonItems = await CommonItem.list();
        const normalizedItemName = capitalizedName.toLowerCase().trim();
        
        // Try exact match first, then partial match
        let matchedCommonItem = allCommonItems.find(
          ci => ci.name?.toLowerCase().trim() === normalizedItemName ||
                ci.display_name?.toLowerCase().trim() === normalizedItemName
        );
        
        // If no exact match, try partial match
        if (!matchedCommonItem) {
          matchedCommonItem = allCommonItems.find(
            ci => ci.name?.toLowerCase().includes(normalizedItemName) ||
                  ci.display_name?.toLowerCase().includes(normalizedItemName) ||
                  normalizedItemName.includes(ci.name?.toLowerCase()) ||
                  normalizedItemName.includes(ci.display_name?.toLowerCase())
          );
        }

        if (matchedCommonItem) {
          console.log(`✅ Found "${capitalizedName}" in common items:`, matchedCommonItem);
          foundInCommonItems = true;
          detectedCategory = matchedCommonItem.category || 'Other';
          photoUrl = matchedCommonItem.photo_url || '';
          setStatus(`✅ Found "${capitalizedName}" in common items! Using existing data.`);
        }
      } catch (error) {
        console.warn("Error checking common items:", error);
        // Continue with AI categorization if common items check fails
      }

      // Only consume credits and use AI if item NOT found in common items
      if (!foundInCommonItems) {
        // Consume credits BEFORE doing expensive operations
        setStatus('Consuming credits...');
        const creditResult = await consumeCredits(
          'voice_command',
          `Voice command: Add "${capitalizedName}" to "${matchedList.name}"`,
          { item_name: capitalizedName, list_name: matchedList.name }
        );

        if (!creditResult.success) {
          setStatus(`❌ ${creditResult.message}`);
          setIsProcessing(false);
          return;
        }

        // Auto-categorize the item using AI
        setStatus(`Categorizing "${capitalizedName}"...`);
        try {
          const categoryResponse = await InvokeLLM({
            prompt: `Given this grocery/household item: "${capitalizedName}", classify it into one of these categories: ${categories.join(", ")}. Return ONLY the category name.`,
            response_json_schema: {
              type: "object",
              properties: {
                category: { type: "string", enum: categories }
              }
            }
          });
          if (categoryResponse.category) {
            detectedCategory = categoryResponse.category;
          }
        } catch (error) {
          console.warn("Could not categorize:", error);
        }

        // Generate AI image (with better error handling)
        setStatus(`Generating image for "${capitalizedName}" (may take 10-15 seconds)...`);
        try {
          const imagePrompt = `A clean, professional product photo of ${capitalizedName} on a white background, centered, well-lit, high quality product photography`;
          const imageResult = await GenerateImage({ prompt: imagePrompt });
          if (imageResult.url) {
            photoUrl = imageResult.url;
          }
        } catch (error) {
          console.warn("Image generation failed, continuing without image:", error);
          // Continue without image - don't fail the entire operation
        }
      }

      // Step 5: Add item to the list
      setStatus(`Adding "${capitalizedName}" to "${matchedList.name}"...`);
      await Item.create({
        list_id: matchedList.id,
        name: capitalizedName,
        quantity: extractedQty > 1 ? `${extractedQty}x` : '',
        category: detectedCategory,
        photo_url: photoUrl,
        added_by: currentUser.email,
        is_organic: isOrganic,
      });

      // Update user usage count
      await incrementUsage('current_total_items');

      // Update statistics - atomic increment total_items
      await updateStatCount('total_items', 1);

      // Clear the cache for this specific list
      appCache.clearShoppingList(matchedList.id);
      
      const organicLabel = isOrganic ? ' 🌿 (Organic)' : '';
      if (foundInCommonItems) {
        setStatus(`✅ Added "${capitalizedName}"${organicLabel}! (No credits used - found in common items)`);
      } else {
        // Get current credits for display
        try {
          const currentUser = await User.me();
          const remaining = (currentUser.monthly_credits_total || 0) - (currentUser.credits_used_this_month || 0);
          setStatus(`✅ Added "${capitalizedName}"${organicLabel}! ${remaining} credits remaining.`);
        } catch {
          setStatus(`✅ Added "${capitalizedName}"${organicLabel}!`);
        }
      }
      
      // Navigate to the list view after a brief delay
      setTimeout(() => {
        navigate(createPageUrl(`ListView?listId=${matchedList.id}`));
      }, 1500);

    } catch (error) {
      console.error("Error processing voice command:", error);
      console.error("Error details:", error.message, error.stack);
      setStatus(`❌ Failed: ${error.message || 'Please try again.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceCommand = async () => {
    // Check item limit FIRST
    try {
      const itemCheck = await canAddItem();
      if (!itemCheck.canAdd) {
        setUpgradeMessage(itemCheck.message);
        setShowUpgradePrompt(true);
        return;
      }
    } catch (error) {
      console.error("Error checking item limit:", error);
      setStatus('❌ Failed to check item limit. Please try again.');
      setTimeout(() => setStatus(''), 3000);
      return;
    }

    // Check credits BEFORE starting speech recognition
    try {
      const creditCheck = await checkCreditsAvailable('voice_command');
      if (!creditCheck.hasCredits) {
        setStatus(`❌ Insufficient credits. Need ${creditCheck.creditsNeeded} but only have ${creditCheck.creditsAvailable}.`);
        setTimeout(() => setStatus(''), 5000);
        return;
      }
    } catch (error) {
      console.error("Error checking credits:", error);
      setStatus('❌ Failed to check credits. Please try again.');
      setTimeout(() => setStatus(''), 3000);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('🎤 Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      processVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setStatus('❌ Could not hear you. Please try again.');
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <>
      <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 dark:bg-gradient-to-r dark:from-purple-50 dark:to-pink-50 dark:border-purple-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold !text-black mb-1">🎤 Voice Command</h3>
            <p className="text-xs !text-slate-800">
              {status || 'Say: "Add [item] to [list name]"'}
            </p>
            <p className="text-xs !text-purple-700 mt-1">
              e.g., Add Milk to Costco
            </p>
            {lastCommand && (
              <p className="text-xs !text-purple-700 mt-1">
                Last: "{lastCommand}"
              </p>
            )}
          </div>
          <Button
            onClick={startVoiceCommand}
            disabled={isListening || isProcessing}
            className={cn(
              "gap-2 min-w-[120px]",
              isListening ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700"
            )}
          >
            {isListening ? (
              <>
                <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
                Listening...
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Voice
              </>
            )}
          </Button>
        </div>
      </Card>

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title="Item Limit Reached"
        message={upgradeMessage}
        featureName="Additional Items"
      />
    </>
  );
}