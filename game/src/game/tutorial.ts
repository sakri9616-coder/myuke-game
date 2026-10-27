/* ---------- チュートリアル導線 (段階的開示 / FTUE) ----------
   設計: research/TUTORIAL_DESIGN.md。ステージは「測定可能な事実」だけで進み、
   経過時間では絶対に進まない。ロックは表示と導線だけの話で、価格・レート・
   経済定数には一切触らない。ロック判定の原則は全箇所共通:
     locked = stageBelow(feature) && !ownsAny(feature)   (所持が常に勝つ)
   進行とセーブは owner だけが持ち、viewer はスナップショットの
   S.tut を鏡写しにして同じロック・バッジ・チップを描く (プロトコル変更なし)。
   帯にモーダルや暗転は出さない。解放は吹き出し (say) と目的チップだけで知らせる */
const TUT_STAGE = { START:0, RELEASE:1, RESEARCH:2, CLICK:3, STAFF:4, REQUEST:5, LINE2:6, PRESTIGE:7 };
const TUT_STAGE_NAMES = ["はじまり", "初リリース", "研究", "応援強化", "仲間", "依頼", "第2ライン", "卒業"];
/* タブが実体になるステージ (proj と settings は常時開放 = 表に無い) */
const TUT_TAB_STAGE = { shelf:1, stats:1, factory:1, research:2, click:3, staff:4, requests:5 };
/* 解放イベントごとの 🆕 対象: "タブ:そのタブの内容が増えるステージ" */
const TUT_FRESH = {
  shelf:["shelf:1"], stats:["stats:1"],
  factory:["factory:1", "factory:4", "factory:6", "factory:7"],
  research:["research:2"], click:["click:3"], staff:["staff:4"], requests:["requests:5"]
};
/* seen の既知キー全部 (移行時にベテラン分を一括で埋めるために列挙する) */
const TUT_SEEN_KEYS = ["s1", "s2", "s25", "s3", "s4", "s5", "s6", "input_hint", "first_bug",
  "q1", "q2", "q3", "q4", "q5", "q6"];
for(const t of Object.keys(TUT_FRESH)) for(const k of TUT_FRESH[t]) TUT_SEEN_KEYS.push("visit:" + k);

function tutAnyVal(o){ return !!o && Object.keys(o).some(k => o[k]); }
function tutOwnsUpgrades(){ return Object.keys(S.upgrades).some(k => (S.upgrades[k]||0) > 0); }
function tutOwnsResearch(){ return tutAnyVal(S.research) || Object.keys(S.researchLv||{}).some(k => (S.researchLv[k]||0) > 0); }
function tutOwnsClick(){ return Object.keys(S.clickUp||{}).some(k => (S.clickUp[k]||0) > 0); }
function tutOwnsStaff(){ return S.staff.length > 0 || S.totals.hired >= 1; }
function tutOwnsDust(){ return S.prestiges >= 1 || tutAnyVal(S.dustPerks); }
function tutOwnsFactory(){ return tutOwnsUpgrades() || S.line2.unlocked || tutOwnsDust(); }
function tutTabOwns(tabId){
  switch(tabId){
    case "shelf": case "stats": return S.totals.releases >= 1 || S.shelf.length > 0;
    case "factory": return tutOwnsFactory();
    case "research": return tutOwnsResearch();
    case "click": return tutOwnsClick();
    case "staff": return tutOwnsStaff();
    case "requests": return !!S.activeRequest;
  }
  return false;
}
/* 累計獲得 RP: 研究P は研究にしか使えないので「所持 + 消費済み」で正確に復元できる */
function cumRP(){
  let v = Math.floor(S.rp);
  for(const d of RESEARCH_DEFS) if(S.research[d.id]) v += d.cost;
  for(const d of REPEAT_RESEARCHES) for(let i = 0; i < repLv(d.id); i++) v += repeatResearchCost(i);
  return v;
}
/* 達成済みの事実だけからステージを導出する (移行・リセット・ロック判定の共通土台) */
function deriveStage(st){
  let s = TUT_STAGE.START;
  if(st.totals.releases >= 1) s = Math.max(s, TUT_STAGE.RELEASE);
  if(tutAnyVal(st.research) || st.totals.releases >= 2) s = Math.max(s, TUT_STAGE.RESEARCH);
  if(Object.keys(st.clickUp || {}).some(k => (st.clickUp[k]||0) > 0)) s = Math.max(s, TUT_STAGE.CLICK);
  if(st.totals.hired >= 1 || (st.staff && st.staff.length >= 1)) s = Math.max(s, TUT_STAGE.REQUEST);  /* 仲間(4) を含む */
  if(st.totals.releases >= 5) s = Math.max(s, TUT_STAGE.REQUEST);
  if(st.research && st.research.res_line2) s = Math.max(s, TUT_STAGE.LINE2);
  if(st.line2 && st.line2.unlocked) s = Math.max(s, TUT_STAGE.LINE2);
  if(st.prestiges >= 1 || (st.dustTotal || 0) >= 5) s = Math.max(s, TUT_STAGE.PRESTIGE);
  return s;
}
