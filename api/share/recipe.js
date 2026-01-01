import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Social media crawler User-Agent patterns
const CRAWLER_PATTERNS = [
  'facebookexternalhit',   // Facebook
  'Facebot',               // Facebook
  'WhatsApp',              // WhatsApp
  'Twitterbot',            // Twitter/X
  'LinkedInBot',           // LinkedIn
  'Slackbot',              // Slack
  'Discordbot',            // Discord
  'TelegramBot',           // Telegram
  'Pinterest',             // Pinterest
  'Googlebot',             // Google (for SEO)
  'bingbot',               // Bing
];

// Check if request is from a social media crawler
function isCrawler(userAgent) {
  if (!userAgent) return false;
  return CRAWLER_PATTERNS.some(pattern => 
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escape string for safe insertion into JavaScript string literals inside <script> tags
// Prevents XSS via: </script> tag injection, backslash escaping, quote escaping, newlines
function escapeJsString(text) {
  if (!text) return '';
  return text
    // Escape backslashes first (must be before other escapes that use backslash)
    .replace(/\\/g, '\\\\')
    // Escape double quotes
    .replace(/"/g, '\\"')
    // Escape single quotes (for safety)
    .replace(/'/g, "\\'")
    // Escape newlines and carriage returns
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    // Escape </script> - break up the closing tag to prevent premature script termination
    // Uses Unicode escape for the forward slash
    .replace(/<\//g, '<\\/')
    // Escape JavaScript line terminators (U+2028 and U+2029)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export default async function handler(req, res) {
  const { id, from } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  
  // Base URL for the app
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://myezlist.com';
  
  // Full recipe URL in the SPA
  const recipeUrl = `${baseUrl}/RecipeDetail?id=${id}${from ? `&from=${from}` : ''}`;
  
  // If not a crawler, redirect to the SPA immediately
  if (!isCrawler(userAgent)) {
    return res.redirect(302, recipeUrl);
  }
  
  // For crawlers, fetch recipe data and return HTML with OG tags
  try {
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('id, full_title, photo_url, cooking_time, servings, cuisine, calories_per_serving')
      .eq('id', id)
      .single();
    
    if (error || !recipe) {
      // Recipe not found - redirect to app anyway (will show 404 there)
      return res.redirect(302, recipeUrl);
    }
    
    // Build description from recipe details
    const details = [];
    if (recipe.cooking_time) details.push(`⏱️ ${recipe.cooking_time}`);
    if (recipe.servings) details.push(`🍽️ ${recipe.servings} servings`);
    if (recipe.cuisine) details.push(`🌍 ${recipe.cuisine}`);
    if (recipe.calories_per_serving) details.push(`🔥 ${recipe.calories_per_serving}`);
    
    const description = details.length > 0 
      ? `${details.join(' | ')} - Check out this delicious recipe on MyEZList!`
      : 'Check out this delicious recipe on MyEZList!';
    
    // Default image fallback
    const imageUrl = recipe.photo_url || `${baseUrl}/icons/MyEZList_512.png`;
    
    // Generate HTML with Open Graph meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Basic Meta -->
  <title>${escapeHtml(recipe.full_title)} | MyEZList Recipe</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="MyEZList">
  <meta property="og:title" content="${escapeHtml(recipe.full_title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(recipeUrl)}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(recipe.full_title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  
  <!-- Redirect users to SPA (crawlers don't execute JS) -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(recipeUrl)}">
  
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f97316, #ef4444);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 400px;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    p {
      opacity: 0.9;
    }
    a {
      color: white;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(recipe.full_title)}</h1>
    <p>Redirecting to MyEZList...</p>
    <p><a href="${escapeHtml(recipeUrl)}">Click here if not redirected</a></p>
  </div>
  <script>
    window.location.href = "${escapeJsString(recipeUrl)}";
  </script>
</body>
</html>`;
    
    // Set caching headers (cache for 1 hour at edge)
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('Error fetching recipe for social share:', error);
    // On error, just redirect to the app
    return res.redirect(302, recipeUrl);
  }
}

