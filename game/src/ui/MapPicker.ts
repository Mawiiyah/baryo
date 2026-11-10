import { MAP_PICKER, SCENE3D } from '../config';

type MapId = typeof SCENE3D.battlefield;
const isMap = (v: string | null): v is MapId => MAP_PICKER.maps.some((m) => m.id === v);

/** Piliin ang battlefield bago gawin ang eksena: `?map=` > naka-save na pinili > default sa config. */
export function resolveBattlefield(params: URLSearchParams) {
  const fromUrl = params.get('map') || params.get('battlefield');
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(MAP_PICKER.storageKey);
  } catch {
    /* walang storage: default na lang */
  }
  const pick = isMap(fromUrl) ? fromUrl : isMap(saved) ? saved : null;
  if (pick) (SCENE3D as { battlefield: MapId }).battlefield = pick;
}

/** Ise-save ang pinili at ire-reload ang page (ginagawa ang 3D na eksena sa simula lang). */
export function chooseBattlefield(id: MapId) {
  try {
    localStorage.setItem(MAP_PICKER.storageKey, id);
  } catch {
    /* ok lang: nasa URL pa rin */
  }
  const sp = new URLSearchParams(location.search);
  sp.set('map', id);
  location.search = sp.toString();
}

/** Button na "MAPA" sa kaliwang-ibaba; lumalabas lang kapag gumalaw ang mouse. */
export function mountMapPicker() {
  const root = document.createElement('div');
  root.className = 'map-picker hidden';

  const toggle = document.createElement('button');
  toggle.className = 'map-toggle';
  const current = MAP_PICKER.maps.find((m) => m.id === SCENE3D.battlefield);
  toggle.textContent = `🗺️ MAPA: ${current?.label ?? SCENE3D.battlefield}`;

  const menu = document.createElement('div');
  menu.className = 'map-menu';
  for (const m of MAP_PICKER.maps) {
    const btn = document.createElement('button');
    btn.className = 'map-option' + (m.id === SCENE3D.battlefield ? ' active' : '');
    btn.innerHTML = `<span>${m.label}</span><small>${m.desc}</small>`;
    btn.addEventListener('click', () => {
      if (m.id !== SCENE3D.battlefield) chooseBattlefield(m.id);
      else root.classList.remove('open');
    });
    menu.append(btn);
  }

  toggle.addEventListener('click', () => root.classList.toggle('open'));
  root.append(menu, toggle);
  document.body.append(root);

  // Auto-hide para hindi makita sa stream kapag hindi ginagamit
  let timer = 0;
  const show = () => {
    root.classList.remove('hidden');
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (root.matches(':hover')) return; // ginagamit pa
      root.classList.add('hidden');
      root.classList.remove('open');
    }, MAP_PICKER.autoHideMs);
  };
  window.addEventListener('mousemove', show);
  root.addEventListener('mouseleave', show);
}
