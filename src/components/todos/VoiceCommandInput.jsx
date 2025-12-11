import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Loader2 } from "lucide-react";
import { User, Todo, Statistics, ActivityTracking } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { cn } from "@/lib/utils";
import { consumeCredits, checkCreditsAvailable } from "@/components/utils/creditManager";

// Helper function to capitalize first letter of each word
const capitalizeWords = (str) => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function VoiceCommandInput({ onTaskAdded }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [lastCommand, setLastCommand] = useState("");

  const handleVoiceInput = async () => {
    // Check credits BEFORE starting speech recognition
    try {
      const creditCheck = await checkCreditsAvailable('voice_command');
      if (!creditCheck.hasCredits) {
        setStatusMessage(`❌ Insufficient credits. Need ${creditCheck.creditsNeeded} but only have ${creditCheck.creditsAvailable}.`);
        setTimeout(() => setStatusMessage(''), 5000);
        return;
      }
    } catch (error) {
      console.error("Error checking credits:", error);
      setStatusMessage('❌ Failed to check credits. Please try again.');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage("Listening...");
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setLastCommand(transcript);
      setIsListening(false);
      setIsProcessing(true);
      setStatusMessage("Processing your command...");

      try {
        // Consume credits BEFORE doing expensive operations
        const creditResult = await consumeCredits('voice_command', `Voice command: Create task from "${transcript}"`);

        if (!creditResult.success) {
          setStatusMessage(`❌ ${creditResult.message}`);
          setIsProcessing(false);
          setTimeout(() => setStatusMessage(''), 5000);
          return;
        }

        // Get current date and time from browser
        const now = new Date();
        const currentDateTime = now.toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          timeZoneName: 'short'
        });
        
        // Use LLM to parse the voice command
        const result = await InvokeLLM({
          prompt: `CURRENT DATETIME: ${currentDateTime}

Parse this task command and extract task details. Use the current datetime above as reference for calculating any relative dates (e.g., "tomorrow", "next week", "Monday").

Return ONLY a JSON object with these fields:
          - title: the task title (required)
          - due_date: date in YYYY-MM-DD format if mentioned (optional)
          - due_time: time in HH:MM format if mentioned (optional)
          - priority: "low", "medium", or "high" based on urgency (default: medium)
          - category: one of "home", "work", "personal", "errands", "family", "health", "finance", "other" (default: personal)
          - description: any additional details (optional)
          
          Command: "${transcript}"
          
          If no specific details are mentioned, use intelligent defaults.`,
          response_json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              due_date: { type: "string" },
              due_time: { type: "string" },
              priority: { type: "string" },
              category: { type: "string" },
              description: { type: "string" }
            },
            required: ["title"]
          }
        });

        // Clean up the task data
        const taskData = {
          title: capitalizeWords(result.title),
          status: "pending",
          priority: result.priority || "medium",
          category: result.category || "personal",
          description: result.description || "",
          due_date: result.due_date || null,
          due_time: result.due_time || null,
        };

        // Call the parent callback to create the task
        await onTaskAdded(taskData);

        setStatusMessage(`✅ Task added! ${creditResult.remainingCredits} credits remaining.`);
        setTimeout(() => {
          setStatusMessage("");
          setLastCommand("");
        }, 3000);
      } catch (error) {
        console.error("Error processing voice command:", error);
        setStatusMessage("Failed to process command. Please try again.");
        setTimeout(() => setStatusMessage(""), 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setIsProcessing(false);
      
      if (event.error === 'no-speech') {
        setStatusMessage("No speech detected. Please try again.");
      } else if (event.error === 'not-allowed') {
        setStatusMessage("Microphone access denied. Please enable it in your browser settings.");
      } else {
        setStatusMessage("Voice recognition error. Please try again.");
      }
      
      setTimeout(() => setStatusMessage(""), 3000);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-rose-900/20 border-2 border-purple-200 dark:border-purple-700">
      <CardContent className="p-3 sm:p-4">
        {/* Mobile: Single Row Layout */}
        <div className="flex items-center gap-3">
          {/* Text Content - Takes remaining space */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                Voice Command
              </h3>
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300 line-clamp-1">
              Tap to add task by voice
            </p>
            
            {/* Status Messages */}
            {(statusMessage || lastCommand) && (
              <div className="mt-2 space-y-1">
                {statusMessage && (
                  <p className={cn(
                    "text-xs font-medium",
                    statusMessage.includes("✓") ? "text-green-700 dark:text-green-400" : "text-purple-700 dark:text-purple-300"
                  )}>
                    {statusMessage}
                  </p>
                )}
                {lastCommand && !isProcessing && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-1">
                    "{lastCommand}"
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Voice Button - Fixed Width */}
          <Button
            onClick={handleVoiceInput}
            disabled={isListening || isProcessing}
            size="lg"
            className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-full flex-shrink-0 transition-all",
              isListening 
                ? "bg-gradient-to-r from-red-500 to-rose-600 animate-pulse shadow-lg shadow-red-500/50" 
                : isProcessing
                ? "bg-gradient-to-r from-purple-400 to-pink-400"
                : "bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 shadow-lg hover:shadow-xl"
            )}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin text-white" />
            ) : (
              <Mic className={cn(
                "w-6 h-6 sm:w-7 sm:h-7 text-white",
                isListening && "animate-pulse"
              )} />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}