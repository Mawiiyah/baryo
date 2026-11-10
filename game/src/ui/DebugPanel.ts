import { DEBUG_PANEL, DEBUG_ROUND_LINKS, MAP_PICKER, SCENE3D } from '../config';
import { handleEvent, type GameEvent } from '../events';
import type { MonsterFog } from '../render/MonsterFog';
import { chooseBattlefield } from './MapPicker';

/** Mga test button sa labas ng #stage (hindi naka-scale). Bawat click → handleEvent. */
export function mountDebugPanel(monsterFog?: MonsterFog) {
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
  // Pumili ng mapa (battlefield)
  const mapTitle = document.createElement('div');
  mapTitle.className = 'debug-title';
  mapTitle.textContent = 'MAPA (Battlefield)';
  panel.append(mapTitle);
  for (const m of MAP_PICKER.maps) {
    const btn = document.createElement('button');
    const isActive = SCENE3D.battlefield === m.id;
    btn.textContent = (isActive ? '▶ ' : '') + m.label;
    btn.addEventListener('click', () => chooseBattlefield(m.id));
    panel.append(btn);
  }

  // Atmospera (Monster Fog & Moon Overlay)
  if (monsterFog) {
    const fogTitle = document.createElement('div');
    fogTitle.className = 'debug-title';
    fogTitle.textContent = 'ATMOSPERA (Monster Fog & Moon)';
    panel.append(fogTitle);

    let fogOn = true;
    const toggleFogBtn = document.createElement('button');
    toggleFogBtn.textContent = '👻 Monster Fog: ON';
    toggleFogBtn.addEventListener('click', () => {
      fogOn = !fogOn;
      monsterFog.setEnabled(fogOn);
      toggleFogBtn.textContent = `👻 Monster Fog: ${fogOn ? 'ON' : 'OFF'}`;
    });
    panel.append(toggleFogBtn);

    const flareBtn = document.createElement('button');
    flareBtn.textContent = '🔥 Eerie Eye Flare';
    flareBtn.addEventListener('click', () => monsterFog.triggerFlare(2000));
    panel.append(flareBtn);

    let bloodOn = false;
    const bloodBtn = document.createElement('button');
    bloodBtn.textContent = '🩸 Blood Moon';
    bloodBtn.addEventListener('click', () => {
      bloodOn = !bloodOn;
      monsterFog.setBloodMoon(bloodOn);
      bloodBtn.textContent = bloodOn ? '🌕 Normal Moon' : '🩸 Blood Moon';
    });
    panel.append(bloodBtn);
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
