import { CommonItem } from "@/api/entities";

const CACHE_KEY = 'familycart_common_items_cache';
const CACHE_DURATION_KEY = 'familycart_cache_duration';
const DEFAULT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export const getCacheDuration = () => {
  try {
    const duration = localStorage.getItem(CACHE_DURATION_KEY);
    return duration ? parseInt(duration) : DEFAULT_CACHE_DURATION;
  } catch (error) {
    return DEFAULT_CACHE_DURATION;
  }
};

export const setCacheDuration = (minutes) => {
  try {
    const duration = minutes * 60 * 1000; // Convert minutes to milliseconds
    localStorage.setItem(CACHE_DURATION_KEY, duration.toString());
    return duration;
  } catch (error) {
    console.error("Error setting cache duration:", error);
    return DEFAULT_CACHE_DURATION;
  }
};

export const getCommonItemsCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    const cacheDuration = getCacheDuration();
    
    if (now - timestamp > cacheDuration) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
};

export const setCommonItemsCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error("Error setting cache:", error);
  }
};

export const clearCommonItemsCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
};

export const loadCommonItemsCache = async () => {
  // Check if cache exists and is valid
  const cached = getCommonItemsCache();
  if (cached) {
    return cached;
  }

  // Load from database - fetch only what we need
  try {
    const items = await CommonItem.list('-usage_count', 500);
    
    // Extract only the fields we need to minimize cache size
    const cacheData = items.map(item => ({
      name: item.name,
      display_name: item.display_name,
      category: item.category,
      photo_url: item.photo_url,
      usage_count: item.usage_count
    }));
    
    setCommonItemsCache(cacheData);
    return cacheData;
  } catch (error) {
    console.error("Error loading common items:", error);
    return [];
  }
};