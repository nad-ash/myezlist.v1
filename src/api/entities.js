/**
 * Entity Exports
 * 
 * This file exports all database entities with automatic provider switching.
 * Based on BACKEND_PROVIDER config, entities use either Base44 or Supabase.
 */

import { AUTH_PROVIDER, BACKEND_PROVIDER } from './config';
import { base44 } from './base44Client';
import { supabaseAuth, UserEntity } from './supabaseClient';
import * as SupabaseEntities from './supabaseEntities';

// ==========================================
// ENTITY EXPORTS
// Automatically switches between Base44 and Supabase based on BACKEND_PROVIDER
// ==========================================

// Helper to get entity from the correct provider
const getEntity = (entityName, supabaseEntity) => {
  if (BACKEND_PROVIDER === 'supabase') {
    return supabaseEntity;
  }
  // Base44 provider
  return base44.entities[entityName];
};

// Core Shopping Entities
export const ShoppingList = getEntity('ShoppingList', SupabaseEntities.ShoppingList);
export const Item = getEntity('Item', SupabaseEntities.Item);
export const ListMember = getEntity('ListMember', SupabaseEntities.ListMember);
export const ShareLink = getEntity('ShareLink', SupabaseEntities.ShareLink);
export const CommonItem = getEntity('CommonItem', SupabaseEntities.CommonItem);

// Task Management
export const Todo = getEntity('Todo', SupabaseEntities.Todo);

// Recipe System
export const Recipe = getEntity('Recipe', SupabaseEntities.Recipe);
export const RecipeFavorite = getEntity('RecipeFavorite', SupabaseEntities.RecipeFavorite);

// Analytics & Tracking
export const Statistics = getEntity('Statistics', SupabaseEntities.Statistics);
export const ActivityTracking = getEntity('ActivityTracking', SupabaseEntities.ActivityTracking);

// Subscription & Premium Features
export const SubscriptionTier = getEntity('SubscriptionTier', SupabaseEntities.SubscriptionTier);
export const PremiumFeature = getEntity('PremiumFeature', SupabaseEntities.PremiumFeature);
export const CreditTransaction = getEntity('CreditTransaction', SupabaseEntities.CreditTransaction);

// ==========================================
// AUTH EXPORTS
// ==========================================

// User auth object - provides me(), logout(), redirectToLogin(), updateMe()
export const User = AUTH_PROVIDER === 'supabase' ? supabaseAuth : base44.auth;

// UserAdmin for admin operations (filtering users, etc.)
export const UserAdmin = BACKEND_PROVIDER === 'supabase' 
  ? SupabaseEntities.UserAdmin 
  : base44.entities.User;

// Re-export config for convenience
export { AUTH_PROVIDER, BACKEND_PROVIDER };
