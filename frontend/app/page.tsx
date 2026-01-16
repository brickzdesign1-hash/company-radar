"use client";

import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { useState, useEffect } from "react";

export default function HomePage() {
  console.log("DEBUG - API URL aus Umgebungsvariable:", process.env.NEXT_PUBLIC_API_BASE_URL);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#0a0a0f]">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="h-full w-full" style={{
          backgroundImage: `
            linear-gradient(90deg, #fff 1px, transparent 1px),
            linear-gradient(180deg, #fff 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Accent Blob - Top */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 -top-32 h-[400px] w-[600px] sm:h-[500px] sm:w-[800px] rounded-full opacity-15 blur-[100px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
        }}
      />

      {/* Accent Blob - Bottom */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 -bottom-32 h-[300px] w-[500px] rounded-full opacity-10 blur-[80px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
        }}
      />

      {/* Main Content - Centered */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Logo */}
        <div className={`flex items-center gap-2.5 mb-8 sm:mb-12 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="relative">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                <path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
              </svg>
            </div>
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#0a0a0f]" />
          </div>
          <span className="text-base sm:text-lg font-semibold text-white tracking-tight">Company Radar</span>
        </div>

        {/* Hero Text */}
        <div className={`text-center max-w-2xl mb-8 sm:mb-10 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-white">
            Unternehmen{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500">
              verstehen.
            </span>
          </h1>
          <p className="mt-4 sm:mt-6 text-sm sm:text-base md:text-lg text-slate-400 leading-relaxed px-2">
            Durchsuche Verflechtungen, Beteiligungen und Netzwerke deutscher Unternehmen.
          </p>
        </div>

        {/* Search Card */}
        <div className={`w-full max-w-xl transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-500/20 via-transparent to-blue-500/20 blur-xl opacity-50" />
            <div className="relative rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 backdrop-blur-sm">
              <SearchAutocomplete />
              
              {/* Quick Actions */}
              <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Populär:</span>
                {['Siemens', 'BMW', 'SAP'].map((company) => (
                  <button
                    key={company}
                    className="rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1 text-xs text-slate-400 transition-all hover:border-orange-500/50 hover:text-orange-400 active:scale-95"
                  >
                    {company}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className={`mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {[
            { icon: '◉', label: 'Graph-Visualisierung' },
            { icon: '↗', label: 'Beteiligungen' },
            { icon: '⚡', label: 'Echtzeit' },
          ].map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs text-slate-400"
            >
              <span className="text-orange-500">{feature.icon}</span>
              {feature.label}
            </div>
          ))}
        </div>

        {/* Stats - Desktop */}
        <div className={`hidden sm:flex gap-8 md:gap-12 mt-12 md:mt-16 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">2.4M+</div>
            <div className="text-xs md:text-sm text-slate-500 mt-1">Unternehmen</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">8.7M+</div>
            <div className="text-xs md:text-sm text-slate-500 mt-1">Verbindungen</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">&lt;50ms</div>
            <div className="text-xs md:text-sm text-slate-500 mt-1">Antwortzeit</div>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-auto pt-8 sm:pt-12 w-full max-w-xl transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-center gap-4 text-[10px] sm:text-xs text-slate-600">
            <span>Datenstand: Januar 2026</span>
            <span className="h-1 w-1 rounded-full bg-slate-700" />
            <span>Powered by Neo4j</span>
          </div>
        </div>
      </div>

      {/* Decorative Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
    </div>
  );
}
