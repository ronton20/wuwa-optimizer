/**
 * Which characters go into the snapshot: every playable Resonator (RoleType 1, not a trial copy).
 * Rover has a male and a female entry per element with identical kits; only the first is kept.
 */
export function pickRoster(roleInfo: any[], name: (key: unknown) => string): number[] {
  const seen = new Set<string>();
  return roleInfo
    .filter((r) => r.RoleType === 1 && !r.IsTrial)
    .sort((a, b) => a.Id - b.Id)
    .filter((r) => { const n = name(r.Name); if (!n || seen.has(n)) return false; seen.add(n); return true; })
    .map((r) => r.Id);
}
