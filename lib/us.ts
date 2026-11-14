import type { UsState } from './types';

export const STATE_NAMES: Record<UsState, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/**
 * Tile-grid positions (row, col) on an 8 x 11 grid. Use these if the design does not fix tile positions;
 * the look of a tile comes from the design.
 */
export const US_TILE_GRID = { rows: 8, cols: 11 } as const;
export const US_TILES: Record<UsState, { row: number; col: number }> = {
  AK: { row: 0, col: 0 }, ME: { row: 0, col: 10 },
  WI: { row: 1, col: 5 }, VT: { row: 1, col: 9 }, NH: { row: 1, col: 10 },
  WA: { row: 2, col: 0 }, ID: { row: 2, col: 1 }, MT: { row: 2, col: 2 }, ND: { row: 2, col: 3 },
  MN: { row: 2, col: 4 }, IL: { row: 2, col: 5 }, MI: { row: 2, col: 6 }, NY: { row: 2, col: 8 },
  MA: { row: 2, col: 9 },
  OR: { row: 3, col: 0 }, NV: { row: 3, col: 1 }, WY: { row: 3, col: 2 }, SD: { row: 3, col: 3 },
  IA: { row: 3, col: 4 }, IN: { row: 3, col: 5 }, OH: { row: 3, col: 6 }, PA: { row: 3, col: 7 },
  NJ: { row: 3, col: 8 }, CT: { row: 3, col: 9 }, RI: { row: 3, col: 10 },
  CA: { row: 4, col: 0 }, UT: { row: 4, col: 1 }, CO: { row: 4, col: 2 }, NE: { row: 4, col: 3 },
  MO: { row: 4, col: 4 }, KY: { row: 4, col: 5 }, WV: { row: 4, col: 6 }, VA: { row: 4, col: 7 },
  MD: { row: 4, col: 8 }, DE: { row: 4, col: 9 },
  AZ: { row: 5, col: 1 }, NM: { row: 5, col: 2 }, KS: { row: 5, col: 3 }, AR: { row: 5, col: 4 },
  TN: { row: 5, col: 5 }, NC: { row: 5, col: 6 }, SC: { row: 5, col: 7 }, DC: { row: 5, col: 8 },
  OK: { row: 6, col: 3 }, LA: { row: 6, col: 4 }, MS: { row: 6, col: 5 }, AL: { row: 6, col: 6 },
  GA: { row: 6, col: 7 },
  HI: { row: 7, col: 0 }, TX: { row: 7, col: 3 }, FL: { row: 7, col: 8 },
};
