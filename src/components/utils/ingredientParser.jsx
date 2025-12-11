// -----------------------------
// ingredient-parser.js

// --- Helpers & Dictionaries --------------------------------------------------
const UNICODE_FRACTIONS = {
  '¼': 1/4, '½': 1/2, '¾': 3/4, '⅓': 1/3, '⅔': 2/3,
  '⅛': 1/8, '⅜': 3/8, '⅝': 5/8, '⅞': 7/8
};

const NUM_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  dozen: 12, half: 0.5, quarter: 0.25
};

const VAGUE_PHRASES = [
  'a pinch','pinch','to taste','as needed','few','some','several','handful','dash','sprinkle'
];

const PREPOSITIONS = [
  'in','with','on','for','from','into','to','of','by','at','over','under','up','without'
];

const DESCRIPTORS = [
  'chopped','sliced','minced','peeled','grated','crushed','ground','drained',
  'fresh','frozen','boiled','melted','shredded','softened'
];

const UNIT_SYNONYMS = {
  tsp: ['teaspoon','teaspoons','tsp','t'],
  tbsp: ['tablespoon','tablespoons','tbsp','T'],
  cup: ['cup','cups'],
  pint: ['pint','pints','pt'],
  quart: ['quart','quarts','qt'],
  gallon: ['gallon','gallons','gal'],
  milliliter: ['milliliter','milliliters','ml'],
  liter: ['liter','liters','l'],
  ounce: ['ounce','ounces','oz'],
  lb: ['pound','pounds','lb','lbs'],
  g: ['gram','grams','g'],
  kg: ['kilogram','kilograms','kg'],
  can: ['can','cans'],
  jar: ['jar','jars'],
  bottle: ['bottle','bottles'],
  package: ['package','packages','pkg'],
  box: ['box','boxes'],
  bag: ['bag','bags'],
  carton: ['carton','cartons'],
  sheet: ['sheet','sheets'],
  inch: ['inch','inches','in']
};

const UNIT_LOOKUP = (() => {
  const map = new Map();
  for (const [norm, arr] of Object.entries(UNIT_SYNONYMS)) {
    arr.forEach(a => map.set(a.toLowerCase(), norm));
  }
  return map;
})();

const normalizeSpaces = s => s.replace(/\s+/g, ' ').trim();

function unicodeFracsToAscii(s) {
  return s.replace(
    new RegExp(`[${Object.keys(UNICODE_FRACTIONS).join('')}]`, 'g'),
    ch => ` ${UNICODE_FRACTIONS[ch]}`
  );
}

function wordNumberToFloat(token) {
  const t = token.toLowerCase();
  return NUM_WORDS[t] ?? null;
}

function parseMixedNumber(str) {
  const parts = str.trim().split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (/^\d+\/\d+$/.test(p)) {
      const [a,b] = p.split('/').map(Number);
      if (b) total += a/b;
    } else if (/^\d+(?:\.\d+)?$/.test(p)) {
      total += parseFloat(p);
    } else {
      const w = wordNumberToFloat(p);
      if (w != null) total += w;
    }
  }
  return total || null;
}

function extractRange(numStr) {
  const m = numStr.match(/(.+?)\s*(?:-|–|to)\s*(.+)/i);
  if (!m) return null;
  const a = parseMixedNumber(m[1]);
  const b = parseMixedNumber(m[2]);
  return (a != null && b != null) ? `${a}-${b}` : null;
}

function matchUnitToken(token) {
  const t = token.toLowerCase().replace(/[.,)]$/,'');
  return UNIT_LOOKUP.get(t) || null;
}

function stripListPrefix(s) {
  // removes bullets/numbering like "- ", "• ", "1) ", "1. "
  return s.replace(/^\s*([-*•]\s+|\d+[\.\)]\s+)/, '');
}

function cleanItemName(itemName) {
  // Remove descriptors and prepositions to get cleaner item names
  let cleaned = itemName;
  
  // Build regex patterns for descriptors and prepositions
  const descriptorPattern = new RegExp(`\\b(${DESCRIPTORS.join('|')})\\b`, 'gi');
  const prepPattern = new RegExp(`\\b(${PREPOSITIONS.join('|')})\\b`, 'gi');
  
  // Remove descriptors
  cleaned = cleaned.replace(descriptorPattern, '').trim();
  
  // Remove prepositions (but keep the first word if it would leave nothing)
  const words = cleaned.split(/\s+/);
  const filteredWords = words.filter((word, idx) => {
    const isPrep = PREPOSITIONS.includes(word.toLowerCase());
    // Keep first word even if it's a preposition, remove others
    return idx === 0 || !isPrep;
  });
  
  cleaned = filteredWords.join(' ').trim();
  
  // Clean up multiple spaces and normalize
  cleaned = normalizeSpaces(cleaned);
  
  // Remove trailing commas and other punctuation
  cleaned = cleaned.replace(/[,;]+$/g, '').trim();
  
  return cleaned || itemName; // Return original if cleaning resulted in empty string
}

// --- Single-line parser ------------------------------------------------------
export function parseIngredient(line) {
  if (!line) return { quantity: '', item: '' };

  let working = normalizeSpaces(unicodeFracsToAscii(stripListPrefix(line)));

  // Filter out water - check if line starts with water (more robust)
  if (/^water\b/i.test(working.trim())) {
    return { quantity: '', item: '' };
  }

  // Ignore vague-only quantities at start
  for (const phrase of VAGUE_PHRASES) {
    const re = new RegExp(`^${phrase}\\b`, 'i');
    if (re.test(working)) {
      working = working.replace(re, '').replace(/^of\s+/i, '').trim();
      // Check again if it starts with water after removing vague phrase
      if (/^water\b/i.test(working.trim())) {
        return { quantity: '', item: '' };
      }
      return { quantity: '', item: cleanItemName(working) };
    }
  }

  // Quantity: try range first, then single/mixed numbers (incl. words), then number+unit combo (e.g., "400g", "2kg")
  let qty = '';
  const qtyCandidate = working.split(' ').slice(0, 3).join(' ');
  const rng = extractRange(qtyCandidate);
  if (rng) {
    qty = rng;
    working = working.replace(/^.+?(?:-|–|to)\s*.+?\b\s*/, '');
  } else {
    // Try to match number+unit combo like "400g", "2kg", "500ml" etc.
    const numUnitMatch = working.match(/^([~≈]?\d+(?:\.\d+)?)(g|kg|ml|l|oz|lb|lbs|inch|inches|in)\b/i);
    if (numUnitMatch) {
      const num = numUnitMatch[1];
      const unit = numUnitMatch[2].toLowerCase();
      const normalizedUnit = UNIT_LOOKUP.get(unit) || unit;
      qty = `${num} ${normalizedUnit}`;
      working = working.slice(numUnitMatch[0].length).trim();
    } else {
      // Original pattern: fractions, decimals, or word numbers
      const singleMatch = working.match(
        /^([~≈]?\d+\/\d+|[~≈]?[\d.]+(?:\s+\d+\/\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|half|quarter)\b/i
      );
      if (singleMatch) {
        qty = singleMatch[1];
        working = working.slice(singleMatch[0].length).trim();
      }
    }
  }

  // Unit (optional) - only check if we haven't already captured a unit in the number+unit combo
  let unit = '';
  if (qty && !qty.includes(' ')) {
    const [first, ...rest] = working.split(' ');
    const maybeUnit = matchUnitToken(first || '');
    if (maybeUnit) {
      unit = maybeUnit;
      working = rest.join(' ');
    }
  }

  // Combine and clean
  const quantity = [qty, unit].filter(Boolean).join(' ').trim();
  working = working.replace(/^of\s+/i, '').trim();

  // Final check: if the item starts with water, return empty (catches "water as needed", "water for cooking", etc.)
  if (/^water\b/i.test(working.trim())) {
    return { quantity: '', item: '' };
  }

  // Clean the item name by removing descriptors and prepositions
  const cleanedItem = cleanItemName(working);

  return { quantity, item: cleanedItem };
}

// --- Batch parser ------------------------------------------------------------
export function parseIngredients(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map(s => (typeof s === 'string' ? s : ''))
    .map(parseIngredient)
    .filter(row => row.item); // keep only non-empty items (filters out water and empty strings)
}