"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BusinessRecord } from "@/types/app";

type BusinessTableProps = {
  data: BusinessRecord[];
  selectedId: string | null;
  onSelect: (placeId: string | null) => void;
  onHover: (placeId: string | null) => void;
  isLoading?: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** `https://www.ejemplo.com/x?y=1` → `ejemplo.com`. La URL completa no cabe ni aporta. */
function formatDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function BusinessTable({ data, selectedId, onSelect, onHover, isLoading = false, page, pageSize, total, onPageChange }: BusinessTableProps) {
  const [sorting, setSorting] = useState<Array<{ id: string; desc: boolean }>>([]);

  const columns = useMemo<ColumnDef<BusinessRecord>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Negocio",
        size: 230,
        cell: ({ row }) => <span className="block truncate text-ink">{row.original.name}</span>,
      },
      {
        id: "leadScore",
        accessorKey: "leadScore",
        header: "Prioridad",
        size: 100,
        cell: ({ row }) => {
          const score = row.original.leadScore;
          const label = score >= 7 ? "Alta" : score >= 4 ? "Media" : "Base";
          const tone = score >= 7 ? "text-emerald-700 bg-emerald-50" : score >= 4 ? "text-amber-700 bg-amber-50" : "text-zinc-600 bg-zinc-100";
          return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", tone)}>{label} · {score}</span>;
        },
      },
      {
        id: "address",
        accessorKey: "address",
        header: "Dirección",
        size: 250,
        cell: ({ row }) => <span className="block truncate text-ink-3">{row.original.address}</span>,
      },
      {
        id: "categoryLabel",
        accessorKey: "categoryLabel",
        header: "Categoría",
        size: 140,
        cell: ({ row }) => (
          <span className="block truncate text-ink-2">
            {row.original.categoryLabel ?? row.original.primaryCategory}
          </span>
        ),
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: "Teléfono",
        size: 125,
        // Sin dato → celda vacía. Nunca un guión de relleno.
        cell: ({ row }) =>
          row.original.phone ? (
            <span className="block truncate text-ink-2" data-numeric>
              {row.original.phone}
            </span>
          ) : null,
      },
      {
        id: "rating",
        accessorKey: "rating",
        header: "Reseñas",
        size: 110,
        cell: ({ row }) =>
          row.original.rating ? (
            <span className="block truncate text-ink-2" data-numeric>
              {row.original.rating.toFixed(1)} ★ {row.original.reviewCount ? `· ${row.original.reviewCount}` : ""}
            </span>
          ) : null,
      },
      {
        id: "website",
        accessorKey: "website",
        header: "Web",
        size: 165,
        cell: ({ row }) =>
          row.original.website ? (
            <a
              href={row.original.website}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="block truncate text-ink-2 underline-offset-2 hover:text-accent hover:underline"
            >
              {formatDomain(row.original.website)}
            </a>
          ) : (
            // El único color no-neutro de la grilla: es el dato que vende.
            <span className="flex items-center gap-1.5 text-signal">
              <span className="size-1.5 shrink-0 rounded-full bg-signal" aria-hidden="true" />
              sin web
            </span>
          ),
      },
      {
        id: "municipality",
        accessorKey: "city",
        header: "Municipio",
        size: 150,
        cell: ({ row }) => {
          const municipality = row.original.city ?? row.original.state ?? "Sin municipio";
          return <span className="block truncate text-ink-3" title={municipality}>{municipality}</span>;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => setSorting(typeof updater === "function" ? updater(sorting) : updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const tableHeight = Math.min(540, 76 + rows.length * 36);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (data.length === 0) {
    return (
      <div className="relative flex min-h-[260px] items-center justify-center p-8">
        <div className="max-w-[36ch] text-center">
          <p className="text-heading text-ink">Sin negocios</p>
          <p className="mt-1 text-body text-ink-3">
            Corré una búsqueda desde la barra superior y los resultados aparecen acá.
          </p>
        </div>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]" aria-live="polite">
            <span className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm">
              Actualizando resultados…
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-col" style={{ height: tableHeight }}>
      <div className="min-h-0 flex-1 overflow-auto" onMouseLeave={() => onHover(null)}>
        <table className="w-full border-separate border-spacing-0 text-body">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const { column } = header;
                  const sorted = column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      style={{ width: column.getSize() }}
                      className="border-b border-line bg-panel px-2.5 py-0 text-left"
                    >
                      <button
                        type="button"
                        onClick={column.getToggleSortingHandler()}
                        aria-sort={sorted === "desc" ? "descending" : sorted === "asc" ? "ascending" : undefined}
                        className={cn(
                          "flex h-8 w-full items-center gap-1 text-micro uppercase transition-colors",
                          sorted ? "text-accent" : "text-ink-3 hover:text-ink",
                        )}
                      >
                        {flexRender(column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? <ChevronUpIcon size={11} /> : null}
                        {sorted === "desc" ? <ChevronDownIcon size={11} /> : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.original.placeId === selectedId;
              return (
                <tr
                  key={row.id}
                  onMouseEnter={() => onHover(row.original.placeId)}
                  onClick={() => onSelect(isSelected ? null : row.original.placeId)}
                  className={cn(
                    "h-row cursor-pointer transition-colors",
                    isSelected ? "bg-accent-soft" : "hover:bg-panel-2",
                  )}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={cn(
                        "max-w-0 overflow-hidden border-b border-line px-2.5 align-middle",
                        // Marca de selección sin mover el layout.
                        index === 0 && "relative",
                        index === 0 && isSelected && "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between border-t border-line bg-panel px-3">
          <span className="text-small text-ink-3" data-numeric>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total} · Página {page} de {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              className="rounded px-2 py-0.5 text-small text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink disabled:text-ink-3/40 disabled:hover:bg-transparent"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount || isLoading}
              className="rounded px-2 py-0.5 text-small text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink disabled:text-ink-3/40 disabled:hover:bg-transparent"
            >
              Siguiente
            </button>
          </div>
      </div>
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]" aria-live="polite">
          <span className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm">
            Actualizando resultados…
          </span>
        </div>
      ) : null}
    </div>
  );
}
