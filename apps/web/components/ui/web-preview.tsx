"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Image as ImageIcon } from "lucide-react";

interface WebPreviewProps {
  url: string;
}

export function WebPreview({ url }: WebPreviewProps) {
  const [debouncedUrl, setDebouncedUrl] = useState(url);

  // Debounce the URL so we don't spam the API while typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUrl(url);
    }, 800);
    return () => clearTimeout(handler);
  }, [url]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["web-preview", debouncedUrl],
    queryFn: async () => {
      if (!debouncedUrl || !debouncedUrl.startsWith("http")) return null;
      const res = await fetch(`/api/preview?url=${encodeURIComponent(debouncedUrl)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!debouncedUrl && debouncedUrl.startsWith("http"),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  if (!url || !url.startsWith("http")) {
    return null;
  }

  if (isLoading || url !== debouncedUrl) {
    return (
      <div className="w-full h-24 rounded-xl border border-white/5 bg-zinc-900/30 flex animate-pulse overflow-hidden mt-3">
        <div className="w-24 h-full bg-zinc-800/50 shrink-0"></div>
        <div className="p-3 flex-1 flex flex-col justify-center gap-2">
          <div className="h-4 w-3/4 bg-zinc-800/50 rounded"></div>
          <div className="h-3 w-full bg-zinc-800/50 rounded"></div>
          <div className="h-3 w-1/2 bg-zinc-800/50 rounded"></div>
        </div>
      </div>
    );
  }

  if (isError || !data || (!data.title && !data.image)) {
    return (
      <div className="w-full p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center gap-3 mt-3 text-sm text-zinc-500">
        <Globe className="size-5 opacity-50 shrink-0" />
        <span>No preview available for this URL.</span>
      </div>
    );
  }

  return (
    <a 
      href={data.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="group w-full h-24 rounded-xl border border-white/10 bg-zinc-900/50 hover:bg-zinc-900 hover:border-violet-500/30 transition-all flex overflow-hidden mt-3 cursor-pointer relative"
    >
      <div className="w-24 h-full shrink-0 bg-zinc-950 flex items-center justify-center border-r border-white/5 relative overflow-hidden">
        {data.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={data.image} alt={data.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <ImageIcon className="size-6 text-zinc-700" />
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col justify-center overflow-hidden">
        <h4 className="text-sm font-semibold text-zinc-200 truncate">{data.title}</h4>
        {data.description && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-snug">
            {data.description}
          </p>
        )}
        <div className="text-[10px] text-zinc-600 mt-1.5 flex items-center gap-1 uppercase tracking-wider font-medium">
          {data.hostname}
        </div>
      </div>
    </a>
  );
}
