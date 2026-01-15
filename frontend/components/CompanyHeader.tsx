"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type CompanyStatus =
  | "ACTIVE"
  | "INSOLVENT"
  | "LIQUIDATION"
  | "WARNING"
  | "UNKNOWN"
  | "DELETED";

function statusBadgeClass(status: CompanyStatus | undefined) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-500";
    case "INSOLVENT":
    case "LIQUIDATION":
      return "bg-red-500";
    case "WARNING":
      return "bg-orange-500";
    default:
      return "bg-gray-400";
  }
}

function statusLabel(status: CompanyStatus | undefined) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INSOLVENT":
      return "Insolvent";
    case "LIQUIDATION":
      return "Liquidation";
    case "WARNING":
      return "Warning";
    case "DELETED":
      return "Deleted";
    default:
      return "Unknown";
  }
}

export function CompanyHeader(props: {
  name?: string;
  address?: string | null;
  status?: CompanyStatus;
  isLoading?: boolean;
  showAddress?: boolean;
}) {
  const { name, address, status, isLoading, showAddress = true } = props;

  return (
    <header className="flex flex-col gap-3 border-b pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-8 w-[min(26rem,80vw)]" />
          ) : (
            <h1 className="truncate text-2xl font-semibold">{name ?? "—"}</h1>
          )}

          {showAddress ? (
            isLoading ? (
              <Skeleton className="mt-2 h-4 w-[min(34rem,90vw)]" />
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                {address && address.trim().length > 0 ? address : "—"}
              </p>
            )
          ) : null}
        </div>

        <div className="shrink-0">
          {isLoading ? (
            <Skeleton className="h-9 w-36" />
          ) : (
            <div
              className={cn(
                "inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-white",
                statusBadgeClass(status)
              )}
            >
              Live Status: {statusLabel(status)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
