import { DEBUG_PANEL, DEBUG_ROUND_LINKS } from '../config';
import { handleEvent, type GameEvent } from '../events';

/** Mga test button sa labas ng #stage (hindi naka-scale). Bawat click → handleEvent. */
export function mountDebugPanel() {
  const panel = document.createElement('div');
  panel.className = 'debug-panel';
  const title = document.createElement('div');
  title.className = 'debug-title';
  title.textContent = 'TEST (pindot)';
  panel.append(title);
  const sections = [
    { title: '', buttons: DEBUG_PANEL.buttons, cls: '' },
    { title: 'HALIMAW (versus)', buttons: DEBUG_PANEL.villainButtons, cls: 'villain' },
  ];
  for (const sec of sections) {
    if (sec.title) {
      const t = document.createElement('div');
      t.className = 'debug-title';
      t.textContent = sec.title;
      panel.append(t);
    }
    for (const b of sec.buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (sec.cls) btn.className = sec.cls;
      btn.addEventListener('click', () => {
        const users = DEBUG_PANEL.users;
        const user = users[Math.floor(Math.random() * users.length)] ?? 'debug';
        handleEvent({ ...b.event, user } as GameEvent);
      });
      panel.append(btn);
    }
  }
  // Maikling round para sa testing (nire-reload ang page na may ?round=N)
  const sub = document.createElement('div');
  sub.className = 'debug-title';
  sub.textContent = 'Haba ng round';
  panel.append(sub);
  for (const secs of DEBUG_ROUND_LINKS) {
    const a = document.createElement('a');
    a.href = `?debug&round=${secs}`;
    a.textContent = `▶ ${secs} segundo`;
    panel.append(a);
  }
  const reset = document.createElement('a');
  reset.href = '?debug';
  reset.textContent = '↺ Normal (5 minuto)';
  panel.append(reset);
  document.body.append(panel);
}
