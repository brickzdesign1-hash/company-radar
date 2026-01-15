"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  score: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debouncing logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch data with SWR
  const { data, error, isLoading } = useSWR<SearchResult[]>(
    debouncedQuery.trim().length >= 2
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/companies/search?q=${encodeURIComponent(debouncedQuery)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 500,
    }
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show dropdown when we have query and results or loading
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [debouncedQuery, data, isLoading]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || !data || data.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < data.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < data.length) {
          handleSelectCompany(data[highlightedIndex].id);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectCompany = (id: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(`/company/${id}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setHighlightedIndex(-1);
  };

  const results = data || [];
  const showResults = isOpen && debouncedQuery.trim().length >= 2;
  const hasResults = results.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full mx-auto">
      {/* Search Input */}
      <div className="relative group">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-4">
          <svg
            className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 transition-colors group-focus-within:text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debouncedQuery.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder="Unternehmen suchen..."
          className={cn(
            "w-full rounded-lg border-0 bg-slate-800/60 py-3 sm:py-4 pl-10 sm:pl-12 pr-10 sm:pr-12",
            "text-white placeholder-slate-500 text-sm sm:text-base",
            "ring-1 ring-slate-700/50 focus:ring-2 focus:ring-orange-500/50",
            "focus:outline-none transition-all duration-200"
          )}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4 text-slate-500 hover:text-orange-400 transition-colors"
          >
            <svg
              className="h-4 w-4 sm:h-5 sm:w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div className="absolute z-[100] mt-2 w-full overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
          {isLoading ? (
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 sm:h-14 animate-pulse rounded-lg bg-slate-800/50"
                />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 sm:p-6 text-center">
              <div className="mx-auto mb-2 sm:mb-3 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">Fehler beim Laden</p>
            </div>
          ) : !hasResults ? (
            <div className="p-4 sm:p-6 text-center">
              <div className="mx-auto mb-2 sm:mb-3 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-slate-800 flex items-center justify-center">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">Keine Ergebnisse für „{debouncedQuery}"</p>
            </div>
          ) : (
            <ul className="max-h-64 sm:max-h-80 overflow-y-auto py-1.5 sm:py-2">
              {results.map((result, index) => (
                <li key={result.id}>
                  <button
                    onClick={() => handleSelectCompany(result.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all",
                      "hover:bg-slate-800/70 active:bg-slate-800",
                      highlightedIndex === index && "bg-slate-800/70"
                    )}
                  >
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-orange-500/20 to-amber-500/10 ring-1 ring-orange-500/20">
                      <svg
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-medium text-white">
                        {result.name}
                      </p>
                      {result.score && (
                        <p className="text-[10px] sm:text-xs text-slate-500">
                          {(result.score * 100).toFixed(0)}% Relevanz
                        </p>
                      )}
                    </div>
                    <svg
                      className={cn(
                        "h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-slate-600 transition-colors",
                        highlightedIndex === index && "text-orange-500"
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
