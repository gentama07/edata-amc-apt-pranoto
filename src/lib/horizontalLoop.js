export function advanceHorizontalLoop(current, maxScroll, elapsedMs) {
  const limit = Math.max(0, maxScroll);
  const elapsed = Math.max(0, elapsedMs);
  if (limit <= 1) return { position: 0, holdRemaining: 0 };

  if (current.holdRemaining > 0) {
    const holdRemaining = Math.max(0, current.holdRemaining - elapsed);
    return { position: holdRemaining > 0 ? Math.min(current.position, limit) : 0, holdRemaining };
  }

  const position = Math.min(limit, Math.max(0, current.position) + elapsed * 0.05);
  return { position, holdRemaining: position >= limit ? 5000 : 0 };
}
