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

/**
 * DOM write lang kapag nagbago ang value (tinatawag ang HUD kada frame; ang paulit-ulit na
 * textContent/innerHTML/style write ay nagpapabigat ng style recalc at layout habang tumatagal).
 */
const last = new WeakMap<HTMLElement, Map<string, string>>();
const put = (el: HTMLElement, key: 'text' | 'html' | 'width' | 'class' | 'title', val: string) => {
  let m = last.get(el);
  if (!m) last.set(el, (m = new Map()));
  if (m.get(key) === val) return;
  m.set(key, val);
  if (key === 'text') el.textContent = val;
  else if (key === 'html') el.innerHTML = val;
  else if (key === 'width') el.style.width = val;
  else if (key === 'class') el.className = val;
  else el.title = val;
};
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

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

  /** @param kuboHpSlot lalagyan sa ibabaw ng kubo (galing sa World3D) para sa HP bar ng kubo. */
  constructor(parent: HTMLElement, private world: World, private portraits: Record<UnitKind, string>, kuboHpSlot: HTMLElement) {
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

    // HP ng kubo (nasa ibabaw ng mismong kubo, hindi sa HUD) at likes
    const hp = h('div', 'hp-row');
    hp.append(barEl(this.hpFill, 'hp-bar', this.hpText));
    kuboHpSlot.append(hp);
    const likes = h('div', 'like-row');
    likes.append(pixelEmoji(ICONS.like, 'like-icon'), barEl(this.likeFill, 'like-bar', this.likeText));
    // Kaliwa: BAYANI, kanan: HALIMAW (versus) — paano tumulong / umatake.
    // Nakahanay sa ilalim ng kani-kanilang PTS box.
    const heroes = h('div', 'col heroes');
    const heroRows = h('div', 'col-rows');
    heroes.append(h('div', 'col-title', 'BAYANI'), heroRows);
    const villains = h('div', 'col villains');
    const villainRows = h('div', 'col-rows');
    villains.append(h('div', 'col-title bad', 'HALIMAW'), villainRows);
    const leftStack = h('div', 'stack-col left-stack');
    leftStack.append(wave, likes, this.teamBox('defender', 'BAYANI'), heroes);
    const rightStack = h('div', 'stack-col right-stack');
    rightStack.append(timer, this.teamBox('attacker', 'HALIMAW'), villains);
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
        // HUD cards: May Malalaking Gift Icons + Malinaw na TikTok Gift Name & Coins
        const heroRoster: { unit: DefenderKind; gift: string; count: number; coins: number }[] = [
          { unit: 'tanod', gift: 'Rose', count: 2, coins: 1 },
          { unit: 'malupiton', gift: 'Fire', count: 1, coins: 1 },
          { unit: 'anito', gift: 'Finger Heart', count: 1, coins: 5 },
          { unit: 'sarimanok', gift: 'I love you', count: 1, coins: 10 },
          { unit: 'higante', gift: 'Bravo!', count: 1, coins: 15 },
          { unit: 'haliya', gift: 'Doughnut', count: 1, coins: 30 },
        ];
        const villainRoster: { unit: AttackerKind; gift: string; count: number; coins: number }[] = [
          { unit: 'aswang', gift: 'GG', count: 2, coins: 1 },
          { unit: 'manananggal', gift: 'Heart Me', count: 1, coins: 1 },
          { unit: 'tikbalang', gift: 'Overreact', count: 2, coins: 5 },
          { unit: 'mangkukulam', gift: 'Rosa', count: 1, coins: 10 },
          { unit: 'kapre', gift: 'Kudos for My Star', count: 1, coins: 15 },
          { unit: 'bakunawa', gift: 'Capybara', count: 1, coins: 30 },
        ];
        heroRows.replaceChildren(...heroRoster.map((r) => this.cleanUnitRow(r.unit, DEFENDERS[r.unit].name, r.gift, r.count, r.coins)));
        villainRows.replaceChildren(...villainRoster.map((r) => this.cleanUnitRow(r.unit, ATTACKERS[r.unit].name, r.gift, r.count, r.coins)));
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


    // Libreng Chat Command helper banner pantay sa bottom boxes (Team Bayani vs Team Aswang)
    const chatBanner = h('div', 'chat-helper-banner');
    const header = h('div', 'helper-header');
    header.append(h('span', 'helper-badge', 'LIBRE'), h('span', 'helper-title', 'SUMALI SA LABAN:'));
    const teamsWrap = h('div', 'helper-teams');

    const heroTeam = h('div', 'helper-team hero');
    heroTeam.append(h('span', 'team-name', '🛡️ BAYANI'), h('span', 'cmd-pill', 'chat !tanod'));

    const vs = h('span', 'helper-vs', 'VS');

    const villainTeam = h('div', 'helper-team villain');
    villainTeam.append(h('span', 'team-name', '👹 ASWANG'), h('span', 'cmd-pill', 'chat !aswang'));

    teamsWrap.append(heroTeam, vs, villainTeam);
    chatBanner.append(header, teamsWrap);

    const banner = h('div', 'banner-layer');
    this.overlay.append(this.overTitle, this.overSub, this.overCount);
    r.append(leftStack, rightStack, bl, br, chatBanner, this.toasts, banner, this.overlay);
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

  private cleanUnitRow(unit: UnitKind, name: string, giftName: string, count: number, coins: number) {
    const row = h('div', 'icon-row clean-card');
    row.title = `${name} (Gift: ${giftName} • ${coins} coins)`;

    const cardPair = h('div', 'card-pair');

    // Unit portrait
    const pic = h('div', 'pic');
    const img = h('img');
    img.src = this.portraits[unit];
    pic.append(img);

    // Malaking Gift Icon
    const giftBox = h('div', 'big-gift-box');
    const gIcon = giftIconEl(giftName, 'big-gift-img', 54);
    giftBox.append(gIcon);

    cardPair.append(pic, giftBox);

    const labelText = count > 1 ? `${name} x${count}` : name;
    const nameEl = h('div', 'clean-name', labelText);

    // Malinaw na pangalan ng gift at coins para alam agad ng viewers ang ise-send sa TikTok
    const giftBadge = h('div', 'clean-gift-name');
    giftBadge.append(
      h('span', 'g-prefix', 'GIFT: '),
      h('span', 'g-title', giftName),
      h('span', 'g-coins', ` (${coins}⭐)`),
    );

    row.append(cardPair, nameEl, giftBadge);
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
    put(this.roundLabel, 'text', `ROUND ${w.round}`);
    put(this.scoreNum, 'html', `<b class="good">${w.score.bayani}</b><small>-</small><b class="bad">${w.score.halimaw}</b>`);
    put(this.roundFill, 'width', pct(1 - w.msLeft / w.roundDurationMs));

    // Puntos (PTS) at top contributor ng bawat panig ("WALA PA" kapag wala pa)
    for (const side of ['defender', 'attacker'] as const) {
      const t = this.teams[side];
      const top = w.topContributor(side);
      put(t.total, 'text', `${w.totalCoins(side)} PTS`);
      put(t.name, 'text', top ? top.user : 'WALA PA');
      put(t.coins, 'text', top ? `${top.coins} PTS` : '');
    }

    const warn = w.msLeft <= ROUND.warnMs;
    put(this.timerLabel, 'text', 'ORAS');
    this.timerLabel.classList.toggle('bad', warn); // no-op kapag pareho na
    this.timer.classList.toggle('bad', warn);

    put(this.timer, 'text', fmtTime(w.msLeft));
    put(this.netDot, 'class', `net-dot ${this.net}`);
    put(this.netDot, 'title', `bridge: ${this.net}`);

    const hpR = w.baseHp / BASE.hp;
    put(this.hpFill, 'width', pct(hpR));
    put(this.hpFill, 'class', `fill ${hpR < HUD.hpDanger ? 'danger' : hpR < HUD.hpWarn ? 'warn' : ''}`);
    put(this.hpText, 'text', `${Math.ceil(hpR * 100)}%`);
    put(this.likeFill, 'width', pct(w.likes / SPAWN.likesPerTanod));
    put(this.likeText, 'text', `${w.likes}/${SPAWN.likesPerTanod} EXP > ${DEFENDERS.tanod.name}`);

    put(this.defCount, 'html', `${w.defenders.length}<small>/${SPAWN.maxDefenders}</small>${w.queued ? ` <em>+${w.queued}</em>` : ''}`);
    put(this.defFill, 'width', pct(w.defenders.length / SPAWN.maxDefenders));
    put(this.killCount, 'text', String(w.kills));

    // Natitirang halimaw (buhay + parating)
    put(this.remainCount, 'text', String(w.remaining));

    if (w.state === 'over') put(this.overCount, 'text', `Bagong laban sa ${Math.ceil(w.msToRestart / 1000)}s...`);
  }

}

function barEl(fill: HTMLElement, cls: string, text?: HTMLElement) {
  const bar = h('div', `bar ${cls}`);
  bar.append(fill);
  if (text) bar.append(text);
  return bar;
}
