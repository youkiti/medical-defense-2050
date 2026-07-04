import React, { useReducer, useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Coins, Info, X, RotateCcw, Copy, Check, ChevronRight, AlertTriangle } from 'lucide-react';

/* =========================================================================
   定数
   ========================================================================= */

const LANES = ['outpatient', 'ward', 'emergency', 'homecare', 'admin'];
const LANE_LABEL = { outpatient: '外来', ward: '病棟', emergency: '救急', homecare: '在宅・介護', admin: '事務・管理' };
const LANE_EMOJI = { outpatient: '🏥', ward: '🛏️', emergency: '🚑', homecare: '🏠', admin: '🗂️' };

const UNIT_POWER = { doctor: 10, nurse: 8, comedical: 7, clerk: 6 };
const UNIT_LABEL = { doctor: '医師', nurse: '看護', comedical: 'コメディカル', clerk: '事務' };
const UNIT_EMOJI = { doctor: '🩺', nurse: '👩‍⚕️', comedical: '🧑‍🔬', clerk: '📋' };

const BASE_DEMAND = { outpatient: 26, ward: 28, emergency: 15, homecare: 12, admin: 10 };
const GLOBAL_ANCHORS = [[2026, 1.00], [2030, 1.06], [2035, 1.13], [2040, 1.18], [2043, 1.20], [2049, 1.17]];
const SHAPE_ANCHORS = {
  outpatient: [[2026, 1.00], [2035, 1.08], [2040, 1.05], [2043, 1.00], [2049, 0.93]],
  ward:       [[2026, 1.00], [2035, 1.10], [2040, 1.13], [2043, 1.10], [2049, 1.05]],
  emergency:  [[2026, 1.00], [2035, 1.10], [2040, 1.16], [2043, 1.18], [2049, 1.13]],
  homecare:   [[2026, 1.00], [2035, 1.22], [2040, 1.35], [2043, 1.43], [2049, 1.52]],
  admin:      [[2026, 1.00], [2035, 1.02], [2040, 1.03], [2043, 1.04], [2049, 1.05]],
};

const DIFFICULTY_CONFIG = {
  // totalTurns: この数のターンを乗り切ったらクリア（例: normalは24ターン＝2026〜2049年を乗り切ると「2050年到達」表示）
  // endYear: クリア時に表示する到達年（= 2025 + totalTurns + 1。最終ターンを乗り切った"翌年"に到達した、という表現）
  easy:   { label: '研修医モード', ppPerTurn: 12, demandMult: 0.90, fatigueMult: 0.6, eventProb: 0.18, extraLag: 0, totalTurns: 14, endYear: 2040, blurb: '少しやさしめ。2040年までの短期コースで、まずは流れをつかもう。' },
  normal: { label: '指導医モード', ppPerTurn: 7,  demandMult: 1.05, fatigueMult: 1.2, eventProb: 0.35, extraLag: 0, totalTurns: 24, endYear: 2050, blurb: '公的推計をベースにした標準設定。油断は禁物。' },
  hard:   { label: '院長モード',   ppPerTurn: 6,  demandMult: 1.06, fatigueMult: 1.4, eventProb: 0.42, extraLag: 2, totalTurns: 24, endYear: 2050, blurb: '資金は乏しく、対策の効果が出るまでも人一倍長い。判断の遅れが響く。' },
};

const ATTRITION_SCHEDULE = { 2032: 'clerk', 2036: 'nurse', 2040: 'comedical', 2044: 'nurse', 2048: 'comedical' };

const MILESTONES = {
  2029: { title: '医師数、ついに需給均衡！？', body: '医師の総数はなんとか足りてきたみたい。でも、地域や診療科ごとの偏りは、まだそのまま……。' },
  2035: { title: '入院ニーズ、各地でピークへ', body: '多くの地域で、入院を必要とする人の数がピークを迎えつつあります。病棟レーンに注目。' },
  2040: { title: '人手ギャップ、最大局面', body: '必要な人手はおよそ1,070万人、確保できる見込みはおよそ974万人。差はおよそ96万人。まさに今年のこと。（この年は需要が一時的に上振れします）' },
  2043: { title: '高齢者数、ピークへ', body: '65歳以上の人口がおよそ3,950万人でピークに。ここを越えれば、波はゆっくり引きはじめます。' },
};

const RANDOM_EVENT_IDS = ['pandemic', 'disaster', 'reform_spike', 'resign_wave', 'ai_boost', 'ai_regulation', 'budget_bonus'];
const EVENT_DEFS = {
  pandemic:     { title: '新興感染症の流行', body: '外来・救急に患者さんが押し寄せています。（今年だけ需要が急増）' },
  disaster:     { title: '大規模災害が発生', body: '救急の現場が、いっきに忙しくなりました。（今年だけ需要が急増）' },
  reform_spike: { title: '制度改定ラッシュ', body: 'また新しい様式……。事務作業が積み上がっています。（今年だけ事務の需要が急増）' },
  resign_wave:  { title: '離職の連鎖', body: '現場のみんな、ちょっと疲れが出てきたみたい。（全ユニットの疲労が上昇）' },
  ai_boost:     { title: 'AI推進の追い風', body: '国がAI活用を後押し。導入のハードルが下がりました。（AI系カードが値下がり）' },
  ai_regulation:{ title: 'AI規制強化のニュース', body: 'AIの使い方に、ちょっと待ったが。（今年だけAI系カードの効果がお休み）' },
  budget_bonus: { title: '補正予算がついた！', body: '臨時の予算が届きました。（政策ポイントが増加）' },
};

const CARD_CATEGORY = {
  genai_docs: 'ai', ai_triage: 'ai', care_robot: 'ai', ai_agent: 'ai',
  paperless_process: 'system', ehr_standard: 'system', renkei: 'system', prevention: 'system',
  task_shift: 'human', work_reform: 'human', return_support: 'human', foreign_care: 'human',
  support_dispatch: 'human', refresh_training: 'human',
  lobby: 'other',
};
const CATEGORY_COLOR = {
  ai: { border: 'border-l-teal-500', chip: 'bg-teal-50 text-teal-700', tag: 'AI活用' },
  human: { border: 'border-l-amber-500', chip: 'bg-amber-50 text-amber-700', tag: '人材' },
  system: { border: 'border-l-emerald-600', chip: 'bg-emerald-50 text-emerald-700', tag: '制度・基盤' },
  other: { border: 'border-l-slate-400', chip: 'bg-slate-100 text-slate-600', tag: 'その他' },
};

const AI_AGENT_ADMIN_BONUS = 10; // 事務レーンに人員数と無関係に加算される処理力（自律型AIエージェント）

const AI_MAINTENANCE_PER_CARD = 1; // 発効中のAI系カード1枚につき毎ターン支払うPP
const AI_CARD_IDS = ['genai_docs', 'ai_triage', 'care_robot', 'ai_agent'];
const DISPATCH_BOOST = 12;           // 臨時応援派遣：当ターン限定の処理力加算
const REFRESH_FATIGUE_RECOVERY = 20; // リフレッシュ研修：疲労回復量

// 選択式イベント：cost = 緩和（mitigate）選択時のPPコスト
const EVENT_CHOICES = {
  pandemic:     { cost: 8, aLabel: '広域応援体制を要請する', aDesc: '需要の急増をやわらげる', bLabel: '現場でしのぐ' },
  disaster:     { cost: 6, aLabel: '災害派遣を要請する',     aDesc: '救急の負荷をやわらげる', bLabel: '現場でしのぐ' },
  reform_spike: { cost: 6, aLabel: '事務代行を臨時契約する', aDesc: '事務の負荷をやわらげる', bLabel: '職員でこなす' },
  resign_wave:  { cost: 6, aLabel: '緊急面談でひきとめる',   aDesc: '疲労の上昇を+10→+4に', bLabel: '見送るしかない' },
};
// 需要倍率：normal=現状どおり（B選択）、mitigated=緩和（A選択）
const EVENT_DEMAND_MULT = {
  pandemic:     { normal: 1.4,  mitigated: 1.2  },
  disaster:     { normal: 1.5,  mitigated: 1.25 },
  reform_spike: { normal: 1.6,  mitigated: 1.3  },
};

const CARD_DEFS = {
  support_dispatch: {
    name: '臨時応援派遣', cost: 6, lag: 0,
    desc: '選んだレーンの処理力を今年だけ+12。何度でも・重ねがけも可',
    flavor: '今日だけ、力を貸してください。',
    repeatable: true, needsLane: true,
  },
  refresh_training: {
    name: 'リフレッシュ研修', cost: 5, lag: 0,
    desc: '選んだレーンの全員の疲労を20回復（2ターンに1回まで）',
    flavor: 'たまには、ゆっくり休んでほしい。',
    repeatable: true, needsLane: true, cooldown: 2,
  },
  paperless_process: { name: '業務プロセス改善（ペーパーレス化）', cost: 5, lag: 0, desc: '紙の伝票をなくし、むだな確認作業を減らす。事務・外来の処理力が少しアップ（すぐに効く）', flavor: 'まずは、紙を減らすところから。' },
  genai_docs:    { name: '生成AI文書支援', cost: 10, lag: 1, desc: '事務・外来の処理力アップ（導入直後は一時的にダウン、維持費: 毎年1PP）', flavor: '書類仕事、AIに任せてみた。（はじめは少し手間取ります）' },
  ai_agent:      { name: '自律型AIエージェント', cost: 20, lag: 2, desc: '事務の処理力に、人員数と関係なく一定量を上乗せ（恒久、維持費: 毎年1PP）。人が減っても、最低限の受付・会計・記録は自動で回り続ける', flavor: '気づけば、窓口の向こうはAIだけになっていた。' },
  ai_triage:     { name: 'AI問診・トリアージ', cost: 10, lag: 1, desc: '外来・救急の需要をやわらげる（維持費: 毎年1PP）', flavor: '待合室の空気が、ちょっと軽くなる。' },
  task_shift:    { name: 'タスクシフト/シェア', cost: 5,  lag: 0, desc: '医師の処理力アップ（看護・コメディカルはやや疲れやすくなる）', flavor: '医師の仕事、みんなでシェア。' },
  ehr_standard:  { name: '電子カルテ標準化', cost: 20, lag: 3, desc: '電子カルテを施設間で共有・標準化。全レーンの処理力が恒久的にアップ（時間がかかる大物）', flavor: 'ついに実現！？（3年かかります）' },
  work_reform:   { name: '働き方改革', cost: 10, lag: 0, desc: '疲労の蓄積と離職リスクを軽減（導入直後は少し効率ダウン）', flavor: '休むことも、仕事のうち。' },
  return_support:{ name: '復職支援・潜在人材', cost: 10, lag: 2, desc: '看護ユニットが2名加わる', flavor: 'おかえりなさい、待ってました。' },
  foreign_care:  { name: '外国人材受け入れ', cost: 10, lag: 2, desc: '在宅・介護レーンにコメディカルが2名加わる', flavor: '世界中から、支え合う仲間が。' },
  renkei:        { name: '地域医療連携', cost: 10, lag: 1, desc: '病棟の需要の一部を在宅・介護へ振り分ける', flavor: '病院だけが、医療じゃない。' },
  prevention:    { name: '予防・健康増進', cost: 20, lag: 10, desc: '全レーンの需要が長期的に低下（効果は10年後）', flavor: '10年後の自分への、いちばんの贈り物。' },
  care_robot:    { name: '介護ロボット・ICT', cost: 10, lag: 2, desc: '在宅・介護の処理力アップ（維持費: 毎年1PP）', flavor: '力仕事は、ロボットに任せよう。' },
  lobby:         { name: '診療報酬アップ陳情', cost: 5, lag: 0, desc: '運が良ければ臨時収入（何度でも挑戦可）', flavor: 'ダメ元で、お願いしてみる。', repeatable: true, cooldown: 2 },
};
const CARD_ORDER = ['support_dispatch', 'refresh_training', 'paperless_process', 'genai_docs', 'ai_agent', 'ai_triage', 'task_shift', 'ehr_standard', 'work_reform', 'return_support', 'foreign_care', 'renkei', 'prevention', 'care_robot', 'lobby'];

const SOURCE_TEXT = '出典: 令和4年版厚生労働白書（厚生労働省, 2022）、日本の将来推計人口 令和5年推計（国立社会保障・人口問題研究所, 2023）ほか。本ゲームは公的推計に基づくシミュレーションであり、将来を予測するものではありません。';
const CREDIT = '@YukiKataoka3';

/* =========================================================================
   純粋関数
   ========================================================================= */

function interpolate(year, anchors) {
  if (year <= anchors[0][0]) return anchors[0][1];
  if (year >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [y0, v0] = anchors[i];
    const [y1, v1] = anchors[i + 1];
    if (year >= y0 && year <= y1) {
      const t = (year - y0) / (y1 - y0);
      return v0 + t * (v1 - v0);
    }
  }
  return anchors[anchors.length - 1][1];
}

// mulberry32ベースの純粋ステップ関数（seed→{value, nextSeed}）
function rngStep(seed) {
  let s = seed | 0;
  s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextSeed: s };
}

function createInitialUnits() {
  const defs = [
    ['doctor', 'outpatient'], ['nurse', 'outpatient'], ['comedical', 'outpatient'], ['clerk', 'outpatient'],
    ['doctor', 'ward'], ['nurse', 'ward'], ['nurse', 'ward'], ['comedical', 'ward'],
    ['doctor', 'emergency'], ['nurse', 'emergency'],
    ['nurse', 'homecare'], ['comedical', 'homecare'],
    ['clerk', 'admin'], ['clerk', 'admin'], ['clerk', 'admin'],
  ];
  return defs.map(([type, lane], i) => ({ id: `u${i}`, type, lane, fatigue: 0 }));
}

function isActive(cards, id, turn) {
  const c = cards[id];
  return !!(c && c.purchased && c.activatesOnTurn !== null && turn >= c.activatesOnTurn);
}

function baseRawDemand(lane, year, cfg) {
  const g = interpolate(year, GLOBAL_ANCHORS);
  const s = interpolate(year, SHAPE_ANCHORS[lane]);
  let d = BASE_DEMAND[lane] * g * s * cfg.demandMult;
  if (year === 2040) d *= 1.03; // 人手ギャップ最大局面：一時的な需要上振れ
  return d;
}

function laneDemand(lane, year, cfg, cards, turn, activeEventId, aiRegulated, mitigated) {
  let d = baseRawDemand(lane, year, cfg);
  if (!aiRegulated && isActive(cards, 'ai_triage', turn) && (lane === 'outpatient' || lane === 'emergency')) d *= 0.92;
  if (isActive(cards, 'prevention', turn)) d *= 0.90;
  const evMult = (id) => EVENT_DEMAND_MULT[id][mitigated ? 'mitigated' : 'normal'];
  if (activeEventId === 'pandemic' && (lane === 'outpatient' || lane === 'emergency')) d *= evMult('pandemic');
  if (activeEventId === 'disaster' && lane === 'emergency') d *= evMult('disaster');
  if (activeEventId === 'reform_spike' && lane === 'admin') d *= evMult('reform_spike');
  return d;
}

function laneCapacity(lane, units, cards, turn, aiRegulated) {
  let sum = 0;
  for (const u of units) {
    if (u.lane !== lane) continue;
    let p = UNIT_POWER[u.type] * (1 - 0.5 * u.fatigue / 100);
    if (u.type === 'doctor' && isActive(cards, 'task_shift', turn)) p *= 1.15;
    sum += p;
  }
  if (isActive(cards, 'paperless_process', turn)) {
    if (lane === 'admin') sum *= 1.10;
    if (lane === 'outpatient') sum *= 1.05;
  }
  if (!aiRegulated) {
    if (isActive(cards, 'genai_docs', turn)) {
      if (lane === 'admin') sum *= 1.20;
      if (lane === 'outpatient') sum *= 1.10;
    }
    if (isActive(cards, 'care_robot', turn) && lane === 'homecare') sum *= 1.20;
  }
  if (isActive(cards, 'ehr_standard', turn)) sum *= 1.15;
  if (isActive(cards, 'work_reform', turn)) {
    const act = cards.work_reform.activatesOnTurn;
    if (turn < act + 2) sum *= 0.95;
  }
  // 生成AI文書支援：導入した“その年”だけ学習コストで一時的にダウン（発効前でも適用）
  const gd = cards.genai_docs;
  if (gd && gd.purchased && gd.purchasedOnTurn === turn && !isActive(cards, 'genai_docs', turn)) {
    if (lane === 'admin' || lane === 'outpatient') sum *= 0.90;
  }
  // 自律型AIエージェント：事務の人員数と関係なく処理力を上乗せ（他の倍率の影響を受けない独立した加算）
  if (!aiRegulated && isActive(cards, 'ai_agent', turn) && lane === 'admin') {
    sum += AI_AGENT_ADMIN_BONUS;
  }
  return sum;
}

function mkUnit(nextId, type, lane) {
  return { id: `u${nextId}`, type, lane, fatigue: 0 };
}

function computeLaneSnapshot(state) {
  const year = 2025 + state.turn;
  const cfg = DIFFICULTY_CONFIG[state.difficulty];
  const aiRegulated = state.activeEventId === 'ai_regulation';
  const rawWard = baseRawDemand('ward', year, cfg);
  const demand = {}; const capacity = {};
  for (const lane of LANES) {
    demand[lane] = laneDemand(lane, year, cfg, state.cards, state.turn, state.activeEventId, aiRegulated, state.eventMitigated);
    capacity[lane] = laneCapacity(lane, state.units, state.cards, state.turn, aiRegulated);
    capacity[lane] += (state.tempBoosts && state.tempBoosts[lane]) || 0;
  }
  if (isActive(state.cards, 'renkei', state.turn)) {
    const transfer = rawWard * 0.15;
    demand.ward -= transfer;
    demand.homecare += transfer;
  }
  return { year, demand, capacity };
}

function applyImmediateEventEffect(state, eventId) {
  // resign_wave は選択式イベントに変更したため、ここでは適用しない（CHOOSE_EVENT_OPTIONで適用）
  if (eventId === 'budget_bonus') {
    return { ...state, pp: state.pp + 8 };
  }
  if (eventId === 'ai_boost') {
    return { ...state, cardDiscount: { ...state.cardDiscount, genai_docs: 3, ai_triage: 3 } };
  }
  return state;
}

// そのターンのイベントを引く（固定マイルストーン優先、なければ確率でランダムイベント）
function drawEvent(state) {
  const year = 2025 + state.turn;
  const milestone = MILESTONES[year];
  if (milestone) {
    return { ...state, pendingEvent: { year, title: milestone.title, body: milestone.body, kind: 'milestone' }, activeEventId: null };
  }
  const cfg = DIFFICULTY_CONFIG[state.difficulty];
  const roll = rngStep(state.rngSeed);
  let s = { ...state, rngSeed: roll.nextSeed };
  if (roll.value < cfg.eventProb) {
    const candidates = RANDOM_EVENT_IDS.filter(id => !state.usedEvents.includes(id));
    if (candidates.length > 0) {
      const pick = rngStep(s.rngSeed);
      const idx = Math.floor(pick.value * candidates.length);
      const eventId = candidates[idx];
      s = { ...s, rngSeed: pick.nextSeed, usedEvents: [...state.usedEvents, eventId] };
      const isChoice = !!EVENT_CHOICES[eventId];
      if (!isChoice) {
        s = applyImmediateEventEffect(s, eventId); // budget_bonus / ai_boost は抽選と同時に即時適用（現行どおり）
      }
      s.pendingEvent = { year, eventId, title: EVENT_DEFS[eventId].title, body: EVENT_DEFS[eventId].body, kind: isChoice ? 'choice' : 'random' };
      s.activeEventId = ['pandemic', 'disaster', 'reform_spike', 'ai_regulation'].includes(eventId) ? eventId : null;
      s.eventMitigated = false;
      return s;
    }
  }
  return { ...s, pendingEvent: null, activeEventId: null };
}

function createGameState(difficulty, seed, testMode = false) {
  let s = {
    screen: 'game',
    difficulty,
    turn: 1,
    phase: 'event',
    pp: DIFFICULTY_CONFIG[difficulty].ppPerTurn,
    gauge: 0,
    laneGauge: Object.fromEntries(LANES.map(l => [l, 0])),
    units: createInitialUnits(),
    nextUnitId: 20,
    cards: Object.fromEntries(CARD_ORDER.map(id => [id, { purchased: false, activatesOnTurn: null, purchasedOnTurn: null }])),
    cardDiscount: {},
    cooldownUntil: {},
    lastLobbyResult: null,
    pendingEvent: null,
    activeEventId: null,
    eventMitigated: false,
    usedEvents: [],
    history: [],
    rngSeed: seed,
    initialSeed: seed,
    testMode,
    result: null,
    moveBudget: 2,
    tempBoosts: {},
    appliedOneTime: { return_support: false, foreign_care: false },
  };
  s = drawEvent(s);
  s.phase = s.pendingEvent ? 'event' : 'invest';
  return s;
}

function initialAppState() {
  return { screen: 'title' };
}

function reducer(state, action) {
  switch (action.type) {
    case 'GO_DIFFICULTY':
      return { screen: 'difficulty' };

    case 'START_GAME':
      return createGameState(
        action.difficulty,
        action.seed ?? Math.floor(Date.now() % 2147483647),
        action.testMode === true
      );

    case 'DISMISS_EVENT':
      if (state.screen !== 'game') return state;
      if (state.pendingEvent && state.pendingEvent.kind === 'choice') {
        // 選択式イベントはOKだけでは閉じない。無選択で閉じた場合は「現状どおり（endure）」を選んだものとして扱う
        return reducer(state, { type: 'CHOOSE_EVENT_OPTION', choice: 'endure' });
      }
      return { ...state, pendingEvent: null, phase: 'invest' };

    case 'CHOOSE_EVENT_OPTION': {
      if (state.screen !== 'game' || !state.pendingEvent) return state;
      const eventId = state.pendingEvent.eventId;
      const choiceDef = EVENT_CHOICES[eventId];
      if (!choiceDef) return state;
      let s = { ...state };

      if (action.choice === 'mitigate') {
        if (s.pp < choiceDef.cost) return state; // PP不足なら何もしない（UI側でも非活性にするが二重に守る）
        s.pp = s.pp - choiceDef.cost;
        s.eventMitigated = true;
        if (eventId === 'resign_wave') {
          s.units = s.units.map(u => ({ ...u, fatigue: Math.min(100, u.fatigue + 4) }));
        }
      } else {
        // choice === 'endure'：現行仕様と同一の効果
        if (eventId === 'resign_wave') {
          s.units = s.units.map(u => ({ ...u, fatigue: Math.min(100, u.fatigue + 10) }));
        }
      }
      return { ...s, pendingEvent: null, phase: 'invest' };
    }

    case 'BUY_CARD': {
      if (state.screen !== 'game' || state.phase !== 'invest') return state;
      const { cardId } = action;
      const def = CARD_DEFS[cardId];
      if (!def) return state;

      if (cardId === 'lobby') {
        if (state.turn < (state.cooldownUntil.lobby || 0) || state.pp < def.cost) return state;
        const roll = rngStep(state.rngSeed);
        const success = roll.value < 0.7;
        return {
          ...state,
          pp: state.pp - def.cost + (success ? 12 : 0),
          rngSeed: roll.nextSeed,
          cooldownUntil: { ...state.cooldownUntil, lobby: state.turn + def.cooldown },
          lastLobbyResult: success,
        };
      }

      if (def.needsLane) {
        const lane = action.targetLane;
        if (!lane || !LANES.includes(lane)) return state;
        if (def.cooldown && state.turn < (state.cooldownUntil[cardId] || 0)) return state;
        if (state.pp < def.cost) return state;

        let next = { ...state, pp: state.pp - def.cost };
        if (def.cooldown) {
          next.cooldownUntil = { ...state.cooldownUntil, [cardId]: state.turn + def.cooldown };
        }
        if (cardId === 'support_dispatch') {
          next.tempBoosts = { ...state.tempBoosts, [lane]: (state.tempBoosts[lane] || 0) + DISPATCH_BOOST };
        }
        if (cardId === 'refresh_training') {
          next.units = state.units.map(u =>
            u.lane === lane ? { ...u, fatigue: Math.max(0, u.fatigue - REFRESH_FATIGUE_RECOVERY) } : u
          );
        }
        return next;
      }

      const card = state.cards[cardId];
      if (card.purchased) return state;
      const cost = Math.max(2, def.cost - (state.cardDiscount[cardId] || 0));
      if (state.pp < cost) return state;
      const cfg = DIFFICULTY_CONFIG[state.difficulty];
      const activatesOnTurn = state.turn + def.lag + cfg.extraLag;
      return {
        ...state,
        pp: state.pp - cost,
        cards: { ...state.cards, [cardId]: { purchased: true, activatesOnTurn, purchasedOnTurn: state.turn } },
      };
    }

    case 'MOVE_UNIT': {
      if (state.screen !== 'game' || state.phase !== 'invest') return state;
      if (state.moveBudget <= 0) return state;
      const unit = state.units.find(u => u.id === action.unitId);
      if (!unit || unit.lane === action.toLane) return state;
      return {
        ...state,
        units: state.units.map(u => (u.id === action.unitId ? { ...u, lane: action.toLane } : u)),
        moveBudget: state.moveBudget - 1,
      };
    }

    case 'END_TURN': {
      if (state.screen !== 'game' || state.phase !== 'invest') return state;
      let s = { ...state };
      const year = 2025 + s.turn;
      const cfg = DIFFICULTY_CONFIG[s.difficulty];

      // 一度きりのユニット追加（復職支援・外国人材受け入れ）
      if (isActive(s.cards, 'return_support', s.turn) && !s.appliedOneTime.return_support) {
        s = {
          ...s,
          units: [...s.units, mkUnit(s.nextUnitId, 'nurse', 'ward'), mkUnit(s.nextUnitId + 1, 'nurse', 'homecare')],
          nextUnitId: s.nextUnitId + 2,
          appliedOneTime: { ...s.appliedOneTime, return_support: true },
        };
      }
      if (isActive(s.cards, 'foreign_care', s.turn) && !s.appliedOneTime.foreign_care) {
        s = {
          ...s,
          units: [...s.units, mkUnit(s.nextUnitId, 'comedical', 'homecare'), mkUnit(s.nextUnitId + 1, 'comedical', 'homecare')],
          nextUnitId: s.nextUnitId + 2,
          appliedOneTime: { ...s.appliedOneTime, foreign_care: true },
        };
      }

      const { demand, capacity } = computeLaneSnapshot(s);
      const overflow = {};
      let totalDemand = 0, totalCapacity = 0, totalOverflow = 0;
      for (const lane of LANES) {
        overflow[lane] = Math.max(0, demand[lane] - capacity[lane]);
        totalDemand += demand[lane];
        totalCapacity += capacity[lane];
        totalOverflow += overflow[lane];
      }

      // 疲労更新（ゲージと同じ「超過分÷需要」を基準にする。処理力が急落しても疲労だけが
      // 実態以上に跳ね上がる、といったゲージとの不整合が起きないようにするため）
      const fatigueMult = cfg.fatigueMult * (isActive(s.cards, 'work_reform', s.turn) ? 0.7 : 1);
      let units = s.units.map(u => {
        const lane = u.lane;
        const ratio = demand[lane] > 0 ? overflow[lane] / demand[lane] : (overflow[lane] > 0 ? 1 : 0);
        let fatigue = u.fatigue;
        if (overflow[lane] > 0) {
          const add = Math.min(20, ratio * 50) * fatigueMult;
          fatigue = Math.min(100, fatigue + add);
        } else {
          fatigue = Math.max(0, fatigue - 5);
        }
        if ((u.type === 'nurse' || u.type === 'comedical') && isActive(s.cards, 'task_shift', s.turn)) {
          fatigue = Math.min(100, fatigue + 2);
        }
        return { ...u, fatigue };
      });

      // ひっ迫ゲージ（レーンごとに管理。どれか1つでも100%に達したら終了）
      let laneGauge = { ...s.laneGauge };
      for (const lane of LANES) {
        const laneRatio = demand[lane] > 0 ? overflow[lane] / demand[lane] : 0;
        let g = laneGauge[lane] + laneRatio * 60;
        if (overflow[lane] === 0) g -= 3;
        laneGauge[lane] = Math.max(0, Math.min(100, g));
      }
      const worstLaneId = LANES.reduce((a, b) => (laneGauge[a] >= laneGauge[b] ? a : b));
      const gauge = laneGauge[worstLaneId]; // 表示・スコア用の代表値＝もっとも厳しいレーンの値

      // 供給の自然減（スケジュール制）。ただし、そのレーンが最後の1人になる場合は対象から外す
      if (ATTRITION_SCHEDULE[year]) {
        const type = ATTRITION_SCHEDULE[year];
        const laneHeadcount = {};
        for (const lane of LANES) laneHeadcount[lane] = units.filter(u => u.lane === lane).length;
        const cands = units.filter(u => u.type === type && laneHeadcount[u.lane] > 1);
        if (cands.length > 0) {
          const maxFatigue = Math.max(...cands.map(u => u.fatigue));
          const targetId = cands.find(u => u.fatigue === maxFatigue).id;
          units = units.filter(u => u.id !== targetId);
        }
      }

      // 疲労による離職（乱数を逐次消費）。ただし、そのレーンが最後の1人になる場合は離職しない
      let seed = s.rngSeed;
      const resignProb = isActive(s.cards, 'work_reform', s.turn) ? 0.15 : 0.30;
      const laneHeadcount = {};
      for (const lane of LANES) laneHeadcount[lane] = units.filter(u => u.lane === lane).length;
      const survivors = [];
      for (const u of units) {
        if (u.fatigue >= 80 && laneHeadcount[u.lane] > 1) {
          const roll = rngStep(seed);
          seed = roll.nextSeed;
          if (roll.value < resignProb) { laneHeadcount[u.lane] -= 1; continue; }
        }
        survivors.push(u);
      }
      units = survivors;

      // 政策ポイント収入とAI維持費
      const activeAiCount = AI_CARD_IDS.filter(id => isActive(s.cards, id, s.turn)).length;
      let pp = s.pp + cfg.ppPerTurn - activeAiCount * AI_MAINTENANCE_PER_CARD;
      if (totalOverflow === 0) pp += 3;
      pp = Math.max(0, pp);

      const record = {
        turn: s.turn, year,
        totalDemand: Math.round(totalDemand * 10) / 10,
        totalCapacity: Math.round(totalCapacity * 10) / 10,
        overflow: Math.round(totalOverflow * 10) / 10,
        gauge: Math.round(gauge * 10) / 10,
        worstLane: worstLaneId,
        laneGauge: { ...laneGauge },
        laneOverflow: overflow,
      };
      const history = [...s.history, record];

      if (gauge >= 100) {
        return { ...s, units, gauge, laneGauge, pp, rngSeed: seed, history, screen: 'result', result: 'lose', pendingEvent: null };
      }
      if (s.turn >= cfg.totalTurns) {
        return { ...s, units, gauge, laneGauge, pp, rngSeed: seed, history, screen: 'result', result: 'win', pendingEvent: null };
      }

      let next = {
        ...s, units, gauge, laneGauge, pp, rngSeed: seed, history,
        turn: s.turn + 1, moveBudget: 2, activeEventId: null,
        tempBoosts: {}, eventMitigated: false,
      };
      next = drawEvent(next);
      next.phase = next.pendingEvent ? 'event' : 'invest';
      return next;
    }

    case 'RESTART':
      return initialAppState();

    default:
      return state;
  }
}

/* =========================================================================
   スコア・シェア文言
   ========================================================================= */

// ランクしきい値は「24ターン（指導医・院長の基準）」でチューニングされた値。
// スコアの「全レーン超過ゼロだったターン数×1」の項は、ターン数が短いほど上限が下がるため、
// 24ターンより短い難易度では、その差分だけしきい値を同じ幅で下げて公平にする。
const RANK_THRESHOLDS = { S: 130, A: 110, B: 90 };
const RANK_THRESHOLDS_BASE_TURNS = 24;

function computeScore(state) {
  const cfg = DIFFICULTY_CONFIG[state.difficulty];
  const turnsShortfall = RANK_THRESHOLDS_BASE_TURNS - cfg.totalTurns; // 基準よりターン数が少ない分
  const maxGauge = state.history.length ? Math.max(...state.history.map(h => h.gauge)) : 0;
  const zeroOverflowYears = state.history.filter(h => h.overflow === 0).length;
  const score = 100 - maxGauge + state.units.length * 2 + zeroOverflowYears * 1;
  let rank = 'C';
  if (score >= RANK_THRESHOLDS.S - turnsShortfall) rank = 'S';
  else if (score >= RANK_THRESHOLDS.A - turnsShortfall) rank = 'A';
  else if (score >= RANK_THRESHOLDS.B - turnsShortfall) rank = 'B';
  return { score: Math.round(score), rank, maxGauge: Math.round(maxGauge) };
}

function worstLane(state) {
  if (!state.history.length) return null;
  return state.history[state.history.length - 1].worstLane || null;
}

function buildShareText(state) {
  const diffLabel = DIFFICULTY_CONFIG[state.difficulty].label;
  if (state.result === 'win') {
    const { rank, maxGauge } = computeScore(state);
    const endYear = DIFFICULTY_CONFIG[state.difficulty].endYear;
    return `#メディカルディフェンス2050 ${diffLabel}で${endYear}年までクリア！ランク${rank} / 最大ひっ迫${maxGauge}% / シード#${state.initialSeed}`;
  }
  const lastYear = state.history.length ? state.history[state.history.length - 1].year : 2025 + state.turn;
  return `#メディカルディフェンス2050 ${diffLabel}で挑戦中……${lastYear}年、地域医療の維持が難しくなりました。最大ひっ迫100% / シード#${state.initialSeed}`;
}

/* =========================================================================
   小さなUI部品
   ========================================================================= */

function EkgStyle() {
  return (
    <style>{`
      @keyframes md2050-scan {
        0% { stroke-dashoffset: 240; }
        100% { stroke-dashoffset: 0; }
      }
      .md2050-ekg-line {
        stroke-dasharray: 240;
        animation: md2050-scan 2.4s linear infinite;
      }
      @keyframes md2050-fade-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .md2050-fade-in {
        animation: md2050-fade-in 0.25s ease-out;
      }
      @keyframes md2050-slide-up {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .md2050-slide-up {
        animation: md2050-slide-up 0.22s ease-out;
      }
    `}</style>
  );
}

function EkgLine({ className, colorClass }) {
  return (
    <svg viewBox="0 0 240 40" className={className} preserveAspectRatio="none">
      <polyline
        className={`md2050-ekg-line ${colorClass || 'stroke-emerald-400'}`}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="0,20 30,20 38,20 44,6 50,34 56,12 62,20 90,20 100,20 108,8 114,30 120,20 150,20 180,20 188,4 194,32 200,20 240,20"
      />
    </svg>
  );
}

function GaugeMonitor({ laneGauge, year, turn, totalTurns, pp }) {
  const worst = LANES.reduce((a, b) => (laneGauge[a] >= laneGauge[b] ? a : b));
  const gauge = laneGauge[worst];
  const level = gauge >= 80 ? 'danger' : gauge >= 50 ? 'caution' : 'safe';
  const barColor = level === 'danger' ? 'bg-rose-500' : level === 'caution' ? 'bg-amber-400' : 'bg-emerald-400';
  const lineColor = level === 'danger' ? 'stroke-rose-400' : level === 'caution' ? 'stroke-amber-300' : 'stroke-emerald-400';
  return (
    <div className="bg-slate-900 text-emerald-50 rounded-2xl px-4 py-3 shadow-md">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums">{year}</span>
          <span className="font-mono text-xs text-emerald-300/80 tabular-nums">ターン {turn}/{totalTurns}</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-sm text-amber-300">
          <Coins size={14} />
          <span className="tabular-nums">{Math.floor(pp)}</span>
        </div>
      </div>
      <div className="relative h-8 rounded-lg overflow-hidden bg-slate-800">
        <EkgLine className="absolute inset-0 w-full h-full opacity-70" colorClass={lineColor} />
        <div className={`absolute inset-y-0 left-0 ${barColor} opacity-30 transition-all duration-500`} style={{ width: `${gauge}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-emerald-300/70">
          いちばん厳しいのは {LANE_EMOJI[worst]} {LANE_LABEL[worst]}
        </span>
        <span className={`font-mono text-sm font-bold tabular-nums ${level === 'danger' ? 'text-rose-400' : level === 'caution' ? 'text-amber-300' : 'text-emerald-300'}`}>
          {Math.round(gauge)}%
        </span>
      </div>
    </div>
  );
}

function TitleScreen({ dispatch, onOpenHelp }) {
  const [taps, setTaps] = useState(0);
  return (
    <div className="min-h-full bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-700 text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-full max-w-xs mb-6">
          <EkgLine className="w-full h-10 opacity-80" colorClass="stroke-lime-300" />
        </div>
        <p className="text-emerald-200 text-xs tracking-widest mb-2">2026 → 2050</p>
        <h1 className="text-3xl font-black tracking-tight leading-tight mb-1">メディカル<br />ディフェンス2050</h1>
        <p className="text-emerald-100 text-sm mt-4 leading-relaxed">
          ニッポンの医療の脈を、<br />2050年まで絶やすな。
        </p>
        <button
          onClick={() => dispatch({ type: 'GO_DIFFICULTY' })}
          className="mt-8 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded-full px-8 py-3 flex items-center gap-1 shadow-lg active:scale-95 transition-transform"
        >
          はじめる <ChevronRight size={18} />
        </button>
        <button onClick={onOpenHelp} className="mt-4 text-emerald-200 text-sm underline underline-offset-2">
          あそびかた・出典
        </button>
      </div>
      <p className="text-center text-emerald-300/50 text-[10px] leading-relaxed px-8 pb-1 select-none">
        これはゲームであり、実際の医療政策を表すものではありません。
      </p>
      <div
        className="text-center text-emerald-300/60 text-xs pb-4 select-none"
        onClick={() => {
          const n = taps + 1;
          setTaps(n);
          if (n >= 5) {
            dispatch({ type: 'START_GAME', difficulty: 'normal', seed: 12345, testMode: true });
          }
        }}
      >
        制作: {CREDIT}
      </div>
    </div>
  );
}

function parseSeed(text) {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? (n % 2147483647) : undefined; // 空欄・不正値はundefined（自動生成）
}

function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); // 例: 2026-07-04 → 20260704
}

function DifficultyScreen({ dispatch }) {
  const [seedText, setSeedText] = useState('');
  const items = [
    { id: 'easy', accent: 'border-emerald-300' },
    { id: 'normal', accent: 'border-amber-300' },
    { id: 'hard', accent: 'border-rose-300' },
  ];
  return (
    <div className="min-h-full bg-emerald-50 flex flex-col px-5 py-8">
      <h2 className="text-lg font-black text-emerald-950 mb-1">むずかしさをえらぶ</h2>
      <p className="text-sm text-emerald-800/70 mb-6">あとから変更はできません。まずは研修医モードがおすすめです。</p>
      <div className="flex flex-col gap-3">
        {items.map(({ id, accent }) => {
          const cfg = DIFFICULTY_CONFIG[id];
          return (
            <button
              key={id}
              onClick={() => dispatch({ type: 'START_GAME', difficulty: id, seed: parseSeed(seedText) })}
              className={`text-left bg-white rounded-2xl border-2 ${accent} px-4 py-3 shadow-sm active:scale-95 transition-transform`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950">{cfg.label}</span>
                {id === 'easy' && <span className="text-xs bg-amber-400 text-emerald-950 font-bold rounded-full px-2 py-0.5">おすすめ</span>}
              </div>
              <p className="text-xs text-emerald-800/70 mt-1">{cfg.blurb}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6">
        <p className="text-xs text-emerald-800/60 mb-1">シード番号（省略可）: 同じ番号なら同じ年表・同じイベント順になります</p>
        <div className="flex gap-2">
          <input
            value={seedText}
            onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            placeholder="おまかせ"
            className="flex-1 bg-white border border-emerald-200 rounded-full px-4 py-2 text-sm text-emerald-950"
          />
          <button
            onClick={() => setSeedText(String(todaySeed()))}
            className="bg-white border border-emerald-300 text-emerald-700 text-xs font-bold rounded-full px-3 py-2 active:scale-95 transition-transform whitespace-nowrap"
          >
            今日のチャレンジ
          </button>
        </div>
      </div>
    </div>
  );
}

function fatigueRing(fatigue) {
  if (fatigue >= 80) return 'ring-2 ring-rose-500 animate-pulse';
  if (fatigue >= 40) return 'ring-2 ring-amber-400';
  return 'ring-1 ring-emerald-200';
}

function fatigueEmoji(fatigue) {
  if (fatigue >= 80) return '🥵'; // 離職リスクあり（毎ターン確率判定）
  if (fatigue >= 40) return '😓';
  return null; // 元気なときはバッジなし
}

function gaugeBadgeClass(gauge) {
  if (gauge >= 80) return 'bg-rose-100 text-rose-700';
  if (gauge >= 50) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function LaneRow({ lane, demand, capacity, gauge, units, selectedUnitId, onSelectUnit, onMoveTo, moveBudget }) {
  const ratio = demand > 0 ? capacity / demand : 1;
  let barColor = 'bg-emerald-500';
  if (ratio < 1) barColor = 'bg-rose-500';
  else if (ratio < 1.15) barColor = 'bg-amber-400';
  const demandPct = Math.min(100, Math.round((demand / Math.max(demand, capacity)) * 100));
  const capPct = Math.min(100, Math.round((capacity / Math.max(demand, capacity)) * 100));
  const isMoveTarget = selectedUnitId && units.every(u => u.id !== selectedUnitId);

  return (
    <div
      className={`bg-white rounded-xl border ${isMoveTarget && moveBudget > 0 ? 'border-emerald-400 ring-2 ring-emerald-300' : 'border-emerald-100'} px-3 py-2`}
      onClick={() => { if (isMoveTarget && moveBudget > 0) onMoveTo(lane); }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-emerald-950">{LANE_EMOJI[lane]} {LANE_LABEL[lane]}</span>
          <span className={`text-xs font-mono font-bold px-1.5 rounded-full tabular-nums ${gaugeBadgeClass(gauge)}`}>
            {Math.round(gauge)}%
          </span>
        </div>
        <span className="text-xs font-mono text-emerald-800/60 tabular-nums">
          需要{Math.round(demand)} / 処理力{Math.round(capacity)}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-emerald-50 overflow-hidden mb-2">
        <div className="absolute inset-y-0 left-0 bg-emerald-100" style={{ width: `${capPct}%` }} />
        <div className={`absolute inset-y-0 left-0 ${barColor}`} style={{ width: `${demandPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {units.map(u => (
          <div key={u.id} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); onSelectUnit(u.id); }}
              className={`w-8 h-8 rounded-full bg-white flex items-center justify-center text-base ${fatigueRing(u.fatigue)} ${selectedUnitId === u.id ? 'ring-2 ring-teal-500 scale-110' : ''} transition-transform`}
              title={`${UNIT_LABEL[u.type]}（疲労${Math.round(u.fatigue)}%）。80%以上になると、毎ターン一定確率で離職する`}
            >
              {UNIT_EMOJI[u.type]}
            </button>
            {fatigueEmoji(u.fatigue) && (
              <span className="absolute -bottom-1 -right-1 text-xs leading-none">{fatigueEmoji(u.fatigue)}</span>
            )}
          </div>
        ))}
        {units.length === 0 && <span className="text-xs text-emerald-800/40 py-1">配置なし</span>}
      </div>
    </div>
  );
}

function DemandChart({ history }) {
  const data = history.map(h => ({ year: h.year, 需要: h.totalDemand, 処理力: h.totalCapacity }));
  return (
    <div className="bg-white rounded-xl border border-emerald-100 px-2 pt-3 pb-1">
      <p className="text-xs text-emerald-800/60 px-2 mb-1">需要と処理力の推移</p>
      <div style={{ width: '100%', height: 120 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="#065f46" />
            <YAxis tick={{ fontSize: 10 }} stroke="#065f46" />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <ReferenceLine x={2040} stroke="#f59e0b" strokeDasharray="4 2" />
            <ReferenceLine x={2043} stroke="#f59e0b" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="需要" stroke="#e11d48" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="処理力" stroke="#0d9488" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CardTile({ id, state, dispatch }) {
  const [choosingLane, setChoosingLane] = useState(false);
  const def = CARD_DEFS[id];
  const cat = CATEGORY_COLOR[CARD_CATEGORY[id]];
  const card = state.cards[id];
  const discount = state.cardDiscount[id] || 0;
  const cost = Math.max(2, def.cost - discount);
  const isRepeatable = !!def.repeatable;
  const onCooldown = !!def.cooldown && state.turn < (state.cooldownUntil[id] || 0);
  const purchased = !isRepeatable && card.purchased;
  const pending = purchased && !isActive(state.cards, id, state.turn);
  const affordable = state.pp >= cost;
  const disabled = purchased || onCooldown || !affordable;

  const buttonLabel = purchased
    ? (pending ? '準備中' : '導入済み✓')
    : onCooldown ? 'クールダウン中'
    : def.needsLane ? 'つかう'
    : '導入する';

  return (
    <div className={`bg-white rounded-xl border-l-4 ${cat.border} border border-emerald-100 p-3 flex flex-col gap-1.5`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`inline-block text-xs font-bold rounded px-1.5 py-0.5 ${cat.chip} mb-1`}>{cat.tag}</span>
          <p className="font-bold text-sm text-emerald-950 leading-tight">{def.name}</p>
        </div>
        <span className="font-mono text-xs text-amber-600 font-bold whitespace-nowrap tabular-nums">💰{cost}</span>
      </div>
      <p className="text-xs text-emerald-800/70 leading-snug">{def.desc}</p>
      <p className="text-xs text-emerald-800/40 italic leading-snug">{def.flavor}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-emerald-800/50">
          {def.lag > 0 ? `効果まで${def.lag}ターン` : '即時発効'}
          {isRepeatable ? '・くり返し可' : ''}
        </span>
        {!choosingLane && (
          <button
            onClick={() => (def.needsLane ? setChoosingLane(true) : dispatch({ type: 'BUY_CARD', cardId: id }))}
            disabled={disabled}
            className={`text-xs font-bold rounded-full px-3 py-1.5 ${
              purchased ? 'bg-emerald-100 text-emerald-700' :
              disabled ? 'bg-slate-100 text-slate-400' :
              'bg-emerald-600 text-white active:scale-95'
            } transition-transform`}
          >
            {buttonLabel}
          </button>
        )}
      </div>
      {choosingLane && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {LANES.map(lane => (
            <button
              key={lane}
              onClick={() => { dispatch({ type: 'BUY_CARD', cardId: id, targetLane: lane }); setChoosingLane(false); }}
              className="text-xs font-bold bg-emerald-600 text-white rounded-full px-2.5 py-1.5 active:scale-95 transition-transform"
            >
              {LANE_EMOJI[lane]} {LANE_LABEL[lane]}
            </button>
          ))}
          <button
            onClick={() => setChoosingLane(false)}
            className="text-xs text-slate-500 rounded-full px-2 py-1.5"
          >
            やめる
          </button>
        </div>
      )}
    </div>
  );
}

function isCardDone(id, state) {
  const def = CARD_DEFS[id];
  return !def.repeatable && state.cards[id].purchased;
}

function CardDrawer({ state, dispatch, onClose }) {
  const orderedIds = [...CARD_ORDER].sort((a, b) => Number(isCardDone(a, state)) - Number(isCardDone(b, state)));
  const firstDoneIndex = orderedIds.findIndex(id => isCardDone(id, state));
  const activeAiCount = AI_CARD_IDS.filter(id => isActive(state.cards, id, state.turn)).length;

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative bg-emerald-50 rounded-t-2xl flex flex-col md2050-slide-up" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100 bg-white rounded-t-2xl">
          <h3 className="font-bold text-emerald-950">介入カード</h3>
          <div className="flex items-center gap-3">
            {activeAiCount > 0 && (
              <span className="text-xs text-rose-500 font-bold">維持費 −{activeAiCount}/年</span>
            )}
            <span className="flex items-center gap-1 font-mono text-sm font-bold text-amber-600 tabular-nums">
              <Coins size={14} /> {Math.floor(state.pp)}
            </span>
            <button onClick={onClose} className="text-emerald-800/60"><X size={20} /></button>
          </div>
        </div>
        <div className="overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {orderedIds.map((id, idx) => (
            <React.Fragment key={id}>
              {idx === firstDoneIndex && idx > 0 && (
                <p className="text-xs text-emerald-800/40 mt-1 mb-0.5 px-1">導入ずみ</p>
              )}
              <CardTile id={id} state={state} dispatch={dispatch} />
            </React.Fragment>
          ))}
        </div>
        <div className="px-3 py-3 border-t border-emerald-100 bg-white">
          <button
            onClick={onClose}
            className="w-full bg-emerald-600 text-white font-bold rounded-full py-3 active:scale-95 transition-transform"
          >
            とじて年をすすめる準備をする
          </button>
        </div>
      </div>
    </div>
  );
}

function EventModal({ event, pp, onDismiss, onChoose }) {
  const isMilestone = event.kind === 'milestone';
  const isChoice = event.kind === 'choice';
  const choiceDef = isChoice ? EVENT_CHOICES[event.eventId] : null;
  const canMitigate = isChoice && pp >= choiceDef.cost;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-slate-900/50" />
      <div className="relative bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl md2050-fade-in">
        <div className="flex items-center gap-2 mb-2">
          {isMilestone ? <Info size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-500" />}
          <span className="text-xs font-bold text-emerald-800/50">{event.year}年 ・ {isMilestone ? '節目' : 'できごと'}</span>
        </div>
        <h4 className="font-black text-emerald-950 mb-2">{event.title}</h4>
        <p className="text-sm text-emerald-800/80 leading-relaxed mb-4">{event.body}</p>
        {isChoice ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => canMitigate && onChoose('mitigate')}
              disabled={!canMitigate}
              className={`w-full font-bold rounded-full py-2.5 transition-transform ${
                canMitigate ? 'bg-amber-400 text-emerald-950 active:scale-95' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {choiceDef.aLabel}（−{choiceDef.cost}PP）
            </button>
            <p className="text-xs text-emerald-800/50 text-center -mt-1">{choiceDef.aDesc}</p>
            <button
              onClick={() => onChoose('endure')}
              className="w-full bg-emerald-600 text-white font-bold rounded-full py-2.5 active:scale-95 transition-transform"
            >
              {choiceDef.bLabel}
            </button>
          </div>
        ) : (
          <button
            onClick={onDismiss}
            className="w-full bg-emerald-600 text-white font-bold rounded-full py-2.5 active:scale-95 transition-transform"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}

function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl overflow-y-auto" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-emerald-950">あそびかた</h3>
          <button onClick={onClose} className="text-emerald-800/60"><X size={20} /></button>
        </div>
        <ul className="text-sm text-emerald-900 space-y-2 leading-relaxed list-disc pl-4">
          <li>1ターン＝1年。2026年からスタートし、むずかしさによって最終年が変わる（研修医は2040年、指導医・院長は2050年）。</li>
          <li>5つのレーン（外来・病棟・救急・在宅介護・事務）に人材ユニットを配置。レーンごとに需要が処理力を超えると、そのレーンの「ひっ迫ゲージ」が上昇する。</li>
          <li>ユニットをタップ→移動先のレーンをタップで再配置（1ターンに2回まで）。</li>
          <li>需要が処理力を超え続けると、そのレーンのユニットの疲労がたまる（😓）。疲労が80%以上（🥵）になると、毎ターン一定確率で燃え尽きて離職してしまう。需要がおさまれば疲労は少しずつ回復する。</li>
          <li>「介入カード」で効率化やAI導入に投資できる。効果が出るまで時間がかかるカードもある。臨時応援派遣・リフレッシュ研修は、レーンを選んでくり返し使える。</li>
          <li>AI系カードは、発効中は毎年すこしずつ維持費（PP）がかかる。</li>
          <li>一部のできごとでは、PPを払って被害をやわらげるか、無料で耐えるかを選べる。</li>
          <li>どれか1つのレーンでもひっ迫ゲージが100%に達すると、その年で終了。全レーンをきわどく保ったまま最終年まで乗り切ればクリア。</li>
          <li>難易度選択でシード番号を指定すると、同じ年表・同じイベント順を再現できる。友だちと同じシードで競おう。</li>
        </ul>
        <p className="text-xs text-emerald-800/50 mt-4 leading-relaxed">{SOURCE_TEXT}</p>
        <p className="text-xs text-emerald-800/50 mt-3 leading-relaxed">
          ※ これはゲームであり、実際の医療政策を表すものではありません。
        </p>
        <p className="text-xs text-emerald-800/40 mt-2">制作: {CREDIT}</p>
      </div>
    </div>
  );
}

function ResultScreen({ state, dispatch }) {
  const [copied, setCopied] = useState(false);
  const win = state.result === 'win';
  const { score, rank, maxGauge } = win ? computeScore(state) : { maxGauge: Math.round(Math.max(...state.history.map(h => h.gauge), 0)) };
  const lastYear = state.history.length ? state.history[state.history.length - 1].year : 2025 + state.turn;
  const badLane = !win ? worstLane(state) : null;
  const data = state.history.map(h => ({ year: h.year, 需要: h.totalDemand, 処理力: h.totalCapacity }));

  const handleCopy = async () => {
    const text = buildShareText(state);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      // clipboard unavailable; fail silently
    }
  };

  return (
    <div className="min-h-full bg-emerald-50 flex flex-col px-5 py-8">
      <div className={`w-full max-w-xs mx-auto mb-4`}>
        <EkgLine className="w-full h-10" colorClass={win ? 'stroke-emerald-500' : 'stroke-rose-400'} />
      </div>
      <div className="text-center mb-5">
        {win ? (
          <>
            <p className="text-xs text-emerald-700 mb-1">{DIFFICULTY_CONFIG[state.difficulty].endYear}年 到達</p>
            <h2 className="text-xl font-black text-emerald-950">医療は守られた！</h2>
            <p className="mt-2 text-4xl font-black text-amber-500 font-mono">ランク {rank}</p>
          </>
        ) : (
          <>
            <p className="text-xs text-rose-600 mb-1">{lastYear}年</p>
            <h2 className="text-xl font-black text-emerald-950">地域医療の維持が<br />難しくなりました……</h2>
            {badLane && <p className="mt-2 text-xs text-emerald-800/60">とくに厳しかったのは「{LANE_EMOJI[badLane]} {LANE_LABEL[badLane]}」レーンでした。</p>}
          </>
        )}
        <p className="text-xs text-emerald-800/50 mt-2 font-mono">最大ひっ迫 {maxGauge}%</p>
      </div>

      <div className="bg-white rounded-xl border border-emerald-100 px-2 pt-3 pb-1 mb-5">
        <div style={{ width: '100%', height: 140 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="#065f46" />
              <YAxis tick={{ fontSize: 10 }} stroke="#065f46" />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <ReferenceLine x={2040} stroke="#f59e0b" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="需要" stroke="#e11d48" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="処理力" stroke="#0d9488" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="bg-white border border-emerald-200 text-emerald-800 font-bold rounded-full py-3 flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'コピーしました' : '結果をコピー'}
      </button>
      <p className="text-center text-xs text-emerald-800/40 mb-3">シード#{state.initialSeed}（同じ番号で同じ年表を再現できます）</p>
      <button
        onClick={() => dispatch({ type: 'START_GAME', difficulty: state.difficulty, seed: state.initialSeed })}
        className="bg-white border-2 border-emerald-600 text-emerald-700 font-bold rounded-full py-3 flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
      >
        同じ年表にもう一度挑む
      </button>
      <button
        onClick={() => dispatch({ type: 'RESTART' })}
        className="bg-emerald-600 text-white font-bold rounded-full py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <RotateCcw size={16} /> もう一度あそぶ
      </button>
      <p className="text-center text-xs text-emerald-800/40 mt-6 leading-relaxed">{SOURCE_TEXT}</p>
      <p className="text-center text-xs text-emerald-800/30 mt-1">制作: {CREDIT}</p>
    </div>
  );
}

function GameScreen({ state, dispatch }) {
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { demand, capacity } = useMemo(() => computeLaneSnapshot(state), [state]);

  const handleSelectUnit = (unitId) => {
    setSelectedUnitId(prev => (prev === unitId ? null : unitId));
  };
  const handleMoveTo = (lane) => {
    if (selectedUnitId) {
      dispatch({ type: 'MOVE_UNIT', unitId: selectedUnitId, toLane: lane });
      setSelectedUnitId(null);
    }
  };

  return (
    <div className="min-h-full bg-emerald-50 flex flex-col pb-24">
      <div className="sticky top-0 z-10 px-3 pt-3 pb-2 bg-emerald-50">
        <GaugeMonitor laneGauge={state.laneGauge} year={2025 + state.turn} turn={state.turn} totalTurns={DIFFICULTY_CONFIG[state.difficulty].totalTurns} pp={state.pp} />
      </div>

      <div className="px-3 flex items-center justify-end gap-2 text-xs text-emerald-800/50 mb-1">
        <span>疲労: 😓お疲れ　🥵離職リスク(80%以上)</span>
      </div>

      <div className="px-3 flex flex-col gap-2">
        {LANES.map(lane => (
          <LaneRow
            key={lane}
            lane={lane}
            demand={demand[lane]}
            capacity={capacity[lane]}
            gauge={state.laneGauge[lane]}
            units={state.units.filter(u => u.lane === lane)}
            selectedUnitId={selectedUnitId}
            onSelectUnit={handleSelectUnit}
            onMoveTo={handleMoveTo}
            moveBudget={state.moveBudget}
          />
        ))}
      </div>

      {selectedUnitId && (
        <p className="text-center text-xs text-teal-700 mt-2">移動先のレーンをタップ（残り{state.moveBudget}回）</p>
      )}

      <div className="px-3 mt-3">
        <DemandChart history={state.history} />
      </div>

      <button onClick={() => setHelpOpen(true)} className="self-center mt-3 text-emerald-700/60 text-xs underline">
        あそびかた・出典
      </button>
      <p className="text-center text-xs text-emerald-700/30 mt-1">制作: {CREDIT}</p>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-emerald-100 px-3 py-3 flex gap-2 z-20">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 bg-white border-2 border-emerald-600 text-emerald-700 font-bold rounded-full py-3 active:scale-95 transition-transform"
        >
          💊 介入カード
        </button>
        <button
          onClick={() => dispatch({ type: 'END_TURN' })}
          disabled={state.phase !== 'invest'}
          className={`flex-1 font-bold rounded-full py-3 flex items-center justify-center gap-1 transition-transform ${
            state.phase === 'invest' ? 'bg-emerald-600 text-white active:scale-95' : 'bg-slate-200 text-slate-400'
          }`}
        >
          この年をすすめる <ChevronRight size={16} />
        </button>
      </div>

      {drawerOpen && <CardDrawer state={state} dispatch={dispatch} onClose={() => setDrawerOpen(false)} />}
      {state.pendingEvent && (
        <EventModal
          event={state.pendingEvent}
          pp={state.pp}
          onDismiss={() => dispatch({ type: 'DISMISS_EVENT' })}
          onChoose={(choice) => dispatch({ type: 'CHOOSE_EVENT_OPTION', choice })}
        />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

export default function MedicalDefense2050() {
  const [state, dispatch] = useReducer(reducer, null, initialAppState);
  const [helpOpen, setHelpOpen] = useState(false);
  const autoplayRef = useRef(false);

  // 隠しテストモード：タイトル画面のクレジットを5回タップすると
  // seed固定・無介入の自動プレイでバランス確認ができる。
  // 判定は state.testMode フラグのみで行う（シード値での判定はしない。
  // シード共有機能でユーザーが12345を手入力した場合に誤って自動プレイが
  // 発動しないようにするための対応）。
  useEffect(() => {
    if (state.screen === 'game' && state.testMode === true && !autoplayRef.current) {
      autoplayRef.current = 'armed';
    }
  }, [state.screen]);

  useEffect(() => {
    if (autoplayRef.current === 'armed' && state.screen === 'game') {
      const t = setTimeout(() => {
        if (state.pendingEvent) dispatch({ type: 'DISMISS_EVENT' });
        else dispatch({ type: 'END_TURN' });
      }, 30);
      return () => clearTimeout(t);
    }
  });

  return (
    <div className="w-full h-full min-h-screen flex justify-center bg-slate-200">
      <EkgStyle />
      <div className="w-full max-w-md bg-emerald-50 min-h-screen relative" style={{ fontFamily: 'system-ui, -apple-system, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
        {state.screen === 'title' && <TitleScreen dispatch={dispatch} onOpenHelp={() => setHelpOpen(true)} />}
        {state.screen === 'difficulty' && <DifficultyScreen dispatch={dispatch} />}
        {state.screen === 'game' && <GameScreen state={state} dispatch={dispatch} />}
        {state.screen === 'result' && <ResultScreen state={state} dispatch={dispatch} />}
        {helpOpen && state.screen === 'title' && <HelpModal onClose={() => setHelpOpen(false)} />}
      </div>
    </div>
  );
}
