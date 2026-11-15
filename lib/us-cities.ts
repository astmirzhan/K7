import type { UsState } from './types';

// [longitude, latitude] of cities people live in (seed + common answers). The map places a person at their
// city when it is listed here, otherwise near the middle of their state. City only — never an address.
export const US_CITIES: Partial<Record<UsState, Record<string, [number, number]>>> = {
  AL: { Birmingham: [-86.8, 33.52], Montgomery: [-86.3, 32.37], Huntsville: [-86.59, 34.73] },
  AK: { Anchorage: [-149.9, 61.22], Juneau: [-134.42, 58.3] },
  AZ: { Phoenix: [-112.07, 33.45], Tucson: [-110.97, 32.22], Scottsdale: [-111.93, 33.49], Flagstaff: [-111.65, 35.2] },
  AR: { 'Little Rock': [-92.29, 34.75], Fayetteville: [-94.16, 36.06] },
  CA: { 'Los Angeles': [-118.24, 34.05], 'San Francisco': [-122.42, 37.77], 'San Diego': [-117.16, 32.72], 'San Jose': [-121.89, 37.34], Sacramento: [-121.49, 38.58], Oakland: [-122.27, 37.8], Fresno: [-119.79, 36.74] },
  CO: { Denver: [-104.99, 39.74], Boulder: [-105.27, 40.01], 'Colorado Springs': [-104.82, 38.83] },
  CT: { Hartford: [-72.68, 41.76], 'New Haven': [-72.93, 41.31], Stamford: [-73.54, 41.05] },
  DE: { Wilmington: [-75.55, 39.74], Dover: [-75.52, 39.16] },
  DC: { Washington: [-77.04, 38.91] },
  FL: { Miami: [-80.19, 25.76], Orlando: [-81.38, 28.54], Tampa: [-82.46, 27.95], Jacksonville: [-81.66, 30.33], Tallahassee: [-84.28, 30.44] },
  GA: { Atlanta: [-84.39, 33.75], Savannah: [-81.1, 32.08], Athens: [-83.38, 33.95] },
  HI: { Honolulu: [-157.86, 21.31], Hilo: [-155.09, 19.71] },
  ID: { Boise: [-116.2, 43.62], 'Coeur d’Alene': [-116.78, 47.68] },
  IL: { Chicago: [-87.63, 41.88], Springfield: [-89.65, 39.78], Evanston: [-87.69, 42.05] },
  IN: { Indianapolis: [-86.16, 39.77], Bloomington: [-86.53, 39.17] },
  IA: { 'Des Moines': [-93.61, 41.59], 'Iowa City': [-91.53, 41.66] },
  KS: { Wichita: [-97.34, 37.69], 'Kansas City': [-94.63, 39.11], Lawrence: [-95.24, 38.97] },
  KY: { Louisville: [-85.76, 38.25], Lexington: [-84.5, 38.04] },
  LA: { 'New Orleans': [-90.07, 29.95], 'Baton Rouge': [-91.19, 30.45] },
  ME: { Portland: [-70.26, 43.66], Bangor: [-68.77, 44.8] },
  MD: { Baltimore: [-76.61, 39.29], Annapolis: [-76.49, 38.98] },
  MA: { Boston: [-71.06, 42.36], Cambridge: [-71.11, 42.37], Worcester: [-71.8, 42.26] },
  MI: { Detroit: [-83.05, 42.33], 'Ann Arbor': [-83.74, 42.28], 'Grand Rapids': [-85.67, 42.96] },
  MN: { Minneapolis: [-93.27, 44.98], 'Saint Paul': [-93.09, 44.95], Duluth: [-92.1, 46.79] },
  MS: { Jackson: [-90.18, 32.3], Oxford: [-89.52, 34.37] },
  MO: { 'St. Louis': [-90.2, 38.63], 'Kansas City': [-94.58, 39.1], Columbia: [-92.33, 38.95] },
  MT: { Bozeman: [-111.04, 45.68], Missoula: [-113.99, 46.87], Billings: [-108.5, 45.78] },
  NE: { Omaha: [-95.93, 41.26], Lincoln: [-96.68, 40.81] },
  NV: { 'Las Vegas': [-115.14, 36.17], Reno: [-119.81, 39.53] },
  NH: { Manchester: [-71.46, 42.99], Portsmouth: [-70.76, 43.07] },
  NJ: { Newark: [-74.17, 40.74], 'Jersey City': [-74.08, 40.73], Princeton: [-74.66, 40.36] },
  NM: { Albuquerque: [-106.65, 35.08], 'Santa Fe': [-105.94, 35.69] },
  NY: { 'New York': [-74.0, 40.71], Brooklyn: [-73.95, 40.68], Buffalo: [-78.88, 42.89], Rochester: [-77.61, 43.16], Albany: [-73.76, 42.65] },
  NC: { Raleigh: [-78.64, 35.78], Charlotte: [-80.84, 35.23], Durham: [-78.9, 35.99], Asheville: [-82.55, 35.6] },
  ND: { Fargo: [-96.79, 46.88], Bismarck: [-100.78, 46.81] },
  OH: { Columbus: [-83.0, 39.96], Cleveland: [-81.69, 41.5], Cincinnati: [-84.51, 39.1] },
  OK: { 'Oklahoma City': [-97.52, 35.47], Tulsa: [-95.99, 36.15] },
  OR: { Portland: [-122.68, 45.52], Eugene: [-123.09, 44.05], Bend: [-121.31, 44.06] },
  PA: { Philadelphia: [-75.17, 39.95], Pittsburgh: [-79.99, 40.44], Harrisburg: [-76.88, 40.27] },
  RI: { Providence: [-71.41, 41.82], Newport: [-71.31, 41.49] },
  SC: { Charleston: [-79.93, 32.78], Columbia: [-81.03, 34.0], Greenville: [-82.39, 34.85] },
  SD: { 'Sioux Falls': [-96.73, 43.55], 'Rapid City': [-103.23, 44.08] },
  TN: { Nashville: [-86.78, 36.16], Memphis: [-90.05, 35.15], Knoxville: [-83.92, 35.96], Chattanooga: [-85.31, 35.05] },
  TX: { Austin: [-97.74, 30.27], Dallas: [-96.8, 32.78], Houston: [-95.37, 29.76], 'San Antonio': [-98.49, 29.42], 'Fort Worth': [-97.33, 32.76], 'El Paso': [-106.49, 31.76] },
  UT: { 'Salt Lake City': [-111.89, 40.76], Provo: [-111.66, 40.23] },
  VT: { Burlington: [-73.21, 44.48], Montpelier: [-72.58, 44.26] },
  VA: { Richmond: [-77.44, 37.54], 'Virginia Beach': [-75.98, 36.85], Arlington: [-77.1, 38.88], Charlottesville: [-78.48, 38.03] },
  WA: { Seattle: [-122.33, 47.61], Spokane: [-117.43, 47.66], Tacoma: [-122.44, 47.25] },
  WV: { Charleston: [-81.63, 38.35], Morgantown: [-79.96, 39.63] },
  WI: { Milwaukee: [-87.91, 43.04], Madison: [-89.4, 43.07] },
  WY: { Cheyenne: [-104.82, 41.14], Casper: [-106.31, 42.87], Jackson: [-110.76, 43.48] },
};

/** Coordinates for a city typed by a person: exact name match within the state, case and spaces ignored. */
export function cityCoords(state: UsState, city: string): [number, number] | null {
  const list = US_CITIES[state];
  if (!list) return null;
  const key = city.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const [name, ll] of Object.entries(list)) if (name.toLowerCase() === key) return ll;
  return null;
}
