import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
        <Download className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Install SonicWave</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Install this app on your device for the best offline music experience. Works without internet!
      </p>

      {installed ? (
        <p className="text-primary font-medium">✓ App installed!</p>
      ) : deferredPrompt ? (
        <Button onClick={handleInstall} size="lg" className="gap-2">
          <Download className="w-5 h-5" /> Install App
        </Button>
      ) : (
        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3 text-left">
            <Share2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">iOS (Safari)</p>
              <p>Tap the Share button → "Add to Home Screen"</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-left">
            <Download className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Android (Chrome)</p>
              <p>Tap the menu (⋮) → "Install app" or "Add to Home Screen"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
