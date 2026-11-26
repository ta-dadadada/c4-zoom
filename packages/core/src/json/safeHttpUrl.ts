export function safeHttpUrl(url?: string): string | undefined {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch {
    // 不正な URL はリンクにしない。
  }
}
