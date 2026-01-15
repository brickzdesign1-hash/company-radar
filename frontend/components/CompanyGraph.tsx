"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";

// Dynamischer Import: Verhindert "window is not defined" Fehler beim SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Initialisiere Graph-Engine…
    </div>
  ),
});

type GraphNode = {
  id: string;
  name?: string | null;
  type: "company" | "person";
};

type GraphLink = {
  source: string;
  target: string;
  role?: string | null;
};

type CompanyGraphResponse = {
  nodes: GraphNode[];
  links: GraphLink[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
};

export function CompanyGraph({ companyId }: { companyId: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const url = `${baseUrl}/companies/${encodeURIComponent(companyId)}/graph`;

  const { data, error, isLoading } = useSWR<CompanyGraphResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1_000,
  });

  const fgRef = useRef<any>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const graphData = useMemo(() => {
    return {
      nodes: data?.nodes ?? [],
      links: data?.links ?? [],
    };
  }, [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.max(0, Math.floor(rect.width)), height: Math.max(0, Math.floor(rect.height)) });
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zentriere den Graph auf den Hauptknoten nach der Simulation
  const handleEngineStop = () => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Finde den Hauptknoten (die Hauptfirma)
      const mainNode = graphData.nodes.find((n: any) => n.id === companyId);
      
      if (mainNode && typeof mainNode.x === 'number' && typeof mainNode.y === 'number') {
        // Zuerst auf den Hauptknoten zentrieren
        fgRef.current.centerAt(mainNode.x, mainNode.y, 300);
        
        // Dann mit passendem Zoom
        setTimeout(() => {
          if (fgRef.current) {
            // Berechne einen guten Zoom-Level basierend auf Anzahl der Nodes
            const nodeCount = graphData.nodes.length;
            const zoomLevel = nodeCount > 20 ? 1.5 : nodeCount > 10 ? 2 : 2.5;
            fgRef.current.zoom(zoomLevel, 400);
          }
        }, 350);
      } else {
        // Fallback: zoomToFit wenn kein Hauptknoten gefunden
        fgRef.current.zoomToFit(400, 80);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Lade Graph…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-600">
        Graph konnte nicht geladen werden.
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Keine Graph-Daten gefunden.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-slate-700/50 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur-sm">
        {data.nodes.length} Nodes • {data.links.length} Links
      </div>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.width || undefined}
        height={size.height || undefined}
        backgroundColor="rgba(15, 23, 42, 0.5)"
        nodeLabel={(n: any) => n?.name || n?.id}
        linkLabel={(l: any) => l?.role || "DIRECTORSHIP"}
        nodeColor={(n: any) => {
          if (n?.id === companyId) return "#ef4444"; // red-500 for root
          return n?.type === "company" ? "#10b981" : "#3b82f6"; // emerald-500 / blue-500
        }}
        nodeVal={(n: any) => (n?.id === companyId ? 10 : n?.type === "company" ? 6 : 5)}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          // Validate coordinates before drawing
          if (typeof node.x !== 'number' || typeof node.y !== 'number' || 
              !isFinite(node.x) || !isFinite(node.y)) {
            return;
          }

          const label = node.name || node.id;
          const fontSize = 11 / globalScale;
          const isMainNode = node.id === companyId;
          const radius = Math.sqrt(isMainNode ? 10 : node.type === "company" ? 6 : 5) * 2;
          
          // Draw outer glow for selected/main node
          if (isMainNode) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
            const gradient = ctx.createRadialGradient(node.x, node.y, radius, node.x, node.y, radius + 4);
            gradient.addColorStop(0, "rgba(239, 68, 68, 0.3)");
            gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx.fillStyle = gradient;
            ctx.fill();
          }
          
          // Draw the node
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = isMainNode ? "#ef4444" : node.type === "company" ? "#10b981" : "#3b82f6";
          ctx.fill();
          
          // Draw subtle ring
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
          
          // Draw the label below the node
          ctx.font = `${fontSize}px Inter, -apple-system, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText(label, node.x, node.y + radius + 4);
        }}
        linkColor={(l: any) => "rgba(148, 163, 184, 0.3)"}
        linkWidth={(l: any) => (l?.role ? 1.5 : 1)}
        linkDirectionalParticles={(l: any) => (l?.source && l?.target ? 2 : 0)}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={() => "rgba(59, 130, 246, 0.6)"}
        cooldownTicks={100}
        d3VelocityDecay={0.3}
        onEngineStop={handleEngineStop}
      />
    </div>
  );
}
