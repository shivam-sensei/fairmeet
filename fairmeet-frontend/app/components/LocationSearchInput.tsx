"use client";

import { useEffect, useRef, useState } from "react";
import { searchLocations } from "@/lib/geocoding";
import type { LocationSearchResult } from "@/types";

interface LocationSearchInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSelect: (lat: number, lng: number, displayName: string) => void;
  onUseCurrentLocation: () => void;
}

export default function LocationSearchInput({
  value,
  placeholder = "Search a place or address",
  onChange,
  onSelect,
  onUseCurrentLocation,
}: LocationSearchInputProps) {
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedValueRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (selectedValueRef.current === query) {
      selectedValueRef.current = null;
      setResults([]);
      setLoading(false);
      return;
    }
    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchLocations(query)
        .then((nextResults) => {
          if (requestId === requestIdRef.current) setResults(nextResults);
        })
        .catch(() => {
          if (requestId === requestIdRef.current) setResults([]);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [value]);

  return (
    <div className="relative">
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none"
          aria-label="Search friend location"
        />
        {loading && <span className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />}
        {value && !loading && (
          <button type="button" onClick={() => { onChange(""); setResults([]); }} className="px-1 text-slate-400 hover:text-slate-700" aria-label="Clear location search">✕</button>
        )}
        <button type="button" onClick={onUseCurrentLocation} className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600" aria-label="Use current location" title="Use current location">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
        </button>
      </div>
      {results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.map((result) => (
            <button
              type="button"
              key={`${result.lat}-${result.lng}`}
              onClick={() => {
                selectedValueRef.current = result.displayName.trim();
                requestIdRef.current += 1;
                setResults([]);
                setLoading(false);
                onSelect(result.lat, result.lng, result.displayName);
              }}
              className="block w-full truncate px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50"
            >
              {result.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
