import ExcelJS from "exceljs";

import type { BusinessRecord } from "@/types/app";

export async function buildXlsx(rows: BusinessRecord[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prospectos");

  sheet.columns = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Categoria", key: "category", width: 24 },
    { header: "Direccion", key: "address", width: 42 },
    { header: "Telefono", key: "phone", width: 20 },
    { header: "Sitio web", key: "website", width: 28 },
    { header: "Tiene sitio web", key: "hasWebsite", width: 18 },
    { header: "Ciudad", key: "city", width: 18 },
    { header: "Estado", key: "state", width: 18 },
    { header: "Pais", key: "country", width: 18 },
    { header: "Latitud", key: "lat", width: 14 },
    { header: "Longitud", key: "lon", width: 14 },
    { header: "Zonas detectadas", key: "searchLabels", width: 36 },
  ];

  for (const row of rows) {
    sheet.addRow({
      name: row.name,
      category: row.categoryLabel ?? row.primaryCategory,
      address: row.address,
      phone: row.phone ?? "",
      website: row.website ?? "",
      hasWebsite: row.hasWebsite ? "Si" : "No",
      city: row.city ?? "",
      state: row.state ?? "",
      country: row.country ?? "",
      lat: row.lat,
      lon: row.lon,
      searchLabels: row.searchLabels.join(" | "),
    });
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFF8F5EE" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF124559" },
  };

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}
