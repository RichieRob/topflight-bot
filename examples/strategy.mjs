// Example only: a small price swing strategy. Supply your own entry/exit levels.
// Current payoutShare is a yield allocation, not a fair price or a settlement value.
// Keys are actual listed club ids from snapshot, never array offsets.
const levels = new Map(); // e.g. [[clubId, { entry: 0.04, exit: 0.06 }]]

export function decide({ clubs, book }) {
  for (const club of clubs) {
    const level = levels.get(club.id);
    if (!level) continue;
    if (Number(club.held) > 1 && Number(club.price) >= level.exit) {
      return { sell: club.id, tokens: (Number(club.held) * 0.35).toFixed(6) };
    }
    if (Number(club.price) <= level.entry && Number(book.cash) >= 8 && clubs.filter(c => Number(c.held) > 0).length < 4) {
      return { buy: club.id, usd: '8' };
    }
  }
  return null;
}
