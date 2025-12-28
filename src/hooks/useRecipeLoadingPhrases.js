import { useState, useEffect, useCallback } from 'react';

// Fun loading phrases organized by generation stage
const LOADING_PHRASES = {
  recipe: [
    "🧑‍🍳 Consulting with our virtual chef...",
    "📖 Flipping through grandma's secret cookbook...",
    "🌶️ Adding a pinch of culinary magic...",
    "🥄 Measuring out the perfect ingredients...",
    "✨ Sprinkling some AI fairy dust...",
    "🍳 Preheating the creativity oven...",
    "🌿 Gathering fresh inspiration...",
    "📝 Writing down the secret sauce...",
    "🔮 Predicting the perfect flavors...",
    "👨‍🍳 Training under a Michelin star chef...",
    "🍽️ Setting the table for deliciousness...",
    "🎨 Crafting a culinary masterpiece...",
    "🧪 Mixing science with flavor...",
    "🌍 Traveling the world for inspiration...",
    "💭 Dreaming up something delicious...",
    "🎯 Perfecting the recipe balance...",
    "🔥 Turning up the heat on creativity...",
    "📚 Studying ancient cooking techniques...",
  ],
  image: [
    "📸 Styling the perfect food shot...",
    "🎨 Painting with pixels and flavors...",
    "✨ Making your dish Instagram-worthy...",
    "🖼️ Creating food art...",
    "💫 Capturing culinary beauty...",
    "📷 Adjusting the lighting just right...",
    "🍽️ Plating like a pro photographer...",
    "🌟 Adding that golden hour glow...",
    "🎬 Directing the perfect food scene...",
    "🖌️ Brushing on some visual magic...",
  ],
  saving: [
    "💾 Saving your culinary creation...",
    "📥 Adding to your recipe collection...",
    "🗃️ Filing away deliciousness...",
    "✅ Almost ready to cook...",
    "🎉 Preparing your recipe card...",
  ],
  ingredients: [
    "🥕 Reading through your ingredient list...",
    "🔍 Identifying each ingredient...",
    "📋 Organizing your shopping items...",
    "🏪 Sorting by grocery aisle...",
    "🧠 Our AI is learning your ingredients...",
    "✂️ Separating quantities from items...",
    "🏷️ Categorizing for easy shopping...",
    "🛒 Preparing your shopping cart...",
    "📊 Analyzing ingredient categories...",
    "🌽 Fresh produce? Dairy? We're figuring it out...",
    "🧮 Counting and measuring ingredients...",
    "🎯 Finding the perfect category match...",
    "💡 Making your grocery run easier...",
    "📱 Almost ready for your list...",
    "🛍️ Getting everything organized...",
    "🤖 AI magic in progress...",
    "⏳ Good things take a little time...",
    "🌟 Creating your perfect shopping list...",
  ]
};

/**
 * Hook that provides rotating loading phrases during recipe generation
 * @param {boolean} isGenerating - Whether generation is in progress
 * @param {string} stage - Current stage: 'recipe', 'image', or 'saving'
 * @param {number} intervalMs - How often to rotate phrases (default: 2500ms)
 * @returns {string} Current loading phrase
 */
export function useRecipeLoadingPhrases(isGenerating, stage = 'recipe', intervalMs = 2500) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [currentStage, setCurrentStage] = useState(stage);

  // Reset index when stage changes
  useEffect(() => {
    if (stage !== currentStage) {
      setPhraseIndex(0);
      setCurrentStage(stage);
    }
  }, [stage, currentStage]);

  // Rotate phrases when generating
  useEffect(() => {
    if (!isGenerating) {
      setPhraseIndex(0);
      return;
    }

    const phrases = LOADING_PHRASES[stage] || LOADING_PHRASES.recipe;
    
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isGenerating, stage, intervalMs]);

  const phrases = LOADING_PHRASES[stage] || LOADING_PHRASES.recipe;
  // Use modulo to ensure index is always valid, even before effect resets it on stage change
  const safeIndex = phraseIndex % phrases.length;
  return isGenerating ? phrases[safeIndex] : '';
}

/**
 * Get a random phrase for a specific stage (useful for one-time display)
 */
export function getRandomPhrase(stage = 'recipe') {
  const phrases = LOADING_PHRASES[stage] || LOADING_PHRASES.recipe;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * All phrases exported for potential customization
 */
export { LOADING_PHRASES };

