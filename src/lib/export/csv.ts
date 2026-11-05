import type { BusinessRecord } from "@/types/app";

const HEADERS = [
  "Nombre",
  "Categoria",
  "Direccion",
  "Telefono",
  "Sitio web",
  "Tiene sitio web",
  "Ciudad",
  "Estado",
  "Pais",
  "Latitud",
  "Longitud",
  "Zonas detectadas",
];

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: BusinessRecord[]) {
  const lines = [HEADERS.map(escapeCsv).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.categoryLabel ?? row.primaryCategory,
        row.address,
        row.phone ?? "",
        row.website ?? "",
        row.hasWebsite ? "Si" : "No",
        row.city ?? "",
        row.state ?? "",
        row.country ?? "",
        row.lat.toString(),
        row.lon.toString(),
        row.searchLabels.join(" | "),
      ]
        .map((value) => escapeCsv(value))
        .join(","),
    );
  }

  return lines.join("\n");
}
