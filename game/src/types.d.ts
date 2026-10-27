/* types.d.ts — ゲーム全体で共有する型。game/src の .ts は全て同じグローバル
   スコープのスクリプトなので、ここの宣言は import なしでどこからでも見える。
   セーブデータ (GameState) は旧セーブを load() で補完する前提のため、
   後から追加されたフィールドも型の上では常に存在する扱いにしている。 */

type Role = "owner" | "viewer" | "solo";
type ProjectSize = "TUT" | "XS" | "S" | "M" | "L";
type StageWip = { code: number; tested: number; built: number };

interface ProjectModule {
  name: string;
  dp: number;
  done?: boolean;
  [k: string]: any;
}

interface Project {
  name: string;
  genre: string;
  genreName: string;
  desc: string;
  size: ProjectSize;
  totalDP: number;
  feats: string[];
  doneFeats: number;
  startedAt: number;
  bugs: number;
  napsAtStart: number;
  ideaCost: number;
  planning: boolean;
  icon: number;
  activeSec: number;
  modules?: ProjectModule[];
  ip?: boolean;
  flowPaid?: number;   // 作りながら入金済みのコイン（v2.12.1〜。リリース時に差し引く）
  planLv?: number;   // 企画を練った回数（0〜3）
  planMeetSec?: number;   // v2.9.1〜v2.9.2 の企画会議の残り秒（v2.9.3 で廃止。旧セーブに残っていても読まない）
  scale?: number;    // 仕事の桁（作品の規模と報酬の倍率・1/2/5/10…。旧セーブは無し＝1）
  deathMarch?: boolean;
  [k: string]: any;
}

interface StaffMember {
  id: number;
  name: string;
  coat: string;
  role: string;
  lv: number;
  genre?: string;
  act?: number;
  [k: string]: any;
}

interface Executive { name: string; coat?: string; role: string }

interface Subsidiary {
  id: number;
  name: string;
  genre: string;
  staff: number;
  lv: number;
  alloc: number;
}

interface WorkRequest {
  client: string;
  genre: string;
  genreName: string;
  text?: string;
  big?: boolean;
  tier?: number;
  reqSize?: ProjectSize | null;
  deadlineAt?: number | null;
  [k: string]: any;
}

interface ShelfEntry {
  name: string;
  genreName: string;
  size: ProjectSize;
  date: string;
  devMin: number;
  lines: number;
  bugs: number;
  naps: number;
  icon: number;
  line2?: boolean;
  highlight: string;
  ip?: boolean;
  [k: string]: any;
}

interface OwnedIP { name: string; genre: string; size: ProjectSize; price: number; bornSec: number; frac: number; ships?: number; scale?: number }   // scale は v2.12.1〜。ships・frac は段階1から使わない（シリーズは毎秒売上）
interface CatalogEntry { n: string; r: number }   // 再設計 段階1: 作品棚の1作品（r = 🪙/秒）

interface Line2State {
  unlocked: boolean;
  genre: string | null;
  project: Project | null;
  projectDP: number;
  commitMark: number;
  wip: StageWip;
}

interface DayStats { date: string; keys: number; cursorPx: number; lines: number; bugs: number; releases: number; commits: number; treats: number }

interface Totals {
  keys: number; cursorPx: number; lines: number; bugsSquashed: number; releases: number; commits: number;
  coinsEarned: number; naps: number; playSec: number; clicks: number; crits: number; goldFish: number;
  eventBugs: number; hired: number;
  [k: string]: number;
}

interface Settings {
  pauseInput: boolean;
  sound: boolean | null;
  soundVol: number;
  inputCount: boolean;
  stripSize: number;
  stripSizeV: number;
  snapLayout?: boolean;
  reduceMotion?: boolean;   /* 帯の点滅を控える (OS の視差効果を減らす設定でも有効になる) */
}

interface Trend { boom: string; slump: string; nextBoom: string | null; nextSlump: string | null; cycleSec: number; ships?: number; announceAt: number }   // cycleSec は v2.12.1 から使わない（出荷の本数 ships で回る）

interface GameState {
  coins: number; ideas: number; packages: number; bugStock: number; rp: number; dust: number; prestiges: number;
  runDP: number; concentration: number;
  upgrades: Record<string, number>;
  research: Record<string, boolean>;
  stamps: Record<string, string | boolean>;   /* 獲得日 (ja-JP の日付文字列) */
  project: Project | null; projectDP: number; commitMark: number;
  activeRequest: WorkRequest | null; requests: WorkRequest[]; nextRequestGenre: string | null; bigDrawStreak: number;
  depts: Record<string, number>; bigDeal: WorkRequest | null; reqGenrePref: string | null; salesRot: number; reqHoldUntil: number;
  subs: Subsidiary[]; subSeq: number;
  fever: { gauge: number; [k: string]: any };
  debt: number; brand: number; vendorReadyAt: number; vendorUses?: number;   // vendorReadyAt は v2.12.1 から使わない（続け頼みの割増 vendorUses に置き換え）
  shelf: ShelfEntry[]; recentNames: string[];
  staff: StaffMember[]; staffSeq: number; studioLv: number; maxStudioLv: number; clickUp: Record<string, number>; cheerP: number; policy: string | null;
  wip: StageWip;
  line2: Line2State;
  today: DayStats;
  totals: Totals;
  flags: Record<string, any>;
  log: { tm: string; text: string }[];
  settings: Settings;
  lastSession: { releases: number; coinsEarned: number; ms: number; endedAt: number } | null;
  lastGiftAt: number;
  layout: Record<string, number>;
  layoutProps: Record<string, any>;
  dustPerks: Record<string, boolean | number>; dustTotal: number;
  legacy: number; legacyTech: Record<string, boolean>; holdings: number; eraDust: number;
  challenge: { id: string; startCoins: number } | null; challengeRewards: Record<string, boolean>;
  trend: Trend | null; devGenrePref: string | null; ips: OwnedIP[]; residentSec: number; catalog: CatalogEntry[];
  executives: Executive[]; execAlumni: { name: string; role: string }[];
  researchLv: Record<string, number>;
  buffs: { prodUntil?: number; clickUntil?: number };
  tut: { stage: number; seen: Record<string, boolean>; skipped: boolean };
  startedAt: number; lastTick: number;
}

/* Tauri 2 の withGlobalTauri で注入されるグローバル (使う範囲だけ緩く宣言) */
interface TauriGlobal {
  core: { invoke(cmd: string, args?: Record<string, unknown>): Promise<any> };
  event: {
    listen(name: string, cb: (e: { payload: any }) => void): Promise<() => void>;
    emit(name: string, payload?: unknown): Promise<void>;
    [k: string]: any;
  };
  [k: string]: any;
}

interface Window {
  __TAURI__?: TauriGlobal;
  __MIYUKE_ROLE__?: Role;
  __MIYUKE_MODE__?: string;
  __MIYUKE_BEACON__?: any;
  __MIYUKE_SAVE__?: string | null;   /* Rust が起動時に読んだセーブファイル (帯ウィンドウだけに渡る) */
  MIYUKE_SPRITES: { palette: Record<string, string>; [name: string]: any };
  MIYUKE_ANIMS: Record<string, AnimDef>;
  __miyukeApplyMode?: (mode: string) => void;
  __miyukeOnModeChange?: (mode: string) => void;
  __miyukeHitZones?: any;
  __miyukeDrawStats?: () => { presented: number; skipped: number };
  __miyukeSendSnapshot?: () => void;
  __miyukeBuyMany?: (verb: string, args: unknown[], n: number) => number;
  __viewerSaveTrap?: { hits: number };
  webkitAudioContext?: typeof AudioContext;
}

interface Rect { x: number; y: number; w: number; h: number }

/* 帯の当たり判定。renderStrip が毎フレーム作り直す（物の名前ごとに矩形） */
interface StripHitRects {
  staff: any[];
  bugs: any[];
  piles: any[];
  stations: any[];
  [name: string]: any;
}

/* 帯の並べ替えモードで掴める物 */
interface LayoutItem { id: string; label: string; cx: number; w: number; h: number; top: number; on?: boolean; prop?: boolean }

interface ResearchDef { id: string; name: string; cost: number; desc: string; tier?: number; requires?: string; repeatable?: boolean; stage?: string }

interface AnimDef {
  frames: string[];
  durations: number[];
  loopFrom: number;
  loopTo: number;
  loopCount: number;
  direction?: string;
}
