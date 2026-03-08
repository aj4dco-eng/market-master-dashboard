import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SignedImageProps {
  bucket: string;
  path: string;
  className?: string;
  alt?: string;
}

export function SignedImage({ bucket, path, className = "w-32 h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80", alt = "صورة" }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    // If it's already a full URL (legacy data), use it directly
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [bucket, path]);

  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt={alt} className={className} />
    </a>
  );
}
