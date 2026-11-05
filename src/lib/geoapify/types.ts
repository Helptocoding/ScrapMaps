export type GeoapifyGeocodeResult = {
  place_id?: string;
  formatted?: string;
  lat: number;
  lon: number;
  result_type?: string;
  city?: string;
  state?: string;
  country?: string;
  rank?: {
    confidence?: number;
  };
};

export type GeoapifyGeocodeResponse = {
  results: GeoapifyGeocodeResult[];
};

export type GeoapifyPlaceFeature = {
  properties: {
    place_id?: string;
    name?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    lat?: number;
    lon?: number;
    website?: string;
    phone?: string;
    categories?: string[];
    [key: string]: unknown;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

export type GeoapifyPlacesResponse = {
  features: GeoapifyPlaceFeature[];
};
