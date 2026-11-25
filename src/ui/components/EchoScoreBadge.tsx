import type { EchoScore } from '../../engine';

export const GRADE_COLOR: Record<EchoScore['grade'], string> = { SS: '#f6d777', S: '#f0b45e', A: '#c08bff', B: '#6fb7ff', C: '#9aa3b5', D: '#ff6b8b' };

/** "60.4 A" in the grade's colour. */
/** `solid` = opaque background, for use on top of a picture. */
export function EchoScoreBadge({ s, size = 'sm', solid }: { s: EchoScore; size?: 'sm' | 'lg'; solid?: boolean }) {
  const c = GRADE_COLOR[s.grade];
  const why = s.subs.filter((x) => x.points > 0.05).map((x) => `${x.stat} +${x.points.toFixed(1)}`).join(', ');
  return (
    <span title={`Echo score ${s.score.toFixed(1)} / 100${why ? ` (${why})` : ''}`}
      className={`inline-flex items-baseline gap-1 rounded-md border px-1.5 tabular ${size === 'lg' ? 'py-0.5 text-sm' : 'text-[11px]'}`}
      style={{ borderColor: c + '88', background: solid ? 'rgba(7,12,24,0.88)' : c + '1a' }}>
      <span className="text-ink/90">{s.score.toFixed(1)}</span>
      <span className="font-display font-semibold" style={{ color: c }}>{s.grade}</span>
    </span>
  );
}
