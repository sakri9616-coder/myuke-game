/* ---------- 購入・研究・依頼・プレステージ ---------- */
function buyUpgrade(id){
  const def = UPGRADE_DEFS.find(u=>u.id===id);
  const lv = S.upgrades[id]||0;
  if(lv >= def.max){ say("もう最大レベルにゃ"); return; }
  const cost = upgradeCost(def, lv);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost; S.upgrades[id] = lv + 1;
  SoundKit.play("purchase");
  addLog("アップグレード: "+def.name+" Lv"+(lv+1)+"（-" + fmt(cost) + "🪙）");
  say(def.name+"を買ったにゃ！");
  if(id==="bot") say("子ねこボットが仲間になったにゃ！");
  checkStamps(); save(); renderPanel();
  tutCheck();
}
function buyResearch(id){
  const def = RESEARCH_DEFS.find(r=>r.id===id) || REPEAT_RESEARCHES.find(r=>r.id===id);
  if(!def) return;
  /* Sprint 4: 反復研究はレベル制（価格は 1.6 倍ずつ） */
  if(def.repeatable){
    const lv = (S.researchLv && S.researchLv[id]) || 0;
    const cost = repeatResearchCost(lv);
    if(S.rp < cost){ say("研究ポイントが足りないにゃ"); return; }
    S.rp -= cost;
    if(!S.researchLv) S.researchLv = {};
    S.researchLv[id] = lv + 1;
    SoundKit.play("purchase");
    addLog("反復研究: "+def.name+" Lv"+(lv+1)+"（"+def.desc.replace("/Lv","")+"）（-"+cost+"🔬）");
    say("『"+def.name+"』Lv"+(lv+1)+" にゃ。地味に効くよ");
    save(); renderPanel();
    tutCheck();
    return;
  }
  if(S.research[id]) return;
  /* Sprint 4: ティア2は前提研究が完了していないと買えない */
  if(def.requires && !S.research[def.requires]){
    say("先に『"+((RESEARCH_DEFS.find(r=>r.id===def.requires)||{}).name || "")+"』の研究が必要にゃ");
    return;
  }
  if(S.rp < def.cost){ say("研究ポイントが足りないにゃ"); return; }
  S.rp -= def.cost; S.research[id] = true;
  SoundKit.play("purchase");
  addLog("研究完了: "+def.name);
  say("研究『"+def.name+"』が終わったにゃ！");
  save(); renderPanel();
  tutCheck();
}
function hireStaff(role){
  const def = STAFF_ROLES[role];
  if(S.staff.length >= staffCap()){ say("スタジオがいっぱいにゃ。スタジオ拡張してね"); return; }
  const cost = hireCost(role);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost;
  const st: StaffMember = { id: ++S.staffSeq, name: genCatName(),
    coat: COATS[Math.floor(Math.random()*COATS.length)], role, lv: 1 };
  S.staff.push(st);
  if(role === "sales"){
    /* Phase C: 営業は雇用時に得意ジャンルが1つ決まる（担当依頼の質に効く） */
    const pool = unlockedGenres();
    st.genre = pool.length ? pool[Math.floor(Math.random()*pool.length)].id : "app";
    const sg = GENRES.find(x => x.id === st.genre);
    addLog("💼 " + st.name + " の得意ジャンルは「" + (sg ? sg.name : st.genre) + "」");
  }
  S.totals.hired++;
  SoundKit.play("purchase");
  addLog("新しいスタッフ: "+def.name+"の"+st.name+"（"+COAT_NAMES[st.coat]+"）が入社！（-" + fmt(cost) + "🪙）");
  say(st.name+"、ようこそにゃ！ 一緒に開発するにゃ");
  checkStamps(); save(); renderPanel();
  tutCheck();
  if(role === "sales") maybeAutoAcquire();   /* Phase C: 転換点 — 最初の営業が入った瞬間から自動獲得 */
}
function trainStaff(id){
  const st = S.staff.find(s => s.id === id);
  if(!st) return;
  if(st.lv >= STAFF_MAX_LV){ say("もう最大レベルにゃ"); return; }
  const cost = trainCost(st);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost; st.lv++;
  SoundKit.play("purchase");
  addLog("育成: "+st.name+"（"+STAFF_ROLES[st.role].name+"）が Lv"+st.lv+" になった（-" + fmt(cost) + "🪙）");
  say(st.name+"、レベルアップにゃ！");
  save(); renderPanel();
}
function buyStudio(){
  if(S.studioLv >= STAFF_CAPS.length){ say("スタジオは最大にゃ"); return; }
  const cost = studioCost(S.studioLv);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost; S.studioLv++;
  /* Phase B: 最高到達社格を更新（売却で studioLv が戻っても残る永続記録） */
  S.maxStudioLv = Math.max(S.maxStudioLv || 0, S.studioLv);
  SoundKit.play("purchase");
  /* Phase B・昇格のセレモニー（仕様書2節）: セリフ＋ログの二経路。色だけに頼らない */
  addLog("🏠 スタジオ拡張！ 社格「"+companyRank()+"」 Lv"+S.studioLv+"（雇用上限 "+staffCap()+"人）（-" + fmt(cost) + "🪙）");
  say("社格が「"+companyRank()+"」になったにゃ！ スタジオが広くなって、もっと仲間を呼べるよ");
  if(S.studioLv === 5){
    /* Phase D: 準大手で子会社が解放される。帯のボード右端タブにも社格が
       出ているので、気づきはログ＋セリフの二経路で届ける */
    addLog("🏢 グループ子会社が解放されたにゃ！（スタッフタブ）終盤はグループ全体の采配が腕の見せどころ");
    say("準大手だにゃ！ 子会社を持てるようになったよ。スタッフタブを見てみて");
  }
  save(); renderPanel();
}
function buyClickUp(id){
  const def = CLICK_DEFS.find(u=>u.id===id);
  const lv = S.clickUp[id]||0;
  if(lv >= def.max){ say("もう最大レベルにゃ"); return; }
  const cost = clickCost(def, lv);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost; S.clickUp[id] = lv + 1;
  SoundKit.play("purchase");
  addLog("応援強化: "+def.name+" Lv"+(lv+1)+"（-" + fmt(cost) + "🪙）");
  say(def.name+"を強化したにゃ！ 応援がもっと届くよ");
  updateComboUI();
  save(); renderPanel();
  tutCheck();
}
function buyLine2(){
  if(!S.research.res_line2){ say("先に研究『第2ラインの設計』が必要にゃ"); return; }
  if(S.line2.unlocked) return;
  if(S.coins < BAL.line2BuildCost){ say("コインが足りないにゃ…"); return; }
  S.coins -= BAL.line2BuildCost;
  SoundKit.play("purchase");
  S.line2.unlocked = true;
  S.line2.project = settleProject(genProject(null, S.line2.genre));
  S.line2.projectDP = 0; S.line2.commitMark = 0;
  addLog("🏭 第2ラインが完成！『"+S.line2.project.name+"』の並行開発が始まった（-"+BAL.line2BuildCost+"🪙）");
  say("第2ライン完成にゃ！ 2つの作品を同時に作れるよ");
  save(); renderPanel();
  tutCheck();
}
function setLine2Genre(gid){
  S.line2.genre = gid;
  const g = GENRES.find(x => x.id === gid);
  addLog("第2ラインの特化ジャンルを「"+(g ? g.name : gid)+"」に設定（次の作品から適用）");
  say("第2ラインは次から"+(g ? g.name : "")+"専門にゃ");
  save(); renderPanel();
}
function genRequests(){
  S.requests = [];
  const clients = REQUEST_CLIENTS.slice();
  const pool = unlockedGenres();   /* 研究でロック中のジャンルは依頼に出さない */
  for(let i=0;i<3;i++){
    const g = pool[Math.floor(Math.random()*pool.length)];
    const c = clients.splice(Math.floor(Math.random()*clients.length),1)[0];
    S.requests.push({ client:c, genre:g.id, genreName:g.name,
      text: requestText(c, g.name) });
  }
}
function acceptRequest(idx){
  /* Phase C 事後チェック対応: 自動受注の依頼は手で差し替えできる（仕様書§4）。
     大型案件だけは誤操作防止のため差し替え不可 */
  if(S.activeRequest && S.activeRequest.big){ say("大型案件の対応中は差し替えできないにゃ"); return; }
  if(S.activeRequest) addLog("依頼を差し替えた: "+S.activeRequest.client+" → "+S.requests[idx].client);
  S.activeRequest = S.requests[idx];
  if((S.activeRequest.tier || 0) >= 3 && !S.activeRequest.deadlineAt)
    S.activeRequest.deadlineAt = Date.now() + 60 * 60000;   /* 拡張ウェーブ G: ティア3の手動受注にも納期 */
  S.requests.splice(idx,1);
  /* Sprint 1: 依頼は「次の作品への予約」。進行中のプロジェクトは絶対に消さない */
  S.nextRequestGenre = S.activeRequest.genre;
  addLog("依頼を受けた: "+S.activeRequest.client+"（"+S.activeRequest.genreName+"）— 次の作品で達成");
  say(S.activeRequest.client+"の依頼、受けたにゃ。次の作品は"+S.activeRequest.genreName+"で作るよ（今の作品はそのまま続くにゃ）");
  save(); renderPanel();
  tutCheck();
}
/* ---------- Phase C: 営業と依頼の担当者制 ----------
   転換点は「最初の営業が入社した瞬間」: 受注枠が空くたび営業が自動で
   取ってくる。質（クライアント規模＝ティア／報酬／要求サイズ／ジャンルの
   寄り）は、担当した営業個人の Lv ＋ 営業部Lv と得意ジャンルで決まる。
   営業の雇用コストは他ロール同水準の base 230（研究 245 と開発 210 の間。
   育成曲線は既存と同一なので新しい価格体系は増えない） */
const SIZE_ORDER: ProjectSize[] = ["TUT", "XS", "S", "M", "L"];
const REQUEST_TIERS = [
  { name:"個人", bonus:0.6 },
  { name:"中小企業", bonus:0.9 },
  { name:"大企業", bonus:1.3 },
  { name:"自治体・グローバル級", bonus:1.8 }
];
const REQUEST_CLIENTS_TIER = [
  REQUEST_CLIENTS,
  ["商店街の文具店", "町工場の社長猫", "地元の学習塾", "小さな出版社", "駅前カフェの店長"],
  ["大手ゲーム会社", "全国チェーンの本部", "大手IT企業", "有名百貨店", "テレビ局の制作部"],
  ["市役所の広報課", "県の観光協会", "グローバルIT企業", "国際ねこ会議", "宇宙開発の広報室"]
];
function salesReps(){ return S.staff.filter(s => s.role === "sales"); }
function pickRequestGenre(rep, power){
  const pool = unlockedGenres();
  if(!pool.length) return null;
  const prefW = 3 + Math.floor(power / 3);   /* 希望ジャンルは得意ジャンルより常に優位に、力量が高いほど差が開く */
  let total = 0;
  const ws = pool.map(g => {
    let w = 1;
    if(S.reqGenrePref && g.id === S.reqGenrePref) w += prefW;
    if(S.trend && g.id === S.trend.boom) w += 2;   /* 第2ウェーブ L: 重みの優先順位は 希望 ＞ トレンド ＞ 得意 */
    if(rep.genre && g.id === rep.genre) w += 1;
    total += w; return w;
  });
  let r = Math.random() * total;
  for(let i = 0; i < pool.length; i++){ r -= ws[i]; if(r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
function salesTierFor(power){
  const cap = power >= 11 ? 3 : power >= 7 ? 2 : power >= 4 ? 1 : 0;
  return (cap > 0 && Math.random() < 0.35) ? cap - 1 : cap;
}
function autoAcquireRequest(){
  const reps = salesReps();
  if(!reps.length || S.activeRequest) return false;
  const rep = reps[(S.salesRot || 0) % reps.length];   /* 担当はローテーション（全員が質に効く） */
  S.salesRot = (S.salesRot || 0) + 1;
  const power = rep.lv + deptLv("sales") - 1;
  const tier = salesTierFor(power);
  const g = pickRequestGenre(rep, power);
  if(!g) return false;
  const clients = REQUEST_CLIENTS_TIER[tier];
  const client = clients[Math.floor(Math.random() * clients.length)];
  S.activeRequest = { client, genre: g.id, genreName: g.name, text: requestText(client, g.name),
    tier, bonus: REQUEST_TIERS[tier].bonus, reqSize: tier >= 1 ? SIZE_ORDER[tier] : null,
    repId: rep.id, repName: rep.name, auto: true,
    deadlineAt: tier >= 3 ? Date.now() + 60 * 60000 : null };   /* 拡張ウェーブ G: ティア3には納期（60分） */
  S.nextRequestGenre = g.id;
  addLog("💼 営業の"+rep.name+"が依頼を取ってきた: "+client+"（"+g.name+"・"+REQUEST_TIERS[tier].name+"）");
  say("営業の"+rep.name+"が"+client+"の依頼を取ってきたにゃ");
  /* 帯の知覚: 担当がメモを運んで歩く（動き）＋頭上に吹き出し */
  const wk = stripWalkers[rep.id];
  if(wk){ wk.carrying = true; wk.carryKind = "memo"; wk.sitting = false; wk.backing = false; }
  stripChat = { whoId: rep.id, text: "依頼、取ってきたにゃ！", until: Date.now() + 4200 };
  save();
  return true;
}
function maybeAutoAcquire(){ if(autoAcquireRequest()) renderPanel(); }
/* 大型案件（終盤）: 依頼の完了ごとに抽選で「受注待ち」が届く。受けるか
   見送るかはプレイヤーの判断（ペナルティなし・期限30分） */
function maybeSpawnBigDeal(){
  if(S.bigDeal || S.studioLv < 4) return;
  const reps = salesReps();
  if(!reps.length || Math.random() > 0.10) return;
  let rep = reps[0];
  for(const r of reps) if(r.lv > rep.lv) rep = r;
  const pool = unlockedGenres();
  if(!pool.length) return;
  const g = pool[Math.floor(Math.random() * pool.length)];
  const clients = REQUEST_CLIENTS_TIER[3];
  const client = clients[Math.floor(Math.random() * clients.length)];
  S.bigDeal = { client, genre: g.id, genreName: g.name, bonus: 2.5, reqSize: "L",
    repId: rep.id, repName: rep.name, expiresAt: Date.now() + 30 * 60000 };
  addLog("🌟 大型案件が届いた: "+client+"（"+g.name+"・Lサイズ以上・コイン+250%）担当: "+rep.name+" — 30分以内に判断してね");
  say("大型案件が届いたにゃ！ 担当は"+rep.name+"。依頼ボードで確認してね");
  save();
}
function acceptBigDeal(){
  const bd = S.bigDeal;
  if(!bd) return;
  if(S.activeRequest){ say("いま受けてる依頼があるにゃ。それが終わってからね"); return; }
  S.activeRequest = { client: bd.client, genre: bd.genre, genreName: bd.genreName,
    text: requestText(bd.client, bd.genreName), tier: 3, bonus: bd.bonus, reqSize: bd.reqSize,
    repId: bd.repId, repName: bd.repName, auto: true, big: true,
    deadlineAt: Date.now() + 45 * 60000 };   /* 拡張ウェーブ G: 大型案件には納期（45分） */
  S.nextRequestGenre = bd.genre;
  S.bigDeal = null;
  addLog("🌟 大型案件を受注: "+bd.client+"（"+bd.genreName+"）");
  say(bd.client+"の大型案件、受けたにゃ！ 次の作品は"+bd.genreName+"の大作でいくよ");
  save(); renderPanel(); tutCheck();
}
function declineBigDeal(){
  if(!S.bigDeal) return;
  addLog("大型案件を見送った: "+S.bigDeal.client+"（ペナルティなし）");
  S.bigDeal = null;
  save(); renderPanel();
}
function setReqGenrePref(gid){
  S.reqGenrePref = gid || null;
  const g = GENRES.find(x => x.id === gid);
  addLog("📮 依頼の希望ジャンルを「"+(g ? g.name : "おまかせ")+"」に設定（営業が寄せて取ってくる）");
  say(g ? "これからは"+g.name+"の依頼を多めに取ってくるにゃ" : "希望ジャンルはおまかせに戻したにゃ");
  save(); renderPanel();
}
/* 受注中の依頼の見送り（ペナルティなし）。自動で取ってきた依頼を手で
   差し替えるための出口 — 見送った後90秒は自動獲得が割り込まないので、
   その間に候補から選び直せる（猶予が過ぎれば自動が再開する） */
function dropRequestCore(){
  if(!S.activeRequest) return;
  addLog("依頼を見送った: "+S.activeRequest.client+"（ペナルティなし）");
  S.activeRequest = null; S.nextRequestGenre = null;
  S.reqHoldUntil = Date.now() + 90000;
  save(); renderPanel();
}
function dropRequest(){
  if(S.activeRequest && S.activeRequest.big){
    if(!confirm("大型案件（"+S.activeRequest.client+"）を見送りますか？\n大きなボーナスを逃します（ペナルティはありません）")) return;
  }
  dropRequestCore();
}
