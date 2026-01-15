"use client";

import useSWR from "swr";
import {
  Card,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Metric,
  Text,
  Badge,
} from "@tremor/react";

import { Building2, Fingerprint, Users2, Share2, Activity, TrendingUp, AlertCircle, Network } from "lucide-react";

import { CompanyHeader, type CompanyStatus } from "@/components/CompanyHeader";
import { CompanyGraph } from "@/components/CompanyGraph";
import { CompanyAnalysis } from "@/components/CompanyAnalysis";
import { Skeleton } from "@/components/ui/skeleton";

type CompanyLiveCheckResponse = {
  company_id: string;
  name: string;
  address?: string | null;
  status: CompanyStatus;
};

type NetworkResponse = {
  officers: Array<{
    name: string;
    role?: string;
    start_date?: string;
  }>;
};

type GraphResponse = {
  nodes: Array<any>;
  links: Array<any>;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
};

function useCompanyLiveCheck(companyId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const url = `${baseUrl}/companies/${encodeURIComponent(companyId)}/live-check`;
  return useSWR<CompanyLiveCheckResponse>(url, fetcher);
}

function useCompanyNetwork(companyId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const url = `${baseUrl}/companies/${encodeURIComponent(companyId)}/network`;
  return useSWR<NetworkResponse>(url, fetcher);
}

function useCompanyGraph(companyId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const url = `${baseUrl}/companies/${encodeURIComponent(companyId)}/graph`;
  return useSWR<GraphResponse>(url, fetcher);
}

function MasterDataCard({
  companyId,
  address,
  isLoading,
}: {
  companyId: string;
  address?: string | null;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
      <h2 className="mb-4 sm:mb-6 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400">Stammdaten</h2>

      <dl className="space-y-4 sm:space-y-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-orange-500/10">
            <Fingerprint className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <dt className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-500">Company ID</dt>
            <dd className="mt-1 sm:mt-1.5 break-all text-xs sm:text-sm font-medium text-white">
              {isLoading ? <Skeleton className="h-4 w-40 bg-slate-800" /> : companyId}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-blue-500/10">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <dt className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-500">Adresse</dt>
            <dd className="mt-1 sm:mt-1.5 text-xs sm:text-sm font-medium text-white">
              {isLoading ? (
                <Skeleton className="h-4 w-full bg-slate-800" />
              ) : address && address.trim().length > 0 ? (
                address
              ) : (
                "—"
              )}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

function NetworkCard({ companyId }: { companyId: string }) {
  const { data: networkData, isLoading: networkLoading } = useCompanyNetwork(companyId);

  if (networkLoading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
        <div className="mb-4 sm:mb-6 flex items-center gap-2">
          <Users2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400">Netzwerk-Teilnehmer</h2>
        </div>
        <div className="space-y-2 sm:space-y-3">
          <Skeleton className="h-10 w-full bg-slate-800" />
          <Skeleton className="h-20 sm:h-24 w-full bg-slate-800" />
          <Skeleton className="h-20 sm:h-24 w-full bg-slate-800" />
        </div>
      </div>
    );
  }

  const officers = networkData?.officers ?? [];

  // Helper function to get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper to get color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500/20 text-blue-300",
      "bg-emerald-500/20 text-emerald-300",
      "bg-violet-500/20 text-violet-300",
      "bg-amber-500/20 text-amber-300",
      "bg-rose-500/20 text-rose-300",
      "bg-cyan-500/20 text-cyan-300",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <Users2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400">Netzwerk-Teilnehmer</h2>
        <Badge className="ml-auto bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] sm:text-xs">{officers.length}</Badge>
      </div>

      {officers.length > 0 ? (
        <div className="max-h-[300px] sm:max-h-[400px] space-y-2 sm:space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
          {officers.map((officer, idx) => (
            <div
              key={`${officer.name}-${idx}`}
              className="group flex items-center gap-2 sm:gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-2.5 sm:p-3 transition-all hover:border-orange-500/30 hover:bg-slate-800/50"
            >
              {/* Geometric Avatar */}
              <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg text-[10px] sm:text-xs font-bold ${getAvatarColor(officer.name)}`}>
                {getInitials(officer.name)}
              </div>
              
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs sm:text-sm font-medium text-white">{officer.name}</p>
                <p className="truncate text-[10px] sm:text-xs text-slate-500">{officer.role || "—"}</p>
              </div>
              
              {/* Date */}
              {officer.start_date && (
                <div className="text-[10px] sm:text-xs text-slate-600 hidden sm:block">{officer.start_date}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 sm:py-10 text-center">
          <p className="text-xs sm:text-sm italic text-slate-600">Keine Personen gefunden.</p>
        </div>
      )}
    </div>
  );
}

function GraphCard({ companyId }: { companyId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <Network className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400">Interaktiver Netzwerk-Graph</h2>
      </div>

      <div className="h-[400px] sm:h-[500px] lg:h-[600px] overflow-hidden rounded-xl border border-slate-800 bg-[#0a0a0f]">
        <CompanyGraph companyId={companyId} />
      </div>
    </div>
  );
}

function QuickStatsCards({ companyId }: { companyId: string }) {
  const { data: networkData } = useCompanyNetwork(companyId);
  const { data: graphData } = useCompanyGraph(companyId);

  const officersCount = networkData?.officers?.length ?? 0;
  const connectionsCount = graphData?.links?.length ?? 0;
  const nodesCount = graphData?.nodes?.length ?? 0;

  // Einfache Risiko-Berechnung basierend auf Netzwerk-Komplexität
  const riskLevel = connectionsCount > 50 ? "Hoch" : connectionsCount > 20 ? "Mittel" : "Niedrig";
  const riskColor = connectionsCount > 50 ? "text-red-400" : connectionsCount > 20 ? "text-amber-400" : "text-emerald-400";

  const stats = [
    { 
      label: "Verbindungen", 
      value: connectionsCount,
      icon: Share2,
      color: "text-orange-400",
      bg: "bg-orange-500/10"
    },
    { 
      label: "Netzwerk-Knoten", 
      value: nodesCount,
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-500/10"
    },
    { 
      label: "Teilnehmer", 
      value: officersCount,
      icon: Users2,
      color: "text-violet-400",
      bg: "bg-violet-500/10"
    },
    { 
      label: "Risiko", 
      value: riskLevel,
      icon: AlertCircle,
      color: riskColor,
      bg: riskColor.includes("emerald") ? "bg-emerald-500/10" : riskColor.includes("amber") ? "bg-amber-500/10" : "bg-red-500/10",
      isText: true
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div 
          key={stat.label}
          className="flex items-center gap-2 sm:gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 sm:px-4 py-2.5 sm:py-3"
        >
          <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
            <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-slate-500 truncate">{stat.label}</p>
            <p className={`text-base sm:text-lg font-semibold ${stat.isText ? stat.color : 'text-white'}`}>
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CompanyProfilePage({ params }: { params: { id: string } }) {
  const { data, error, isLoading } = useCompanyLiveCheck(params.id);

  return (
    <div className="relative min-h-screen bg-[#0a0a0f]">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="h-full w-full" style={{
          backgroundImage: `
            linear-gradient(90deg, #fff 1px, transparent 1px),
            linear-gradient(180deg, #fff 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Accent Blob */}
      <div 
        className="absolute left-0 top-0 h-[400px] w-[600px] rounded-full opacity-10 blur-[120px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col gap-6 sm:gap-8 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-orange-400 transition-colors mb-3">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Zurück zur Suche
            </a>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {data?.name || "Unternehmen laden..."}
            </h1>
            {data?.address && (
              <p className="mt-1 text-sm text-slate-400">{data.address}</p>
            )}
          </div>
          <div className="shrink-0 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse"></div>
              <span className="text-sm font-medium text-orange-400">Live Status</span>
            </div>
          </div>
        </div>

        {/* Fehleranzeige */}
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <h2 className="text-sm font-medium text-red-400">Fehler</h2>
            <p className="mt-2 text-sm text-red-300">Daten konnten nicht geladen werden.</p>
          </div>
        ) : null}

        {/* Quick Stats */}
        <QuickStatsCards companyId={params.id} />

        {/* 2-column layout (Desktop) / 1-column (Mobile) */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Left (1/3): Master data + Network list */}
          <div className="flex flex-col gap-4 sm:gap-6 lg:col-span-1">
            <MasterDataCard companyId={params.id} address={data?.address} isLoading={isLoading} />
            <NetworkCard companyId={params.id} />
          </div>

          {/* Right (2/3): Interactive Graph */}
          <div className="lg:col-span-2">
            <GraphCard companyId={params.id} />
          </div>
        </div>

        {/* Analyse Section */}
        <div className="mt-6 sm:mt-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
            <span className="h-2 w-2 bg-orange-500 rounded-full animate-pulse"></span>
            Wirtschaftliche Analyse
          </h2>
          
          <CompanyAnalysis companyId={params.id} />
        </div>
      </div>
    </div>
  );
}