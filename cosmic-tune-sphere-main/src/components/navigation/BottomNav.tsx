import { useLocation, useNavigate } from 'react-router-dom';
import { Library, ListMusic, Heart, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const tabs = [
  { path: '/', icon: Library, label: 'Library' },
  { path: '/playlists', icon: ListMusic, label: 'Playlists' },
  { path: '/favorites', icon: Heart, label: 'Favorites' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="flex items-center justify-around bg-player-bg/80 backdrop-blur-xl border-t border-border/50 py-1.5 px-2">
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = location.pathname === path;
        return (
          <motion.button
            key={path}
            onClick={() => navigate(path)}
            whileTap={{ scale: 0.9 }}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-300 relative ${
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {active && (
              <motion.div
                layoutId="nav-bg"
                className="absolute inset-0 bg-primary/10 rounded-xl"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            {active && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -top-1.5 w-6 h-0.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <motion.div
              animate={{ y: active ? -1 : 0, scale: active ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative z-10"
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
            </motion.div>
            <span className={`text-[10px] relative z-10 transition-all duration-200 ${active ? 'font-semibold' : 'font-medium'}`}>
              {label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}
