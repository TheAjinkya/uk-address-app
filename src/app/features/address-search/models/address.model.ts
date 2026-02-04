export interface PostcodeResult {
  postcode: string;
  quality: number;
  eastings: number;
  northings: number;
  country: string;
  nhs_ha: string;
  longitude: number;
  latitude: number;
  european_electoral_region: string;
  primary_care_trust: string;
  region: string;
  lsoa: string;
  msoa: string;
  incode: string;
  outcode: string;
  parliamentary_constituency: string;
  admin_district: string;
  parish: string;
  admin_county: string | null;
  admin_ward: string;
  ced: string | null;
  ccg: string;
  nuts: string;
  codes: PostcodeCodes;
}

export interface PostcodeCodes {
  admin_district: string;
  admin_county: string;
  admin_ward: string;
  parish: string;
  parliamentary_constituency: string;
  ccg: string;
  ccg_id: string;
  ced: string;
  nuts: string;
}

export interface Address {
  postcode: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface PostcodeApiResponse {
  status: number;
  result: PostcodeResult | PostcodeResult[] | null;
}

export interface AutocompleteResponse {
  status: number;
  result: string[] | null;
}