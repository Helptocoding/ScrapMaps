import { CATEGORY_OPTIONS } from "@/lib/categories/dictionary";
import { normalizeText } from "@/lib/utils";
import type { CategoryOption, CategoryResolution } from "@/types/app";

const GOOGLE_CATEGORY_LABELS: Record<string, string> = {
  veterinary_care: "Veterinarias",
  dentist: "Dentistas",
  pharmacy: "Farmacias",
  barber_shop: "Barberías",
  hair_salon: "Salones de belleza",
  spa: "Spa",
  tattoo_shop: "Estudios de tatuajes",
  cafe: "Cafeterías",
  bar: "Bares",
  restaurant: "Restaurantes",
  pizza_restaurant: "Pizzerías",
  hamburger_restaurant: "Hamburgueserías",
  bakery: "Panaderías",
  lawyer: "Abogados",
  accounting: "Contadores",
  real_estate_agency: "Inmobiliarias",
  electrician: "Electricistas",
  carpenter: "Carpinteros",
  locksmith: "Cerrajeros",
  photography_studio: "Estudios fotográficos",
  travel_agency: "Agencias de viaje",
  car_repair: "Talleres mecánicos",
  car_wash: "Lavado de autos",
  building: "Edificios",
  doctor: "Médicos",
  medical_lab: "Laboratorios clínicos",
  pet_care: "Servicios para mascotas",
  pet_boarding_service: "Pensiones para mascotas",
};

const FALLBACK_CATEGORY_LABELS: Record<string, string> = {
  point_of_interest: "Lugar de interés",
  establishment: "Negocio",
  health: "Salud",
  food: "Alimentos",
  service: "Servicios",
  commercial: "Comercios",
  office: "Oficinas",
  healthcare: "Salud",
  catering: "Alimentos y bebidas",
  pet: "Mascotas",
};

function scoreCategory(input: string, option: CategoryOption) {
  const normalizedAliases = [option.label, option.key, ...option.aliases].map(normalizeText);

  if (normalizedAliases.includes(input)) {
    return 100;
  }

  if (normalizedAliases.some((alias) => alias.startsWith(input) || input.startsWith(alias))) {
    return 70;
  }

  if (normalizedAliases.some((alias) => alias.includes(input) || input.includes(alias))) {
    return 40;
  }

  return 0;
}

export function resolveCategory(query: string): CategoryResolution {
  const normalized = normalizeText(query);

  if (!normalized) {
    return { matched: false, suggestions: CATEGORY_OPTIONS.slice(0, 8) };
  }

  const ranked = CATEGORY_OPTIONS.map((option) => ({
    option,
    score: scoreCategory(normalized, option),
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.option.label.localeCompare(right.option.label));

  const exact = ranked.find((entry) => entry.score >= 100)?.option;

  return {
    matched: Boolean(exact),
    match: exact,
    suggestions:
      ranked.length > 0
        ? ranked.slice(0, 6).map((entry) => entry.option)
        : CATEGORY_OPTIONS.slice(0, 6),
  };
}

export function getCategoryLabel(category: string | null | undefined) {
  if (!category) return null;

  const exact = CATEGORY_OPTIONS.find((option) => option.geoapifyCategory === category);
  if (exact) return exact.label;

  const topLevel = CATEGORY_OPTIONS.find((option) => category.startsWith(option.geoapifyCategory));
  if (topLevel) return topLevel.label;

  const googleLabel = GOOGLE_CATEGORY_LABELS[category];
  if (googleLabel) return googleLabel;

  const fallback = FALLBACK_CATEGORY_LABELS[category];
  if (fallback) return fallback;

  return category
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
