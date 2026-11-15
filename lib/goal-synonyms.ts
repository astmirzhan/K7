// Typed goals that mean a suggested one: "Read books" is Reading, "jogging" is Running. Mapping them keeps people
// matchable on the map instead of each person ending up alone with their own wording. Pure: client and server.

const SYNONYMS: Record<string, string[]> = {
  running: ['run', 'runner', 'jog', 'jogging', 'marathon', '5k', '10k', 'half marathon', 'trail run'],
  cycling: ['bike', 'biking', 'cycle', 'bicycle', 'spin'],
  yoga: ['yogi', 'pilates', 'stretching'],
  gym: ['workout', 'work out', 'fitness', 'lift', 'lifting', 'weights', 'weightlifting', 'strength', 'strength training', 'exercise', 'crossfit', 'get fit', 'lose weight'],
  swimming: ['swim', 'pool', 'triathlon'],
  climbing: ['climb', 'bouldering', 'boulder', 'rock climbing'],
  pickleball: ['tennis', 'padel', 'badminton'],
  dance: ['dancing', 'salsa', 'bachata', 'ballet', 'hip hop'],
  hiking: ['hike', 'walk', 'walking', 'trekking', 'trails'],
  camping: ['camp', 'outdoors', 'backpacking'],
  gardening: ['garden', 'plants', 'houseplants'],
  birdwatching: ['birds', 'birding'],
  spanish: ['español', 'espanol', 'learn spanish'],
  french: ['français', 'francais', 'learn french'],
  japanese: ['nihongo', 'learn japanese'],
  guitar: ['ukulele', 'bass guitar'],
  piano: ['keyboard', 'keys'],
  singing: ['sing', 'vocal', 'vocals', 'karaoke', 'choir'],
  drawing: ['draw', 'sketch', 'sketching', 'painting', 'paint', 'illustration', 'art'],
  photography: ['photo', 'photos', 'camera', 'take photos'],
  writing: ['write', 'journal', 'journaling', 'blog', 'novel', 'poetry'],
  pottery: ['ceramics', 'clay'],
  cooking: ['cook', 'meal prep', 'recipes', 'eat healthy', 'healthy eating'],
  baking: ['bake', 'bread', 'pastry'],
  chess: ['board game chess'],
  reading: ['read', 'read books', 'books', 'book', 'book club', 'read more', 'reading books'],
  meditation: ['meditate', 'mindfulness', 'breathwork', 'calm', 'stress less'],
  coding: ['code', 'programming', 'program', 'learn to code', 'web development', 'python', 'javascript'],
  volunteering: ['volunteer', 'charity', 'help others', 'community service'],
  'board-games': ['board game', 'boardgames', 'tabletop', 'dnd', 'd&d', 'card games'],
};

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9&+ ]+/g, ' ').replace(/\s+/g, ' ').trim();

const INDEX = new Map<string, string>();
for (const [slug, words] of Object.entries(SYNONYMS)) {
  INDEX.set(norm(slug.replace(/-/g, ' ')), slug);
  for (const w of words) INDEX.set(norm(w), slug);
}

/** The suggested goal a typed one means, or null. Exact phrase first, then any whole word ("read more books"). */
export function suggestedSlugFor(typed: string): string | null {
  const t = norm(typed);
  if (!t) return null;
  const exact = INDEX.get(t);
  if (exact) return exact;
  for (const word of t.split(' ')) {
    if (word.length < 3) continue;
    const hit = INDEX.get(word);
    if (hit) return hit;
  }
  return null;
}
