import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerProvider } from "./hooks/usePlayer";
import Library from "./pages/Library";
import Playlists from "./pages/Playlists";
import Favorites from "./pages/Favorites";
import Install from "./pages/Install";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import NowPlayingBar from "./components/player/NowPlayingBar";
import FullScreenPlayer from "./components/player/FullScreenPlayer";
import BottomNav from "./components/navigation/BottomNav";

const queryClient = new QueryClient();

function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (location.pathname === '/') {
        e.preventDefault();
        navigate('/playlists', { replace: true });
      } else if (location.pathname !== '/playlists') {
        e.preventDefault();
        navigate('/', { replace: true });
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [location.pathname, navigate]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="h-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Library />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/install" element={<Install />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <PlayerProvider>
          <BackButtonHandler />
          <div className="flex flex-col h-[100dvh] bg-background">
            <main className="flex-1 overflow-hidden">
              <AnimatedRoutes />
            </main>
            <NowPlayingBar />
            <BottomNav />
            <FullScreenPlayer />
          </div>
        </PlayerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
