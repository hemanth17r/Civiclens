import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
  }
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if the user dismissed recently
    const shouldShow = () => {
      const dismissedTime = localStorage.getItem('pwa_install_dismissed');
      if (!dismissedTime) return true;
      
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      return (Date.now() - parseInt(dismissedTime, 10)) > sevenDays;
    };

    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as Navigator & { standalone?: boolean }).standalone;
    
    if (isStandalone) {
      return; // Already installed, don't show prompt
    }

    // Defer state updates to avoid synchronous cascading renders warning
    const timer = setTimeout(() => {
      // Detect iOS/iPadOS devices (including desktop Safari on modern iPads)
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || 
        (navigator.maxTouchPoints > 1 && /macintosh|mac os x/i.test(userAgent));
      
      if (isIOSDevice && shouldShow()) {
        setIsIOS(true);
        setShowPrompt(true);
      }

      // 1. Check if the event was already captured globally by early inline script
      if (window.deferredPrompt && !isIOSDevice) {
        setDeferredPrompt(window.deferredPrompt);
        if (shouldShow()) {
          setShowPrompt(true);
        }
      }
    }, 0);

    // 2. Standard handler for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      // Prevent the mini-infobar from appearing on mobile
      promptEvent.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(promptEvent);
      window.deferredPrompt = promptEvent;
      
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || 
        (navigator.maxTouchPoints > 1 && /macintosh|mac os x/i.test(userAgent));

      if (shouldShow() && !isIOSDevice) {
        setShowPrompt(true);
      }
    };

    // 3. Custom event handler if the global script caught it and dispatched it
    const handleGlobalPromptAvailable = (e: Event) => {
      const customEvent = e as CustomEvent;
      const promptEvent = customEvent.detail || window.deferredPrompt;
      if (promptEvent) {
        setDeferredPrompt(promptEvent);
        
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || 
          (navigator.maxTouchPoints > 1 && /macintosh|mac os x/i.test(userAgent));

        if (shouldShow() && !isIOSDevice) {
          setShowPrompt(true);
        }
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      window.deferredPrompt = undefined;
      setShowPrompt(false);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handleGlobalPromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleGlobalPromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (!promptEvent) return;
    
    promptEvent.prompt();
    
    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    setDeferredPrompt(null);
    window.deferredPrompt = undefined;
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 bg-white rounded-2xl shadow-2xl p-5 z-50 flex flex-col border border-gray-100 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Install CivicLens</h3>
            <p className="text-xs text-gray-500">Add to home screen for instant updates</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50">
          <X size={18} />
        </button>
      </div>
      
      {isIOS ? (
        <div className="bg-blue-50 text-blue-800 text-xs p-3.5 rounded-xl flex flex-col gap-2 border border-blue-100">
          <p className="font-semibold">To install on your iOS device:</p>
          <ol className="list-decimal pl-5 space-y-1 text-blue-700">
            <li>
              Tap the Share button <Share size={12} className="inline-block align-middle mx-1 text-blue-800" /> in Safari
            </li>
            <li>Scroll down and select <strong>&ldquo;Add to Home Screen&rdquo;</strong></li>
          </ol>
        </div>
      ) : (
        <button 
          onClick={handleInstallClick}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 active:scale-[0.98]"
        >
          Install App
        </button>
      )}
    </div>
  );
};

export default PWAInstallPrompt;
