import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Check which auth provider is being used
const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || 'base44';

// Create a client with authentication required only for base44 auth
// When using Supabase auth, we completely disable base44's auth
let base44Client;

try {
  base44Client = createClient({
    appId: "68e49376f2948d5caa147758", 
    requiresAuth: false // Disable base44 auth redirect - we handle auth separately
  });
} catch (error) {
  console.warn('Base44 client initialization failed:', error);
  // Create a mock client for entities to prevent crashes
  base44Client = {
    entities: new Proxy({}, {
      get: () => ({
        filter: async () => [],
        list: async () => [],
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => {}
      })
    }),
    auth: {
      me: async () => { throw new Error('Not authenticated'); },
      logout: async () => {},
      redirectToLogin: () => {},
      updateMe: async () => ({})
    },
    functions: new Proxy({}, {
      get: () => async () => { throw new Error('Function not available - using Supabase auth'); }
    })
  };
}

// Ensure functions exists even if base44 client initialized without it
if (!base44Client.functions) {
  base44Client.functions = new Proxy({}, {
    get: () => async () => { throw new Error('Function not available'); }
  });
}

export const base44 = base44Client;
