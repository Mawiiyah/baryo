import {
  ATTACKERS,
  BASE,
  BOSSES,
  CHAT,
  DEFENDERS,
  FOLLOW,
  GIFTS,
  HUD,
  ICONS,
  ROUND,
  SPAWN,
  VILLAIN_CHAT,
  VILLAIN_GIFTS,
  type BossKind,
  type UnitKind,
  type DefenderKind,
  type AttackerKind,
} from '../config';
import type { World, WorldEvent } from '../sim/World';
import type { NetStatus } from '../systems/Net';
import { giftIconEl, onGiftIconsChange } from './giftIcons';
import { pixelEmoji } from './pixel';
import './hud.css';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};

const fmtTime = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** HTML/CSS overlay sa ibabaw ng 3D canvas. */
export class Hud {
  private root = h('div', 'hud');
  private scoreNum = h('span', 'wave-num');
  private roundLabel = h('span', 'round-label');
  private roundFill = h('div', 'fill');
  /** Kabuuang coins at top gifter ng bawat panig. */
  private teams = {
    defender: { total: h('span', 'team-total'), name: h('span', 'team-name'), coins: h('span', 'team-coins') },
    attacker: { total: h('span', 'team-total'), name: h('span', 'team-name'), coins: h('span', 'team-coins') },
  };
  private timer = h('span', 'timer-text');
  private timerLabel = h('span', 'timer-label');
  private netDot = h('span', 'net-dot');
  private hpFill = h('div', 'fill');
  private hpText = h('span', 'bar-text');
  private likeFill = h('div', 'fill');
  private likeText = h('span', 'bar-text');
  private defCount = h('span', 'big');
  private defFill = h('div', 'fill');
  private killCount = h('span', 'big');
  private remainCount = h('span', 'big bad');
  private toasts = h('div', 'toasts');
  private overlay = h('div', 'overlay hidden');
  private overTitle = h('div', 'over-title');
  private overSub = h('div', 'over-sub');
  private overCount = h('div', 'over-count');
  private net: NetStatus = 'connecting';

  constructor(parent: HTMLElement, private world: World, private portraits: Record<UnitKind, string>) {
    const r = this.root;
    r.style.setProperty('--safe-top', `${HUD.safeTop}px`);
    r.style.setProperty('--safe-bottom', `${HUD.safeBottom}px`);
    r.style.setProperty('--side', `${HUD.sidePad}px`);
    r.style.setProperty('--col-w', `${HUD.columnWidth}px`);
    r.style.setProperty('--font', HUD.font);

    // Itaas-kaliwa: score → likes → BAYANI coins; itaas-kanan: oras → HALIMAW coins
    const wave = h('div', 'panel wave');
    const score = h('div', 'score');
    score.append(this.roundLabel, this.scoreNum);
    wave.append(pixelEmoji('🏮', 'wave-icon'), score, barEl(this.roundFill, 'wave-bar'));
    const timer = h('div', 'panel timer');
    timer.append(this.netDot, this.timerLabel, this.timer);

    // Base HP at likes
    const hp = h('div', 'hp-row');
    hp.append(pixelEmoji('🛖', 'hp-icon'), barEl(this.hpFill, 'hp-bar', this.hpText));
    const likes = h('div', 'like-row');
    likes.append(pixelEmoji(ICONS.like, 'like-icon'), barEl(this.likeFill, 'like-bar', this.likeText));
    const leftStack = h('div', 'stack-col left-stack');
    leftStack.append(wave, likes, this.teamBox('defender', 'BAYANI'));
    const rightStack = h('div', 'stack-col right-stack');
    rightStack.append(timer, this.teamBox('attacker', 'HALIMAW'));

    // Kaliwa: BAYANI, kanan: HALIMAW (versus) — paano tumulong / umatake
    const heroes = h('div', 'col heroes');
    const heroRows = h('div', 'col-rows');
    heroes.append(h('div', 'col-title', 'BAYANI'), heroRows);
    const villains = h('div', 'col villains');
    const villainRows = h('div', 'col-rows');
    villains.append(h('div', 'col-title bad', 'HALIMAW'), villainRows);
    const showGuide = new URLSearchParams(window.location.search).has('guide');

    const fillColumns = () => {
      if (showGuide) {
        // Guide mode (?guide): ipinapakita ang TikTok gifts at coins
        const giftRow = (gift: string, coins: number) => {
          const icon = giftIconEl(gift, 'badge-img');
          const cap = h('div', 'caption value');
          if (icon.classList.contains('emoji')) cap.append(h('span', 'gname', gift));
          cap.append(pixelEmoji('⭐', 'coin'), h('span', '', String(coins)));
          return { icon, caption: cap };
        };
        type Row = { icon: HTMLElement | string; caption: string | HTMLElement; unit: UnitKind; n: number };
        const heroList: Row[] = [
          { icon: ICONS.like, caption: `${SPAWN.likesPerTanod} EXP`, unit: 'tanod', n: 1 },
          ...Object.entries(GIFTS).map(([gift, m]) => ({ ...giftRow(gift, m.coins), unit: m.unit, n: m.perGift })),
          { icon: ICONS.follow, caption: 'HERO', unit: FOLLOW.unit, n: FOLLOW.count },
          ...Object.entries(CHAT.commands).map(([cmd, unit]) => ({ icon: ICONS.chat, caption: cmd, unit, n: 1 })),
        ];
        const villainList: Row[] = [
          ...Object.entries(VILLAIN_GIFTS).map(([gift, m]) => ({ ...giftRow(gift, m.coins), unit: m.unit, n: m.perGift })),
          ...Object.entries(VILLAIN_CHAT).map(([cmd, unit]) => ({ icon: ICONS.chat, caption: cmd, unit, n: 1 })),
        ];
        const all = { ...DEFENDERS, ...ATTACKERS };
        const toRow = (r: Row) => this.iconRow(r.unit, `X${r.n}`, r.icon, r.caption, all[r.unit].name);
        heroRows.replaceChildren(...heroList.map(toRow));
        villainRows.replaceChildren(...villainList.map(toRow));
      } else {
        // Anti-Ban Safe Mode (Default): Malalaking Gift Icons LANG, walang coins/gifts text sa OCR ng TikTok
        const heroRoster: { unit: DefenderKind; gift: string; count: number }[] = [
          { unit: 'tanod', gift: 'Rose', count: 2 },
          { unit: 'malupiton', gift: 'Ice Cream Cone', count: 1 },
          { unit: 'anito', gift: 'Finger Heart', count: 1 },
          { unit: 'sarimanok', gift: 'Dolphin', count: 1 },
          { unit: 'higante', gift: 'Bravo!', count: 1 },
          { unit: 'haliya', gift: 'Doughnut', count: 1 },
        ];
        const villainRoster: { unit: AttackerKind; gift: string; count: number }[] = [
          { unit: 'aswang', gift: 'GG', count: 2 },
          { unit: 'manananggal', gift: 'Heart Me', count: 1 },
          { unit: 'tikbalang', gift: 'Panda', count: 2 },
          { unit: 'mangkukulam', gift: 'Rosa', count: 1 },
          { unit: 'kapre', gift: 'Gold Boxing Gloves', count: 1 },
          { unit: 'bakunawa', gift: 'Capybara', count: 1 },
        ];
        heroRows.replaceChildren(...heroRoster.map((r) => this.cleanUnitRow(r.unit, DEFENDERS[r.unit].name, r.gift, r.count)));
        villainRows.replaceChildren(...villainRoster.map((r) => this.cleanUnitRow(r.unit, ATTACKERS[r.unit].name, r.gift, r.count)));
      }
    };
    fillColumns();
    onGiftIconsChange(fillColumns);

    // Ibaba: defenders at kills
    const bl = h('div', 'panel bottom-left');
    const tanodImg = h('img', 'mini');
    tanodImg.src = portraits.tanod;
    const blInner = h('div', 'stack');
    blInner.append(this.defCount, barEl(this.defFill, 'def-bar'));
    bl.append(tanodImg, blInner);
    const br = h('div', 'panel bottom-right');
    br.append(pixelEmoji('💀', 'skull'), this.killCount, pixelEmoji('👹', 'skull'), this.remainCount);


    const banner = h('div', 'banner-layer');
    this.overlay.append(this.overTitle, this.overSub, this.overCount);
    r.append(leftStack, rightStack, hp, heroes, villains, bl, br, this.toasts, banner, this.overlay);
    parent.appendChild(r);

    world.on((e) => this.onWorld(e));
    // Unang round: nagsimula na bago pa nakinig ang HUD
    setTimeout(() => this.banner(`ROUND ${world.round}`, 'LABAN! Bayani vs Halimaw', false), ROUND.firstBannerDelayMs);
  }

  /** Kahon: "BAYANI ⭐ kabuuan" at sa ilalim "👑 top contributor ⭐ pts". */
  private teamBox(side: 'defender' | 'attacker', label: string) {
    const t = this.teams[side];
    const box = h('div', `panel team-box ${side}`);
    const row1 = h('div', 'team-row');
    row1.append(h('span', 'team-label', label), pixelEmoji('⭐', 'coin'), t.total);
    const row2 = h('div', 'team-row small');
    row2.append(pixelEmoji('👑', 'crown'), t.name, t.coins);
    box.append(row1, row2);
    return box;
  }

  setNet(s: NetStatus) {
    this.net = s;
  }

  private cleanUnitRow(unit: UnitKind, name: string, giftName: string, count: number) {
    const row = h('div', 'icon-row clean-card');
    row.title = `${name} (${giftName})`;

    const cardPair = h('div', 'card-pair');

    // Unit portrait
    const pic = h('div', 'pic');
    const img = h('img');
    img.src = this.portraits[unit];
    pic.append(img);

    // Malaking Gift Icon (walang coins o pangalan ng gift)
    const giftBox = h('div', 'big-gift-box');
    const gIcon = giftIconEl(giftName, 'big-gift-img', 54);
    giftBox.append(gIcon);

    cardPair.append(pic, giftBox);

    const labelText = count > 1 ? `${name} x${count}` : name;
    row.append(cardPair, h('div', 'clean-name', labelText));
    return row;
  }

  private iconRow(unit: UnitKind, count: string, badge: HTMLElement | string, caption: string | HTMLElement, title: string) {
    const row = h('div', 'icon-row');
    row.title = title;
    const pic = h('div', 'pic');
    const img = h('img');
    img.src = this.portraits[unit];
    pic.append(img);
    if (typeof badge !== 'string') {
      badge.classList.add('badge');
      pic.append(badge);
    } else if (badge) pic.append(pixelEmoji(badge, 'badge'));
    row.append(pic, h('div', 'count', count));
    if (typeof caption !== 'string') row.append(caption);
    else if (caption) row.append(h('div', 'caption', caption));
    return row;
  }

  private onWorld(e: WorldEvent) {
    switch (e.type) {
      case 'gift': {
        const uName = ({ ...DEFENDERS, ...ATTACKERS })[e.unit].name;
        this.toast(
          `${e.user} nagpadala ng ${e.n > 1 ? `${e.n}x ` : ''}${uName}!`,
          e.side === 'attacker' ? 'villain' : 'gift',
          giftIconEl(e.gift, 'toast-icon'),
        );
        break;
      }
      case 'follow':
        this.toast(`${e.user} sumali sa laban!`, 'follow', pixelEmoji(ICONS.follow, 'toast-icon'));
        break;
      case 'chat':
        this.toast(`${e.user}: ${e.msg}`, 'chat', pixelEmoji(ICONS.chat, 'toast-icon'));
        break;
      case 'round':
        this.banner(`ROUND ${e.round}`, 'LABAN! Bayani vs Halimaw', false);
        break;
      case 'spawn':
        // Boss na pinadala ng viewer → malaking anunsyo
        if (e.unit.stats.boss && e.unit.owner) {
          this.banner(`${e.unit.stats.name.toUpperCase()}!`, `mula kay ${e.unit.owner} - ${BOSSES[e.unit.kind as BossKind].intro}`, true);
        }
        break;
      case 'over':
        this.overTitle.textContent = e.won ? 'PANALO ANG BAYANI!' : 'PANALO ANG HALIMAW!';
        this.overTitle.classList.toggle('won', e.won);
        this.overSub.textContent = `Round ${e.round}: BAYANI ${this.world.score.bayani} - ${this.world.score.halimaw} HALIMAW`;
        this.overlay.classList.remove('hidden');
        break;
      case 'reset':
        this.overlay.classList.add('hidden');
        break;
      default:
        break;
    }
  }

  private toast(text: string, kind: string, icon?: HTMLElement) {
    const t = h('div', `toast ${kind}`);
    if (icon) t.append(icon);
    t.append(text);
    this.toasts.prepend(t);
    while (this.toasts.children.length > HUD.toastMax) this.toasts.lastElementChild?.remove();
    setTimeout(() => {
      t.classList.add('out');
      t.addEventListener('animationend', () => t.remove());
    }, HUD.toastMs);
  }

  private banner(title: string, sub: string, boss: boolean) {
    const layer = this.root.querySelector('.banner-layer')!;
    layer.replaceChildren();
    const b = h('div', `banner${boss ? ' boss' : ''}`);
    b.style.animationDuration = `${HUD.bannerMs}ms`;
    b.append(h('div', 'banner-title', title), h('div', 'banner-sub', sub));
    layer.append(b);
    b.addEventListener('animationend', () => b.remove());
  }

  update() {
    const w = this.world;
    // Score: BAYANI (berde) - HALIMAW (pula), at progreso ng oras ng round
    this.roundLabel.textContent = `ROUND ${w.round}`;
    this.scoreNum.innerHTML = `<b class="good">${w.score.bayani}</b><small>-</small><b class="bad">${w.score.halimaw}</b>`;
    this.roundFill.style.width = `${(1 - w.msLeft / w.roundDurationMs) * 100}%`;

    // Puntos (PTS) at top contributor ng bawat panig ("WALA PA" kapag wala pa)
    for (const side of ['defender', 'attacker'] as const) {
      const t = this.teams[side];
      const top = w.topContributor(side);
      t.total.textContent = `${w.totalCoins(side)} PTS`;
      t.name.textContent = top ? top.user : 'WALA PA';
      t.coins.textContent = top ? `${top.coins} PTS` : '';
    }

    const warn = w.msLeft <= ROUND.warnMs;
    this.timerLabel.textContent = 'ORAS';
    this.timerLabel.classList.toggle('bad', warn);
    this.timer.classList.toggle('bad', warn);

    this.timer.textContent = fmtTime(w.msLeft);
    this.netDot.className = `net-dot ${this.net}`;
    this.netDot.title = `bridge: ${this.net}`;

    const hpR = w.baseHp / BASE.hp;
    this.hpFill.style.width = `${hpR * 100}%`;
    this.hpFill.className = `fill ${hpR < HUD.hpDanger ? 'danger' : hpR < HUD.hpWarn ? 'warn' : ''}`;
    this.hpText.textContent = `${Math.ceil(hpR * 100)}%`;
    this.likeFill.style.width = `${(w.likes / SPAWN.likesPerTanod) * 100}%`;
    this.likeText.textContent = `${w.likes}/${SPAWN.likesPerTanod} EXP > ${DEFENDERS.tanod.name}`;

    this.defCount.innerHTML = `${w.defenders.length}<small>/${SPAWN.maxDefenders}</small>${w.queued ? ` <em>+${w.queued}</em>` : ''}`;
    this.defFill.style.width = `${(w.defenders.length / SPAWN.maxDefenders) * 100}%`;
    this.killCount.textContent = String(w.kills);

    // Natitirang halimaw (buhay + parating)
    this.remainCount.textContent = String(w.remaining);

    if (w.state === 'over') this.overCount.textContent = `Bagong laban sa ${Math.ceil(w.msToRestart / 1000)}s...`;
  }
}

function barEl(fill: HTMLElement, cls: string, text?: HTMLElement) {
  const bar = h('div', `bar ${cls}`);
  bar.append(fill);
  if (text) bar.append(text);
  return bar;
}
