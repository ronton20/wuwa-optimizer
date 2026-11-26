import { useRef } from 'react';
import { useBuilds } from '../../state/buildStore';
import { useSettings } from '../../state/settings';
import { ui } from '../../strings/en';

const APP = 'wuwa-optimizer';

/** Footer links: download everything as a JSON file, or load one back (replaces current data after a confirm). */
export function DataButtons() {
  const file = useRef<HTMLInputElement>(null);
  const exportAll = () => {
    const { builds, saved, teams, mainTeam, rotations } = useBuilds.getState();
    const { focus } = useSettings.getState();
    const blob = new Blob([JSON.stringify({ app: APP, version: 1, exportedAt: new Date().toISOString(), builds, saved, teams, mainTeam, rotations, settings: { focus } }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wuwa-optimizer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importFile = async (f: File) => {
    try {
      const d = JSON.parse(await f.text());
      if (d?.app !== APP || typeof d.builds !== 'object') throw new Error('not ours');
      if (!confirm(ui.importConfirm)) return;
      useBuilds.getState().importAll({ builds: d.builds, saved: Array.isArray(d.saved) ? d.saved : [], teams: Array.isArray(d.teams) ? d.teams : [], mainTeam: typeof d.mainTeam === 'string' ? d.mainTeam : null, rotations: Array.isArray(d.rotations) ? d.rotations : [] });
      if (d.settings?.focus === 'avg' || d.settings?.focus === 'crit') useSettings.getState().setFocus(d.settings.focus);
    } catch {
      alert(ui.importFailed);
    }
  };
  return (
    <p className="space-x-3">
      <button className="hover:text-gold" onClick={exportAll}>{ui.exportData}</button>
      <span className="opacity-40">·</span>
      <button className="hover:text-gold" onClick={() => file.current?.click()}>{ui.importData}</button>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
    </p>
  );
}
