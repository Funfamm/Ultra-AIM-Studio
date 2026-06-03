const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AR: "Argentina", AU: "Australia",
  AT: "Austria", BE: "Belgium", BR: "Brazil", CA: "Canada", CL: "Chile",
  CN: "China", CO: "Colombia", HR: "Croatia", CZ: "Czech Republic", DK: "Denmark",
  EG: "Egypt", FI: "Finland", FR: "France", DE: "Germany", GH: "Ghana",
  GR: "Greece", HK: "Hong Kong", HU: "Hungary", IN: "India", ID: "Indonesia",
  IE: "Ireland", IL: "Israel", IT: "Italy", JP: "Japan", KE: "Kenya",
  MY: "Malaysia", MX: "Mexico", MA: "Morocco", NL: "Netherlands", NZ: "New Zealand",
  NG: "Nigeria", NO: "Norway", PK: "Pakistan", PE: "Peru", PH: "Philippines",
  PL: "Poland", PT: "Portugal", RO: "Romania", RU: "Russia", SA: "Saudi Arabia",
  SG: "Singapore", ZA: "South Africa", KR: "South Korea", ES: "Spain", SE: "Sweden",
  CH: "Switzerland", TW: "Taiwan", TH: "Thailand", TR: "Turkey", UA: "Ukraine",
  AE: "UAE", GB: "United Kingdom", US: "United States", VN: "Vietnam",
};

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}
