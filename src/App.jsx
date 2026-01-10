import { useEffect } from 'react'
import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isNativeApp } from '@/utils/paymentPlatform'
import { initializeRevenueCat } from '@/services/revenueCatService'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  // Initialize RevenueCat for native apps (iOS/Android)
  useEffect(() => {
    if (isNativeApp()) {
      initializeRevenueCat()
        .then(success => {
          if (success) {
            console.log('📱 RevenueCat initialized for native app');
          }
        })
        .catch(err => {
          console.warn('Failed to initialize RevenueCat:', err);
        });
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