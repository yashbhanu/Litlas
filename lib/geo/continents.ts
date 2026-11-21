/**
 * Static ISO 3166-1 alpha-2 → continent lookup (seven-continent model). Transcontinental
 * countries use their conventional grouping: Russia, Cyprus → Europe; Turkey, Georgia,
 * Armenia, Azerbaijan, Kazakhstan → Asia; Egypt → Africa; Central America and the
 * Caribbean → North America. XK is Kosovo (user-assigned code used by Natural Earth).
 */

export const CONTINENTS = [
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
] as const;
export type Continent = (typeof CONTINENTS)[number];

const CODES: Record<Continent, string> = {
  Africa:
    "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW",
  Antarctica: "AQ BV GS HM TF",
  Asia: "AE AF AM AZ BD BH BN BT CC CN CX GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE",
  Europe:
    "AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK",
  "North America":
    "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI",
  Oceania: "AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS",
  "South America": "AR BO BR CL CO EC FK GF GY PE PY SR UY VE",
};

const BY_CODE = new Map<string, Continent>(
  CONTINENTS.flatMap((continent) =>
    CODES[continent].split(" ").map((code) => [code, continent] as const),
  ),
);

export function continentOf(countryCode: string): Continent | null {
  return BY_CODE.get(countryCode.toUpperCase()) ?? null;
}

/** All codes in the lookup (for tests). */
export function knownCountryCodes(): string[] {
  return [...BY_CODE.keys()];
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });

/** English country name for an ISO code ("IE" → "Ireland"). */
export function countryName(countryCode: string): string {
  if (countryCode === "XK") return "Kosovo";
  return regionNames.of(countryCode.toUpperCase()) ?? countryCode;
}
