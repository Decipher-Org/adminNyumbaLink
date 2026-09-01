/** Must remain aligned with the backend's supported service area. */
export const COASTAL_COUNTIES = [
  "Kilifi",
  "Mombasa",
  "Kwale",
  "Lamu",
  "Tana River",
  "Taita-Taveta",
] as const;

export type CoastalCounty = (typeof COASTAL_COUNTIES)[number];
