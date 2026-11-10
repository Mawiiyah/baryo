import { CAM_PICKER } from '../config';
import type { CamModeId } from '../render/CameraOrbit';

const isMode = (v: string | null): v is CamModeId => CAM_PICKER.modes.some((m) => m.id === v);

/**
 * Button na "🎥 CAMERA" sa kanang-ibaba: pagpili ng POV (Normal, Free Cam, nakatutok sa laban…).
 * Naaalala ang pinili (localStorage). Lumalabas lang kapag gumalaw ang mouse (malinis sa OBS).
 */
export function mountCamPicker(setMode: (id: CamModeId) => void) {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(CAM_PICKER.storageKey);
  } catch {
    /* walang storage */
  }
  let current: CamModeId = isMode(saved) ? saved : CAM_PICKER.defaultMode;

  const root = document.createElement('div');
  root.className = 'map-picker cam-picker hidden';
  const toggle = document.createElement('button');
  toggle.className = 'map-toggle';
  const menu = document.createElement('div');
  menu.className = 'map-menu';
  const options = CAM_PICKER.modes.map((m) => {
    const btn = document.createElement('button');
    btn.className = 'map-option';
    btn.innerHTML = `<span>${m.label}</span><small>${m.desc}</small>`;
    btn.addEventListener('click', () => {
      choose(m.id);
      root.classList.remove('open');
    });
    menu.append(btn);
    return { id: m.id, btn };
  });

  const choose = (id: CamModeId) => {
    current = id;
    setMode(id);
    const m = CAM_PICKER.modes.find((x) => x.id === id);
    toggle.textContent = `🎥 CAMERA: ${m?.label ?? id}`;
    for (const o of options) o.btn.classList.toggle('active', o.id === id);
    try {
      localStorage.setItem(CAM_PICKER.storageKey, id);
    } catch {
      /* ok lang */
    }
  };
  choose(current);

  toggle.addEventListener('click', () => root.classList.toggle('open'));
  root.append(menu, toggle);
  document.body.append(root);

  // Auto-hide para hindi makita sa stream kapag hindi ginagamit
  let timer = 0;
  const show = () => {
    root.classList.remove('hidden');
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (root.matches(':hover')) return;
      root.classList.add('hidden');
      root.classList.remove('open');
    }, CAM_PICKER.autoHideMs);
  };
  window.addEventListener('mousemove', show);
  root.addEventListener('mouseleave', show);
}
