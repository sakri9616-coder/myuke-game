/* ================= 家具カタログ（2026-11-18 sakuri 指示「家具配置と家具購入の仕組み」） =================
   コインで買う見た目だけの家具。効果は持たないので数値バランス（sim ゲート）は変わらない。
   - 品は最高到達社格（または通算 EXIT 回数）で増える。値段はその頃の手持ちで「少し迷う」額。
   - 買った家具は会社の資産ではなくみゅけの持ち物: EXIT でも持株化でも消えない（レイアウトと同じ）。
   - 置き場所は並べ替え（Phase E の layoutProps）にそのまま乗る: PROP_DEFS に "decor_<id>" で登録し、
     地面にも、小物なら机・棚・本棚の上にも置ける。本棚は買うと新しい「面」になる。
   - 帯の絵は既存アセットだけを使う（理念書 9章: スクリプト生成アートは禁止）。sprite が無い品は
     カタログに出さない — 発注した絵（DECOR_ORDER）が届けば自動で並ぶ。
   - 帯でクリックの当たりは持たない（理念書 1章: 何もない所はデスクトップへ素通し）。動かすのは並べ替えモードだけ。
   保存は追加フィールド S.decor のみ: { [id]: { at: 購入時刻, hidden?: 1 } } */
interface DecorDef {
  id: string; name: string; desc: string; spr: string; scale: number;
  w: number; h: number; cls: "ground" | "small";
  rank?: number; exits?: number; cost: number;
  def: { on: "ground"; x: number } | { on: string; dx: number };   /* 買った直後の置き場 */
}
const DECOR_DEFS: DecorDef[] = [
  /* --- 既存の絵で出せる品 --- */
  { id: "plant",  name: "観葉植物",   desc: "小さな鉢植え。机や棚の上にも置けます", spr: "prop_plant", scale: 1, w: 16, h: 20, cls: "small",
    rank: 1, cost: 300, def: { on: "shelf", dx: 24 } },
  { id: "books",  name: "技術書の列", desc: "読み込んだ技術書。棚や机の上に並べられます", spr: "prop_books", scale: 1, w: 24, h: 7, cls: "small",
    rank: 2, cost: 1500, def: { on: "shelf", dx: -24 } },
  { id: "boxes",  name: "段ボール箱", desc: "資料を詰めた箱の山。創業期の空気", spr: "prop_archive_boxes", scale: 1, w: 18, h: 25, cls: "small",
    rank: 2, cost: 2500, def: { on: "ground", x: 0.025 } },
  { id: "bookshelf", name: "本棚",    desc: "小さな本棚。天板に小物を置けます（新しい置き場になります）", spr: "prop_shelf", scale: 2, w: 80, h: 56, cls: "ground",
    rank: 3, cost: 15000, def: { on: "ground", x: 0.415 } },
  { id: "server", name: "小型サーバー", desc: "棚に収まらなかった一台。ランプが光る", spr: "prop_server", scale: 1, w: 24, h: 32, cls: "ground",
    rank: 4, cost: 200000, def: { on: "ground", x: 0.965 } },
  /* --- 発注中の絵（届くまでカタログに出ない。名前契約は DECOR_ORDER と同じ） --- */
  { id: "water",  name: "ウォーターサーバー", desc: "冷たい水とお湯が出る", spr: "prop_water_server", scale: 1, w: 20, h: 44, cls: "ground",
    rank: 5, cost: 5e4, def: { on: "ground", x: 0.43 } },
  { id: "lamp",   name: "フロアランプ", desc: "やわらかい光の背の高いランプ", spr: "prop_floor_lamp", scale: 1, w: 16, h: 48, cls: "ground",
    rank: 6, cost: 1e6, def: { on: "ground", x: 0.985 } },
  { id: "bigplant", name: "大きな観葉植物", desc: "背の高い鉢植え。オフィスらしさが一気に出る", spr: "prop_plant_big", scale: 1, w: 28, h: 48, cls: "ground",
    rank: 6, cost: 1e7, def: { on: "ground", x: 0.05 } },
  { id: "sofa",   name: "ソファ",     desc: "休憩用のふかふかソファ", spr: "prop_sofa", scale: 1, w: 64, h: 32, cls: "ground",
    exits: 1, cost: 1e8, def: { on: "ground", x: 0.42 } },
  { id: "cattower", name: "キャットタワー", desc: "社員猫の憧れ", spr: "prop_cat_tower", scale: 1, w: 32, h: 64, cls: "ground",
    exits: 5, cost: 1e10, def: { on: "ground", x: 0.975 } },
  { id: "aquarium", name: "金魚の水槽", desc: "台に載った小さな水槽。泳ぐ金魚", spr: "prop_aquarium", scale: 1, w: 40, h: 40, cls: "ground",
    exits: 20, cost: 1e12, def: { on: "ground", x: 0.04 } },
];
/* 発注リスト（sakuri 作画）。DECOR_DEFS の「発注中」と同じ名前・原寸。下端中央が接地点 */
const DECOR_ORDER = DECOR_DEFS.filter(d => !["plant", "books", "boxes", "bookshelf", "server"].includes(d.id)).map(d => d.spr + " " + d.w + "×" + d.h);
/* 並べ替えの項目として登録（PROP_DEFS は strip-layout.ts。段は中景） */
for(const d of DECOR_DEFS) PROP_DEFS["decor_" + d.id] = { label: d.name, w: d.w, h: d.h, cls: d.cls };

function decorDef(id){ return DECOR_DEFS.find(d => d.id === id) || null; }
function decorOwned(id){ return !!(S.decor && S.decor[id]); }
function decorShown(id){ return decorOwned(id) && !S.decor[id].hidden && hasSprite((decorDef(id) || {} as DecorDef).spr); }
/* カタログに並ぶ品: 絵がある品だけ。解放前の品は「社格◯で解放」として次の1つだけ見せる */
function decorUnlocked(d){
  if(d.rank && (S.maxStudioLv || S.studioLv || 1) < d.rank) return false;
  if(d.exits && (S.prestiges || 0) < d.exits) return false;
  return true;
}
function decorUnlockText(d){ return d.exits ? "EXIT " + d.exits + " 回で解放" : "社格「" + rankName(d.rank) + "」で解放"; }
function decorCatalog(){
  const withArt = DECOR_DEFS.filter(d => hasSprite(d.spr));
  const open = withArt.filter(d => decorUnlocked(d));
  const next = withArt.find(d => !decorUnlocked(d));
  return { open, next };
}
function buyDecor(id){
  const d = decorDef(id);
  if(!d || !hasSprite(d.spr)) return;
  if(!S.decor || typeof S.decor !== "object") S.decor = {};
  if(S.decor[id]){ say("もう持ってるにゃ"); return; }
  if(!decorUnlocked(d)){ say("まだ買えないにゃ（" + decorUnlockText(d) + "）"); return; }
  if(S.coins < d.cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= d.cost;
  S.decor[id] = { at: Date.now() };
  /* 地面に置く家具は、買った時点の帯でいちばん広い空きの真ん中に置く（帯幅や家具の数で既定位置が埋まっていることがあるため） */
  if(d.def.on === "ground" && !propEntry("decor_" + id)){
    const x = decorFreeX(d.w);
    if(x !== null){
      if(!S.layoutProps || typeof S.layoutProps !== "object") S.layoutProps = {};
      S.layoutProps["decor_" + id] = { on: "ground", x: Math.round(x / stripVW * 1000) / 1000 };
    }
  }
  SoundKit.play("purchase");
  addLog("🪑 家具: 『" + d.name + "』を買った（-" + fmt(d.cost) + "🪙）");
  say("『" + d.name + "』が届いたにゃ！ ✥ 並べ替えで好きな所に置いてね");
  checkStamps(); save(); renderPanel();
}
/* しまう／出す（持ち物は残る。帯が混んできた時の逃げ道） */
function toggleDecor(id){
  if(!decorOwned(id)) return;
  if(S.decor[id].hidden) delete S.decor[id].hidden; else S.decor[id].hidden = 1;
  save(); renderPanel();
}
/* 帯の地面でいちばん広い空き（並べ替えの全項目の矩形の隙間）の中心。幅 w が入らなければ null */
function decorFreeX(w){
  if(!stripVW) return null;
  const spans = layoutItems().map(it => [it.cx - it.w / 2, it.cx + it.w / 2]).sort((a, b) => a[0] - b[0]);
  let best = null, bestW = 0, cur = 0;
  /* 右端は並べ替えボタンの下を避けて少し空ける */
  for(const sp of spans.concat([[stripVW - 4, stripVW]])){
    const gap = sp[0] - cur;
    if(gap > bestW){ bestW = gap; best = (cur + sp[0]) / 2; }
    cur = Math.max(cur, sp[1]);
  }
  return bestW >= w + 8 ? Math.round(best) : null;
}
/* 買った直後の置き場（layoutProps に無いとき）。面が無ければ地面の既定位置 */
function decorDefaultPlace(pid){
  const d = decorDef(pid.slice(6));
  const G = stripTierG("mid");
  if(!d) return { cx: stripDeskCX(), baseY: G };
  if(d.def.on !== "ground"){
    const sf = layoutSurfaces().find(s => s.id === (d.def as { on: string; dx: number }).on);
    if(sf) return { cx: sf.cx + (d.def as { dx: number }).dx, baseY: sf.y };
    return { cx: Math.round(stripVW * 0.40), baseY: G };
  }
  return { cx: Math.round(stripVW * (d.def as { x: number }).x), baseY: G };
}
/* 本棚の天板（新しい面）。天板の見かけの上面は棚の絵の上端 +8（drawStripShelf の置物と同じ規則） */
function decorSurfaces(){
  if(!decorShown("bookshelf") || layoutEdit.dragId === "decor_bookshelf") return [];
  const pl = propPlace("decor_bookshelf");
  return [{ id: "decor_bookshelf", cx: pl.cx, y: pl.baseY - 56 + 10, w: 72 }];
}
/* 帯への描画。pass "ground" は家具層（主机より奥）、"surface" は面に載った小物（家具の後）。
   当たり判定は持たない（並べ替えの矩形は layoutPropItems が作る） */
function drawStripDecor(pass){
  if(!S.decor) return;
  for(const d of DECOR_DEFS){
    if(!decorShown(d.id)) continue;
    const pid = "decor_" + d.id;
    const e = propEntry(pid);
    const onSurface = layoutEdit.dragId === pid ? (layoutEdit.dragCand && layoutEdit.dragCand.on !== "ground")
      : (e ? e.on !== "ground" : d.def.on !== "ground");
    if((pass === "surface") !== !!onSurface) continue;
    const pl = propPlace(pid);
    if(!onSurface) sShadow(pl.cx, pl.baseY - 0.5, Math.max(12, d.w * 0.8));
    if(d.id === "bookshelf"){
      /* 本棚: officeTier 2 からはスチール枠（作品棚の旧棚と同じ規則）。下段に技術書 */
      const nm = officeTier(S) >= 2 && hasSprite("shelf_steel") ? "shelf_steel" : d.spr;
      sDrawSprite(nm, pl.cx, pl.baseY, d.scale);
      sDrawSprite("prop_books", pl.cx, pl.baseY - 10, 2);
      continue;
    }
    sDrawSprite(d.spr, pl.cx, pl.baseY, d.scale);
  }
}
/* 設定タブ「家具の並び」の下に出すカタログ（新しい画面は作らない） */
function decorCatalogHTML(){
  const { open, next } = decorCatalog();
  let h = "";
  for(const d of open){
    const url = spriteURL(d.spr);
    const ico = url ? "<img class='decor-ico' src='" + url + "' alt=''>" : "<span class='sock'>🪑</span>";
    let btn;
    if(decorOwned(d.id)){
      btn = "<span style='display:flex;gap:4px'><button onclick='toggleDecor(\"" + d.id + "\")'>" + (S.decor[d.id].hidden ? "出す" : "しまう") + "</button></span>";
    } else {
      const can = S.coins >= d.cost;
      btn = "<button" + (can ? "" : " disabled") + " onclick='buyDecor(\"" + d.id + "\")'>" + fmt(d.cost) + "🪙</button>";
    }
    h += "<div class='item buy slim'><div>" + ico + "<span class='nm'>" + d.name + (decorOwned(d.id) ? " <small>（持っている）</small>" : "") +
      "</span><div class='ds'>" + d.desc + "</div></div>" + btn + "</div>";
  }
  if(next){
    h += "<div class='item buy slim locked'><div><span class='sock'>🔒</span><span class='nm'>" + next.name + "</span><div class='ds'>" +
      decorUnlockText(next) + "</div></div><button disabled>" + fmt(next.cost) + "🪙</button></div>";
  }
  return h;
}
