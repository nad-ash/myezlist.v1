/**
 * Entity Exports
 * 
 * This file exports all database entities using Supabase as the backend.
 */

import { supabaseAuth } from './supabaseClient';
import * as SupabaseEntities from './supabaseEntities';

// ==========================================
// ENTITY EXPORTS
// ==========================================

// Core Shopping Entities
export const ShoppingList = SupabaseEntities.ShoppingList;
export const Item = SupabaseEntities.Item;
export const ListMember = SupabaseEntities.ListMember;
export const ShareLink = SupabaseEntities.ShareLink;
export const CommonItem = SupabaseEntities.CommonItem;

// Task Management
export const Todo = SupabaseEntities.Todo;

// Recipe System
export const Recipe = SupabaseEntities.Recipe;
export const RecipeFavorite = SupabaseEntities.RecipeFavorite;

// Analytics & Tracking
export const Statistics = SupabaseEntities.Statistics;
export const ActivityTracking = SupabaseEntities.ActivityTracking;

// Subscription & Premium Features
export const SubscriptionTier = SupabaseEntities.SubscriptionTier;
export const PremiumFeature = SupabaseEntities.PremiumFeature;
export const CreditTransaction = SupabaseEntities.CreditTransaction;

// ==========================================
// AUTH EXPORTS
// ==========================================

// User auth object - provides me(), logout(), redirectToLogin(), updateMe()
export const User = supabaseAuth;

// UserAdmin for admin operations (filtering users, etc.)
export const UserAdmin = SupabaseEntities.UserAdmin;

// Re-export config for convenience
export { AUTH_PROVIDER, BACKEND_PROVIDER } from './config';
