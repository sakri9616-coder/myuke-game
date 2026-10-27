/* ---------- オフィスの規模ティア (OFFICE_ART_DIRECTION + sakuri の規模進化案) ----------
   会社の成長に合わせて帯の家具・素材が変わるための土台。deriveStage と同じく
   「達成済みの事実だけから導出する純関数」で、セーブには保存しない (事実が
   進めば自動で上がり、巻き戻らない)。見た目への反映は次パス (帯の家具
   ティア化) で行う — ここでは導出と検証だけ。
     tier 0 創業ガレージ: 木の看板・木の机・単モニタ (現在の姿)
     tier 1 小さなオフィス: 初リリース + 初雇用 — 会社らしくなり始める
     tier 2 開発スタジオ: 第2ライン開設 or スタジオ Lv3 — カンバン白板・
            デュアルモニタ・ラミネート机に更新される規模
     tier 3 引っ越し後の本社: prestiges >= 1 — フルモダン (サーバラック等) */
const OFFICE_TIER_NAMES = ["創業ガレージ", "小さなオフィス", "開発スタジオ", "本社", "大きな本社", "グループ本社"];
/* ティア上昇の祝い用トラッカー。null = 未初期化。load() が読み込み時点の
   ティアで初期化し、tick() がセッション中の上昇だけを検知する */
let officeTierSeen = null;
function officeTier(st){
  let t = 0;
  const releases = (st.totals && st.totals.releases) || 0;
  const hired = Math.max((st.totals && st.totals.hired) || 0, (st.staff && st.staff.length) || 0);
  if(releases >= 1 && hired >= 1) t = Math.max(t, 1);
  if((st.line2 && st.line2.unlocked) || (st.studioLv || 1) >= 3) t = Math.max(t, 2);
  if((st.prestiges || 0) >= 1) t = Math.max(t, 3);
  /* Phase B・家具ティアの床ルール（仕様書2節・レビュー室指摘の明文化）:
     ティアは max(現行の導出, 社格ティア) で、最高到達社格の段を下回らない。
     社格ティア = 最高到達Lv − 1（Lv1→0 … Lv6→5）。現在と記録の大きい方を
     使うので、未移行の旧セーブ（記録なし＝現在Lv）でも現在Lvが床になる。
     売却で studioLv が 1 に戻っても記録が残るため、見た目は格下げしない。
     注: 現行の絵のゲートは >=1 / >=2 の2段だけなので、ティア 3〜5 の家具は
     ティア 3 と同じ絵になる。段差は社格チップ・人数・ティア名と祝いで読む */
  const best = Math.max(st.studioLv || 1, st.maxStudioLv || 0);
  t = Math.max(t, best - 1);
  return t;
}
/* ロック判定に使う実効ステージ: 記録 (S.tut.stage) と事実 (derive) の大きい方。
   tutCheck が毎秒同期するので通常は一致するが、事実が先行した瞬間にも
   「もう持っているのにロックされる」状態を作らないための安全網 */
function tutEffStage(){
  if(!S.tut) return TUT_STAGE.PRESTIGE;
  return Math.max(S.tut.stage, deriveStage(S));
}
function tutLocked(needStage, owns){
  if(!S.tut || S.tut.skipped) return false;
  if(tutEffStage() >= needStage) return false;
  return !owns;
}
function tutTabLocked(tabId){
  const need = TUT_TAB_STAGE[tabId];
  if(need === undefined) return false;   /* proj / settings は絶対にロックしない */
  return tutLocked(need, tutTabOwns(tabId));
}
/* 次ステージへの述語 (index = 現在のステージ)。すべて測定可能な事実のみ */
const TUT_NEXT = [
  () => S.totals.releases >= 1,                                /* 0→1 初リリース */
  () => cumRP() >= 2,                                          /* 1→2 研究 */
  () => S.totals.clicks >= 30 || S.totals.releases >= 4,       /* 2→3 応援強化 */
  () => S.totals.coinsEarned >= 220,                           /* 3→4 仲間 */
  () => S.totals.hired >= 1 || S.totals.releases >= 5,         /* 4→5 依頼 */
  () => !!S.research.res_line2,                                /* 5→6 第2ライン */
  () => prestigePreview().gain >= 3                            /* 6→7 引っ越し (卒業)。第2ウェーブ I で売却下限 3 に一致 */
];
/* 解放ビート (吹き出し1回だけ)。設計 §7 の文案 */
const TUT_BEATS = {
  1: "🪙 たまったにゃ。上の目的メモをクリックすると、工場で道具が買えるよ",
  2: "🔬 研究ポイントがたまったにゃ。研究タブが開いたよ",
  3: "👆 よく応援してくれるね。応援タブでクリックが強くできるよ",
  4: "🐱 さっきの猫たち、雇えるようになったにゃ",
  5: "📮 お客さんから依頼が届いてるにゃ",
  6: "🏭 第2ラインが設計できたにゃ！あとは建設費 1,500🪙",
  7: "⭐ だいぶ星屑がたまったね。会社を売却すると最初からだけど、ずっと強くなるよ。工場タブに置いといたにゃ"
};
const TUT_BEAT_KEYS = { 1:"s1", 2:"s2", 3:"s25", 4:"s3", 5:"s4", 6:"s5", 7:"s6" };
let tutPendingBeat = null;   /* { at, text } 解放セリフは演出の後に少し遅らせる */
let tutCelebrate = null;     /* { text, until } 目的チップの完了フラッシュ */
let tutPrimed = false;       /* セッション初回のラッチは無音 (読込直後の誤フラッシュ防止) */
function tutLatchQuests(){
  if(!S.tut) return false;
  const seen = S.tut.seen;
  const facts = {
    q1: tutOwnsUpgrades(), q2: tutOwnsResearch(), q3: tutOwnsClick(),
    q4: S.totals.hired >= 1 || S.staff.length > 0,
    q5: !!S.activeRequest, q6: !!S.line2.unlocked
  };
  const stageOf = { q1:1, q2:2, q3:3, q4:4, q5:5, q6:6 };
  let changed = false;
  for(const k of Object.keys(facts)){
    if(facts[k] && !seen[k]){
      seen[k] = true; changed = true;
      if(tutPrimed && S.tut.stage === stageOf[k] && !S.tut.skipped)
        tutCelebrate = { text: "🎉 できたにゃ！", until: Date.now() + 4000 };
    }
  }
  tutPrimed = true;
  return changed;
}
/* 進行チェック本体: tick と各アクションの末尾から呼ばれる (owner のみ) */
function tutCheck(){
  if(IS_VIEWER || !S.tut) return;
  const now = Date.now();
  let changed = tutLatchQuests();
  if(tutPendingBeat && now >= tutPendingBeat.at){
    const t = tutPendingBeat.text; tutPendingBeat = null;
    say(t);
  }
  if(!S.tut.skipped && S.tut.stage < TUT_STAGE.PRESTIGE){
    const from = S.tut.stage;
    while(S.tut.stage < TUT_STAGE.PRESTIGE && TUT_NEXT[S.tut.stage]()) S.tut.stage++;
    if(S.tut.stage !== from){
      /* 途中ステージのビートは seen だけ立てて連打しない。到達点の分だけ予約 */
      for(let s = from + 1; s <= S.tut.stage; s++){
        const bk = TUT_BEAT_KEYS[s];
        if(bk) S.tut.seen[bk] = true;
      }
      const to = S.tut.stage;
      /* 応援タブの自動解放 (リリース4本経由・クリック30未満) はバッジのみで無音 */
      const silentClick = to === TUT_STAGE.CLICK && S.totals.clicks < 30;
      if(!silentClick) tutPendingBeat = { at: now + 5000, text: TUT_BEATS[to] };
      changed = true;
      bumpRev();
    }
  }
  /* OS入力カウントの文脈ヒント: Stage 1 以降に吹き出し1回だけ。
     同意の取得ではなく「存在の通知」 (有効化は設定タブでのみ起きる) */
  if(!S.tut.seen.input_hint){
    if(S.settings.inputCount || S.tut.skipped){
      S.tut.seen.input_hint = true;   /* 既に有効 / 対象外なら静かに消費 */
    } else if(S.tut.stage >= TUT_STAGE.RELEASE && !tutPendingBeat){
      S.tut.seen.input_hint = true;
      tutPendingBeat = { at: now + 20000,
        text: "あんたがキーボードを打つと、あたしも速く書けるにゃ。設定の『OS全体の入力カウント』で有効にできるよ" };
    }
  }
  if(changed) renderPanel();
}
/* 設定タブ: スキップ (全部ひらく) — 確認モーダルなし・即時。進行は消えない */
function tutSkipGuide(){
  if(!S.tut) return;
  S.tut.skipped = true;
  S.tut.stage = TUT_STAGE.PRESTIGE;
  tutPendingBeat = null;
  say("ガイドは全部ひらいたにゃ。好きに遊んでね");
  save(); renderPanel();
}
/* 設定タブ: 見直す (リセット) — ステージは事実から再導出されるので、
   解放済みのものは開いたまま。これから開くもののガイドだけが復活する */
function tutResetGuide(){
  if(!S.tut) return;
  S.tut.skipped = false;
  S.tut.seen = {};
  S.tut.stage = deriveStage(S);
  /* 既に開いているタブは「新着」ではないので visit 済みにしておく */
  for(const t of Object.keys(TUT_FRESH))
    for(const k of TUT_FRESH[t])
      if(parseInt(k.split(":")[1], 10) <= S.tut.stage) S.tut.seen["visit:" + k] = true;
  tutPendingBeat = null;
  tutPrimed = false;
  say("ガイドを巻き戻したにゃ（解放済みのものは開いたままだよ）");
  save(); renderPanel();
}
/* タブを開いたら、そのタブの解放ぶんの 🆕 を消す (viewer ではコマンドになる) */
function tutVisitTab(id){
  if(!S.tut || !S.tut.seen) return;
  const keys = TUT_FRESH[id];
  if(!keys) return;
  let dirty = false;
  for(const k of keys){
    const kk = "visit:" + k;
    if(parseInt(k.split(":")[1], 10) <= tutEffStage() && !S.tut.seen[kk]){ S.tut.seen[kk] = true; dirty = true; }
  }
  if(dirty && !IS_VIEWER) save();
}
/* ロック条件のバー列: アイコン + メーター + 現在/必要数 (文章でなく絵で示す) */
function condBarsHTML(bars){
  let h = "";
  for(const b of bars){
    const pct = Math.max(0, Math.min(100, Math.floor(b[1] / b[2] * 100)));
    h += "<div class='condbar'><span class='sock sm'>" + b[0] + "</span>" +
      "<div class='meter'><i style='width:" + pct + "%'></i></div>" +
      "<b>" + fmt(Math.min(Math.floor(b[1]), b[2])) + " / " + fmt(b[2]) + "</b></div>" +
      (b[3] ? "<div class='condcap'>" + b[3] + "</div>" : "");
  }
  return h;
}
/* セクション単位のシルエット (タブ自体は開いているが中の一部がまだの時) */
function secLockHTML(icon, title, bars, line){
  return "<div class='seclock'><div class='seclock-head'><span class='silh'>" + icon + "</span><span>" + title + "</span>" +
    "<span class='fold-sum'>🔒 解放条件</span></div>" +
    condBarsHTML(bars) +
    (line ? "<div class='lockline'>🐱 " + line + "</div>" : "") + "</div>";
}
/* タブ単位のロックパネル: 中央シルエット + 条件バー + みゅけの一言 */
const TUT_LOCK_DEFS = {
  shelf:   { icon:"📚", line:"まだ作品がないにゃ。最初のリリースで開くよ",
             bars:() => [["🎉", S.totals.releases, 1, "作品リリース"]] },
  stats:   { icon:"📊", line:"記録は最初のリリースから付け始めるにゃ",
             bars:() => [["🎉", S.totals.releases, 1, "作品リリース"]] },
  factory: { icon:"🏭", line:"道具は最初のリリースのあと、ご褒美のコインで買えるにゃ",
             bars:() => [["🎉", S.totals.releases, 1, "作品リリース"]] },
  research:{ icon:"🔬", line:"研究ポイントが2つたまると開くにゃ",
             bars:() => [["🔬", cumRP(), 2, "研究ポイント（累計）"]] },
  click:   { icon:"👆", line:"応援をたくさんしてくれたら開くにゃ（作品を4つ出しても開くよ）",
             bars:() => [["👆", S.totals.clicks, 30, "応援クリック"], ["🎉", S.totals.releases, 4, "作品リリース"]] },
  staff:   { icon:"👥", line:"稼ぎがたまると、仲間を雇えるようになるにゃ",
             bars:() => [["🪙", Math.floor(S.totals.coinsEarned), 220, "累計コイン"]] },
  requests:{ icon:"📮", line:"仲間ができると、お客さんが来るようになるにゃ",
             bars:() => [["🐱", S.totals.hired, 1, "スタッフ雇用"], ["🎉", S.totals.releases, 5, "作品リリース"]] }
};
function tutLockPanelHTML(tab){
  const d = TUT_LOCK_DEFS[tab];
  if(!d) return "";
  return "<div class='lockpanel'><div class='lockbig'>" + d.icon + "</div>" +
    "<div class='locklock'>🔒 まだ開いていないにゃ</div>" +
    "<div class='lockconds'>" + condBarsHTML(d.bars()) + "</div>" +
    "<div class='lockline'>🐱 " + d.line + "</div></div>";
}
/* 帯の目的チップ: 🎯 + 動詞1つ + 不足数だけ。達成したら消える (設計 §4) */
function stripQuestText(){
  if(!S.tut || S.tut.skipped) return "";
  if(tutCelebrate && Date.now() < tutCelebrate.until) return tutCelebrate.text;
  if(currentBottleneck()) return "";   /* ⚠ 表示が優先される間は目的を引っ込める */
  const seen = S.tut.seen || {};
  switch(S.tut.stage){
    case 0: return "🎯 最初の作品ができるまで見守ろう";
    case 1: {
      if(seen.q1) return "";
      let cheapest = Infinity;
      for(const d of UPGRADE_DEFS){
        if(d.id === "bot") continue;
        const lv = S.upgrades[d.id] || 0;
        if(lv < d.max) cheapest = Math.min(cheapest, upgradeCost(d, lv));
      }
      if(!isFinite(cheapest)) return "";
      const short = Math.max(0, Math.ceil(cheapest - S.coins));
      /* 不足分は文の先頭に出す: メモの右側は机のみゅけの頭に隠れやすい */
      return short > 0 ? "🎯 あと " + fmt(short) + "🪙 で工場の道具を1つ買えるにゃ" : "🎯 工場で道具を1つ買おう（買えるにゃ！）";
    }
    case 2: {
      if(seen.q2) return "";
      let cheapest = Infinity;
      for(const d of RESEARCH_DEFS) if(!S.research[d.id]) cheapest = Math.min(cheapest, d.cost);
      if(!isFinite(cheapest)) return "";
      const short = Math.max(0, cheapest - Math.floor(S.rp));
      return short > 0 ? "🎯 あと 🔬" + short + " で研究を1つ終わらせられるにゃ" : "🎯 研究を1つ終わらせよう（できるにゃ！）";
    }
    case 3: return seen.q3 ? "" : "🎯 応援タブで強化を1つ買おう";
    case 4: return seen.q4 ? "" : "🎯 スタッフを1人雇おう";
    case 5: return seen.q5 ? "" : "🎯 依頼を1つ受けよう";
    case 6: {
      if(S.line2.unlocked) return "";
      const short = Math.max(0, BAL.line2BuildCost - Math.floor(S.coins));
      return short > 0 ? "🎯 あと " + fmt(short) + "🪙 で第2ラインを建てられるにゃ" : "🎯 第2ラインを建てよう（建てられるにゃ！）";
    }
  }
  return "";
}
/* 吊りメモをクリックしたときに開くタブ: チュートリアルの目的が出ている間はその目的の
   タブ (工場・研究・応援・スタッフ…)、それ以外は依頼タブ。以前は常に依頼タブで、
   序盤はロック画面に飛ばされていた */
const QUEST_TABS = { 0: "proj", 1: "factory", 2: "research", 3: "click", 4: "staff", 5: "requests", 6: "factory" };
function stripMemoTab(){
  const q = stripQuestText();
  if(q && !(tutCelebrate && Date.now() < tutCelebrate.until)){
    const tab = QUEST_TABS[S.tut.stage];
    if(tab && !tutTabLocked(tab)) return tab;
  }
  return tutTabLocked("requests") ? "proj" : "requests";
}
/* Stage 3: リーダーボード下の吊りメモの文面。チュートリアルの目的 (旧クエスト
   チップ) → 受注中の依頼 → 新着依頼の順。何も無ければメモ自体を出さない */
function stripMemoText(){
  const q = stripQuestText();
  if(q) return q;
  if(tutTabLocked("requests")) return "";
  if(S.bigDeal) return "🌟 大型案件: " + S.bigDeal.client + "（" + S.bigDeal.genreName + "・L以上）担当 " + S.bigDeal.repName + " が待ってるにゃ";
  if(S.activeRequest){
    const r = S.activeRequest;
    /* 拡張ウェーブ G: 納期が迫ったらメモにも残り時間を出す（帯で気づけるように） */
    if(r.deadlineAt){
      const left = Math.ceil((r.deadlineAt - Date.now()) / 60000);
      if(left <= 10) return "⏰ 納期 あと " + Math.max(0, left) + " 分！" + r.client + "の依頼（" + r.genreName + "）";
    }
    return "📮 " + r.client + "の依頼：次の作品は「" + r.genreName + "」で作る" + (r.repName ? "（担当：" + r.repName + "）" : "");
  }
  /* 第2ウェーブ L: トレンドの入れ替え直後だけメモでも知らせる（10分） */
  if(S.trend && S.trend.announceAt && Date.now() - S.trend.announceAt < 600000){
    const bg = GENRES.find(g => g.id === S.trend.boom);
    return "📊 市場: 「" + (bg ? bg.name : "") + "」がブーム中（価格 ×1.5）";
  }
  if(S.requests && S.requests.length) return "📮 新しい依頼が " + S.requests.length + " 件あるにゃ";
  return "";
}

