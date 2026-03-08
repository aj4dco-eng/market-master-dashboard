import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOnline(false);
    const goOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
        isOnline
          ? "bg-accent text-accent-foreground"
          : "bg-destructive text-destructive-foreground"
      }`}
    >
      {isOnline ? (
        <><Wifi className="h-4 w-4" /> عاد الاتصال بالإنترنت</>
      ) : (
        <><WifiOff className="h-4 w-4" /> لا يوجد اتصال بالإنترنت</>
      )}
    </div>
  );
}
