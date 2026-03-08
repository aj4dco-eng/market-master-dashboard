import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = (window.navigator as any).standalone;

    if (ios && !isStandalone) {
      setIsIOS(true);
      const dismissed = localStorage.getItem("pwa-ios-dismissed");
      if (!dismissed) setShowBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const dismissed = localStorage.getItem("pwa-dismissed");
      if (!dismissed) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(isIOS ? "pwa-ios-dismissed" : "pwa-dismissed", "1");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-xl border bg-card p-4 shadow-lg md:left-auto md:right-4 md:max-w-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Smartphone className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">ثبّت التطبيق على جهازك</p>
        {isIOS ? (
          <p className="text-xs text-muted-foreground">اضغط على زر المشاركة ثم &quot;إضافة إلى الشاشة الرئيسية&quot;</p>
        ) : (
          <p className="text-xs text-muted-foreground">استخدمه بدون متصفح — أسرع وأسهل</p>
        )}
      </div>

      {!isIOS && (
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          <Download className="ml-1 h-4 w-4" /> تثبيت
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
