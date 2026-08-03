/**
 * WhatsApp prefilled `text=` corrupts astral-plane emoji into �.
 * Map the colorful display set → BMP-safe marks for the WA URL only (no extra LLM).
 * Keep longer / ZWJ sequences first so they replace before their parts.
 */
const WHATSAPP_SAFE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["\u{1F3F3}\uFE0F\u200D\u{1F308}", "\u{2665}"], // 🏳️‍🌈 → ♥
  ["\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", "\u{263A}"], // 👨‍👩‍👧 → ☺
  ["\u{1F6CB}\uFE0F", "\u{2692}"], // 🛋️ → ⚒
  ["\u{1F32C}\uFE0F", "\u{2601}"], // 🌬️ → ☁
  ["\u{2744}\uFE0F", "\u{2744}"], // ❄️ → ❄
  ["\u{2668}\uFE0F", "\u{2668}"], // ♨️ → ♨
  ["\u{1F517}", "\u{27A1}"], // 🔗 → ➡
  ["\u{1F3E0}", "\u{2605}"], // 🏠 → ★
  ["\u{1F3E1}", "\u{2605}"], // 🏡 → ★
  ["\u{1F4F6}", "\u{26A1}"], // 📶 → ⚡
  ["\u{1F4A7}", "\u{2602}"], // 💧 → ☂
  ["\u{1F4A1}", "\u{2600}"], // 💡 → ☀
  ["\u{1F525}", "\u{2668}"], // 🔥 → ♨
  ["\u{1F43E}", "\u{2665}"], // 🐾 → ♥
  ["\u{1F697}", "\u{25B6}"], // 🚗 → ▶
  ["\u{1F6BF}", "\u{2668}"], // 🚿 → ♨
  ["\u{1F6AC}", "\u{2601}"], // 🚬 → ☁
  ["\u{1F300}", "\u{2601}"], // 🌀 → ☁
  ["\u{1F455}", "\u{25AA}"], // 👕 → ▪
  ["\u{1F389}", "\u{2728}"], // 🎉 → ✨
  ["\u{1F510}", "\u{2713}"], // 🔐 → ✓
  ["\u{1F440}", "\u{25C9}"], // 👀 → ◉
  ["\u{1F9FA}", "\u{2668}"], // 🧺 → ♨
  ["\u{1FAE7}", "\u{2705}"], // 🫧 → ✅
  ["\u{1F373}", "\u{2615}"], // 🍳 → ☕
  ["\u{1F33F}", "\u{2618}"], // 🌿 → ☘
  ["\u{1F4BC}", "\u{2726}"], // 💼 → ✦
  ["\u{1F4DA}", "\u{270E}"], // 📚 → ✎
  ["\u{1FA7A}", "\u{271A}"], // 🩺 → ✚
  ["\u{1F4BB}", "\u{26A1}"], // 💻 → ⚡
  ["\u{1F9CD}", "\u{263A}"], // 🧍 → ☺
  ["\u{1F491}", "\u{2665}"], // 💑 → ♥
  ["\u{1F9FE}", "\u{2709}"], // 🧾 → ✉
  ["\u{1F512}", "\u{2713}"], // 🔒 → ✓
  ["\u{1F68C}", "\u{2708}"], // 🚌 → ✈
  ["\u{1F464}", "\u{263A}"], // 👤 → ☺
];

function hasAstralPlaneChar(text: string): boolean {
  for (const ch of text) {
    if ((ch.codePointAt(0) ?? 0) > 0xffff) return true;
  }
  return false;
}

/**
 * Cosmetic remap for WhatsApp URL prefill only.
 * Clipboard / Facebook / Instagram keep the colorful original text.
 */
export function toWhatsAppSafeShareText(text: string): string {
  let out = text;
  for (const [from, to] of WHATSAPP_SAFE_PAIRS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  // Any remaining astral emoji → generic BMP check (avoids � in WA URL).
  if (hasAstralPlaneChar(out)) {
    out = [...out].map((ch) => ((ch.codePointAt(0) ?? 0) > 0xffff ? "\u{2705}" : ch)).join("");
  }
  return out;
}
