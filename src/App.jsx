import { useEffect, useRef } from 'react'
import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isNativeApp } from '@/utils/paymentPlatform'
import { initializeRevenueCat } from '@/services/revenueCatService'
import { supabase } from '@/api/supabaseClient'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Track processed deep links to prevent infinite loops
// Using a Set outside the component to persist across re-renders
const processedDeepLinks = new Set();

/**
 * Handle OAuth deep link callback for native apps
 * The custom URL scheme (myezlist://) redirects here after OAuth
 */
async function handleDeepLink(url) {
  if (!url || !url.includes('auth/callback')) return;

  // Extract just the base URL without tokens for tracking (tokens change, path doesn't)
  const baseUrl = url.split('#')[0];
  
  // Prevent processing the same deep link multiple times (fixes infinite loop)
  if (processedDeepLinks.has(baseUrl)) {
    console.log('🔄 Deep link already processed, skipping:', baseUrl);
    return;
  }
  processedDeepLinks.add(baseUrl);

  try {
    // Close the browser if it's still open
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch (err) {
    // Browser might already be closed - this is fine
  }

  // Parse the URL to extract tokens
  const urlObj = new URL(url);
  
  // Handle hash fragment (Supabase sends tokens in hash)
  // Format: myezlist://auth/callback#access_token=...&refresh_token=...
  const hashParams = new URLSearchParams(urlObj.hash.substring(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    // Set the session manually
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      console.error('Failed to set session from deep link:', error);
      processedDeepLinks.delete(baseUrl); // Allow retry on error
    } else {
      console.log('✅ OAuth session established via deep link');
      
      // Get the redirect destination
      const redirectParam = urlObj.searchParams.get('redirect') || hashParams.get('redirect') || '/Home';
      const destination = decodeURIComponent(redirectParam);
      
      // Use history.replaceState to change URL without full reload
      // This prevents the infinite loop caused by window.location.href
      window.history.replaceState({}, '', destination);
      
      // Force a re-render by dispatching a popstate event to trigger React Router
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }
  }
}

function App() {
  // Ref to prevent setting up deep link listeners multiple times
  const deepLinkProcessed = useRef(false);

  // Initialize native app features (StatusBar, RevenueCat, deep links)
  useEffect(() => {
    if (isNativeApp()) {
      // Configure Status Bar appearance
      // Note: On iOS, setBackgroundColor doesn't work - we use CSS for that (see index.css)
      // The Style.Light means white text/icons which works well with our blue background
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        // Use light text (white icons/text) for visibility on our blue status bar background
        StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        // On Android, set the background color (this doesn't work on iOS)
        StatusBar.setBackgroundColor({ color: '#2563eb' }).catch(() => {});
        console.log('📱 Status bar style configured');
      }).catch(err => {
        // StatusBar plugin may not be available - CSS fallback handles this
        console.log('StatusBar plugin not available (CSS handles styling):', err);
      });

      // Initialize RevenueCat
      initializeRevenueCat()
        .then(success => {
          if (success) {
            console.log('📱 RevenueCat initialized for native app');
          }
        })
        .catch(err => {
          console.warn('Failed to initialize RevenueCat:', err);
        });

      // Set up deep link listener for OAuth callbacks
      const setupDeepLinkListener = async () => {
        // Prevent setting up multiple times
        if (deepLinkProcessed.current) return;
        deepLinkProcessed.current = true;

        try {
          const { App: CapApp } = await import('@capacitor/app');
          
          // Handle app opened via deep link (warm start)
          CapApp.addListener('appUrlOpen', (event) => {
            console.log('🔗 Deep link received:', event.url);
            handleDeepLink(event.url);
          });

          // Check if app was opened with a URL (cold start)
          // Only process once per app session
          const launchUrl = await CapApp.getLaunchUrl();
          if (launchUrl?.url) {
            console.log('🚀 App launched with URL:', launchUrl.url);
            handleDeepLink(launchUrl.url);
          }
        } catch (err) {
          console.warn('Failed to set up deep link listener:', err);
          deepLinkProcessed.current = false; // Allow retry on error
        }
      };

      setupDeepLinkListener();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Pages />
      <Toaster />
    </QueryClientProvider>
  )
}

export default App 