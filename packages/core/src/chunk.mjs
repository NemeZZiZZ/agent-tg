const LIMIT = 4096; // Telegram sendMessage text cap, UTF-16 units

/**
 * Split text into Telegram-sized chunks (≤ 4096 UTF-16 units each).
 * Prefers cutting after the last "\n" inside the 4096-unit window;
 * otherwise hard-cuts, backing off one unit when the cut would split
 * a surrogate pair. chunks.join("") always reassembles the input.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function chunkText(text) {
  if (text === "") return [];
  if (text.length <= LIMIT) return [text];

  let cut = LIMIT;
  const nl = text.lastIndexOf("\n", LIMIT - 1);
  if (nl !== -1) {
    cut = nl + 1;
  } else {
    const boundary = text.charCodeAt(LIMIT - 1);
    if (boundary >= 0xd800 && boundary <= 0xdbff) cut = LIMIT - 1; // high surrogate: its low half is at LIMIT
  }
  return [text.slice(0, cut), ...chunkText(text.slice(cut))];
}
