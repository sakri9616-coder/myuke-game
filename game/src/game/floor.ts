/* ---------- 工場フロア（工業拡張・最小試作 2026-11-20） ----------
   設計の正本: research/factory-expansion-refs-20261120.md（決定群＋転用原則10）、
   research/factory-floor-design-20261120.md（骨格 v0）、
   数値の正本: research/../miyuke-redesign/leveldesign-r5-factory.md（LD Round 5）。
   ・組み立ては管理画面の工場フロア、帯は流れの表示に徹する
   ・配置が決めるのは資源分配・効率・比重。力そのもの（絶対量）はレベル/強化が作る
   ・数値はすべて FLOOR_CFG 駆動（LD 裁定の差し替えはここ）
   試作の範囲: フロア1枚（土地1）、5工程マシンの配置、Link と運搬猫、
   配置に応じた実効レートと信号、入力バッファの滞留。土地購入・仕入れ・
   副産物活用・複数ラインは第3段。
   既存セーブには標準レイアウト（LD §5）を自動生成し、スタッフの自動
   割り当てもその時に行う（移行でスタッフの効き目を消さない） */

/* 工程の並び（チェーン順）。Link はこの順で隣り合う工程の間にだけ引ける */
const FLOOR_KINDS = [
  { id: "plan",  name: "企画",   color: "#c586c0" },
  { id: "code",  name: "実装",   color: "#4da3ff" },
  { id: "test",  name: "テスト", color: "#e8b93a" },
  { id: "build", name: "ビルド", color: "#5aa469" },
  { id: "ship",  name: "出荷",   color: "#e8833a" }
];
/* LD Round 5 の数値（§1〜§3）。比率（基礎レート同士の比）は最後まで触らない対象 */
const FLOOR_CFG = {
  gridW: 14, gridH: 6,          /* 土地1の寸法（LD §4） */
  machineSize: 2,               /* マシンの占有は全種 2×2（LD §4） */
  base: { plan: 32, code: 8, test: 16, build: 16, ship: 16 } as Record<string, number>,   /* Lv1・猫なし DP/分（LD §1） */
  lvPer: 0.5,                   /* レート = 基礎 × (1 + 0.5×(Lv−1)) + クルー（LD §1・仮置き曲線） */
  equip: { code: "devenv", test: "tester", build: "ci", ship: "pack" } as Record<string, string>,   /* Lv の対応 = 既存の工程アップグレード（LD §1）。企画は Lv1 固定 */
  crewMax: 2,                   /* クルーは1マシン2匹まで（LD §1） */
  linkFloorDiv: 4,              /* Link 容量の下限 = 下流レート ÷ 4（LD §2） */
  linkFloorMin: 4,
  catBase: 40,                  /* 運搬猫1匹の容量 = 40 ÷ (1 + 距離÷10) × staffOutMult（LD §2） */
  catDistDiv: 10,
  bufMin: 40,                   /* 入力バッファ上限 = max(40, レート×5分)（LD §3） */
  bufMinutes: 5,
  bridgeCap: 2                  /* 試作の接続: 配置倍率の上限（標準比） */
};

function floorKindIdx(kind){ return FLOOR_KINDS.findIndex(k => k.id === kind); }
function floorKindDef(kind){ return FLOOR_KINDS[floorKindIdx(kind)] || FLOOR_KINDS[0]; }
function floorStaffById(id){ return (S.staff || []).find(s => s.id === id) || null; }
/* クルー1匹の寄与（現行のスタッフ出力をそのまま: LD §1） */
function floorCrewOut(st, kind){
  if(!st) return 0;
  if(kind === "code" && st.role === "prog") return (STAFF_ROLES.prog.out || 6) * staffOutMult(st);
  if(kind === "test" && st.role === "test") return (BAL.testStaffDP || 8) * staffOutMult(st);
  if(kind === "ship" && st.role === "carry") return (STAFF_ROLES.carry.out || 8) * staffOutMult(st);
  return 0;
}
function floorCrewRole(kind){ return kind === "code" ? "prog" : kind === "test" ? "test" : kind === "ship" ? "carry" : null; }
/* マシンの Lv（既存の工程アップグレード Lv + 1。企画は Lv1 固定: LD §1） */
function floorLv(kind){
  const eq = FLOOR_CFG.equip[kind];
  return eq ? 1 + (S.upgrades[eq] || 0) : 1;
}
/* マシン1台のレート（DP/分）: 基礎 × Lv曲線 ＋ クルー合計。実装だけ星屑倍率（LD §0/§1 の非対称） */
function floorMachineRate(m){
  let r = (FLOOR_CFG.base[m.kind] || 0) * (1 + FLOOR_CFG.lvPer * (floorLv(m.kind) - 1));
  for(const id of (m.crew || [])) r += floorCrewOut(floorStaffById(id), m.kind);
  if(m.kind === "code") r *= dustMult();
  return r;
}
/* Link の搬送容量（DP/分）: 下限（下流レート÷4、最低4）＋ 運搬猫の合計（LD §2）。
   距離は中心間マンハッタン（マス） */
function floorLinkDist(a, b){
  const s = FLOOR_CFG.machineSize;
  return Math.abs((a.x + s / 2) - (b.x + s / 2)) + Math.abs((a.y + s / 2) - (b.y + s / 2));
}
function floorLinkCap(l, machines){
  const byId = new Map(machines.map(m => [m.id, m]));
  const a = byId.get(l.from), b = byId.get(l.to);
  if(!a || !b) return 0;
  let cap = Math.max(FLOOR_CFG.linkFloorMin, floorMachineRate(b) / FLOOR_CFG.linkFloorDiv);
  for(const id of (l.cats || [])){
    const st = floorStaffById(id);
    if(st && st.role === "carry") cap += FLOOR_CFG.catBase / (1 + floorLinkDist(a, b) / FLOOR_CFG.catDistDiv) * staffOutMult(st);
  }
  return cap;
}

/* 標準レイアウト（LD §5: 直線1本・全リンク隣接・全工程16DP/分で一致） */
function floorStandardLayout(){
  const pos = [["plan", 0, 2], ["code", 2, 2], ["code", 4, 2], ["test", 6, 2], ["build", 8, 2], ["ship", 10, 2]] as [string, number, number][];
  const machines: FloorMachine[] = pos.map((p, i) => ({ id: i + 1, kind: p[0], x: p[1], y: p[2], crew: [], buf: 0, hold: 0 }));
  const links: FloorLink[] = [
    { from: 1, to: 2, cats: [] }, { from: 1, to: 3, cats: [] },
    { from: 2, to: 4, cats: [] }, { from: 3, to: 4, cats: [] },
    { from: 4, to: 5, cats: [] }, { from: 5, to: 6, cats: [] }
  ];
  return { machines, links, seq: 7 };
}
/* スタッフの自動割り当て（LD §5: 移行生成時のみ。クルーは役職の合う工程へ
   ラウンドロビン、運搬は下流リンク優先、余った運搬は出荷クルーへ） */
function floorAutoAssign(f: { machines: FloorMachine[]; links: FloorLink[] }, staff: StaffMember[]){
  const used = new Set<number>();
  const byKind = (kind: string) => f.machines.filter(m => m.kind === kind);
  for(const kind of ["code", "test"]){
    const role = floorCrewRole(kind);
    const pool = staff.filter(s => s.role === role && !used.has(s.id));
    const ms = byKind(kind);
    let i = 0;
    for(const st of pool){
      let placed = false;
      for(let t = 0; t < ms.length; t++){
        const m = ms[(i + t) % ms.length];
        if((m.crew || []).length < FLOOR_CFG.crewMax){ m.crew = [...(m.crew || []), st.id]; used.add(st.id); placed = true; i++; break; }
      }
      if(!placed) break;
    }
  }
  const carriers = staff.filter(s => s.role === "carry" && !used.has(s.id));
  const kindOf = (id: number) => { const m = f.machines.find(mm => mm.id === id); return m ? floorKindIdx(m.kind) : 0; };
  const ordered = [...f.links].sort((a, b) => (kindOf(b.to) - kindOf(a.to)) || (kindOf(b.from) - kindOf(a.from)) || (a.from - b.from));
  let ci = 0;
  for(const l of ordered){ if(ci >= carriers.length) break; l.cats = [carriers[ci++].id]; used.add(carriers[ci - 1].id); }
  for(const m of byKind("ship")){
    while(ci < carriers.length && (m.crew || []).length < FLOOR_CFG.crewMax){
      m.crew = [...(m.crew || []), carriers[ci].id]; used.add(carriers[ci].id); ci++;
    }
  }
  return f;
}
function floorStandard(){
  const f = floorStandardLayout();
  floorAutoAssign(f, S.staff || []);
  return f;
}
/* セーブのフロアを正規化して返す（旧セーブ・未初期化なら標準レイアウト＋自動割り当て） */
function floorEnsure(){
  const f = S.floor;
  if(!f || !Array.isArray(f.machines) || !Array.isArray(f.links) || typeof f.seq !== "number"){
    S.floor = floorStandard();
    return S.floor;
  }
  for(const m of f.machines){
    if(floorKindIdx(m.kind) < 0) m.kind = "code";
    m.x = Math.max(0, Math.min(FLOOR_CFG.gridW - FLOOR_CFG.machineSize, m.x | 0));
    m.y = Math.max(0, Math.min(FLOOR_CFG.gridH - FLOOR_CFG.machineSize, m.y | 0));
    if(!Array.isArray(m.crew)) m.crew = [];
    if(typeof m.buf !== "number") m.buf = 0;
    if(typeof m.hold !== "number") m.hold = 0;
  }
  const ids = new Set(f.machines.map(m => m.id));
  f.links = f.links.filter(l => ids.has(l.from) && ids.has(l.to) && l.from !== l.to);
  for(const l of f.links) if(!Array.isArray(l.cats)) l.cats = [];
  return f;
}
function floorMachines(kind){ return floorEnsure().machines.filter(m => m.kind === kind); }
function floorMachineById(id){ return floorEnsure().machines.find(m => m.id === id) || null; }
function floorLinksBetween(fromKind, toKind){
  const f = floorEnsure();
  const a = new Set(f.machines.filter(m => m.kind === fromKind).map(m => m.id));
  const b = new Set(f.machines.filter(m => m.kind === toKind).map(m => m.id));
  return f.links.filter(l => a.has(l.from) && b.has(l.to)).length;
}

/* 工程の「力」= その工程の全マシンのレート合計（DP/分） */
function floorPower(kind){ return floorMachines(kind).reduce((s, m) => s + floorMachineRate(m), 0); }

/* 定常フロー（DP/分）: 工程順に1パスで伝播させる（分岐は均等割り、合流は合算）。
   マシンのフロー = min(レート, 入力フロー)、Link のフロー = min(割当, 搬送容量) */
function floorComputeFlows(machines: FloorMachine[], links: FloorLink[]){
  const flow = new Map<number, number>();
  const linkFlow = new Map<string, number>();
  const byKind = new Map<string, FloorMachine[]>();
  for(const m of machines){ if(!byKind.has(m.kind)) byKind.set(m.kind, []); byKind.get(m.kind)!.push(m); }
  for(const k of FLOOR_KINDS){
    for(const m of byKind.get(k.id) || []){
      const rate = floorMachineRate(m);
      let inflow = Infinity;
      if(k.id !== "plan"){
        inflow = 0;
        for(const l of links) if(l.to === m.id) inflow += linkFlow.get(l.from + ">" + l.to) || 0;
      }
      const f = Math.min(rate, inflow);
      flow.set(m.id, f);
      const outs = links.filter(l => l.from === m.id);
      for(const l of outs){
        const share = outs.length ? f / outs.length : 0;
        linkFlow.set(l.from + ">" + l.to, Math.min(share, floorLinkCap(l, machines)));
      }
    }
  }
  return { flow, linkFlow };
}
function floorFlow(kind){
  const f = floorEnsure();
  const { flow } = floorComputeFlows(f.machines, f.links);
  return f.machines.filter(m => m.kind === kind).reduce((s, m) => s + (flow.get(m.id) || 0), 0);
}
/* 標準レイアウト（現在の Lv・スタッフで自動割り当て）のフロー — 配置倍率の基準 */
function floorStandardFlow(kind){
  const std = floorStandard();
  const { flow } = floorComputeFlows(std.machines, std.links);
  return std.machines.filter(m => m.kind === kind).reduce((s, m) => s + (flow.get(m.id) || 0), 0);
}
/* 実パイプへの接続倍率（試作の橋渡し）: その工程のフロー ÷ 標準レイアウトのフロー。
   標準レイアウトでは全工程 1 になり、現行の生産・信号と完全に一致する。
   配置を良くすれば上がり（上限 bridgeCap）、悪くすれば下がる。絶対較正
   （フロアのレートそのもので production を駆動する接続）は LD §7 ゲート5/6 の段 */
function floorCapMult(kind){
  const std = floorStandardFlow(kind);
  if(std <= 0) return floorFlow(kind) > 0 ? 1 : 0;
  return Math.max(0, Math.min(FLOOR_CFG.bridgeCap, floorFlow(kind) / std));
}
/* 配置込みの実効レート表示（DP/分）= 定常フロー */
function floorEffRate(kind){ return floorFlow(kind); }

/* ---------- バッファと滞留の簡易シミュレーション（信号の材料） ----------
   1秒ごとに tick から呼ばれる。実パイプ（S.wip）とは独立の、フロア内の
   滞留モデル: マシンは入力バッファを処理して下流へ押し、バッファ上限で
   上流が止まり（溢れ）、空で下流が止まる（空）。モノは捨てない（LD §3） */
let floorSim = { overflow: new Set<string>(), starved: new Set<string>(), shipped: 0 };
function floorBufCap(m: FloorMachine){ return Math.max(FLOOR_CFG.bufMin, floorMachineRate(m) * FLOOR_CFG.bufMinutes); }
function floorTick(dtSec){
  const f = floorEnsure();
  const dt = dtSec / 60;
  const overflow = new Set<string>(), starved = new Set<string>();
  const byId = new Map(f.machines.map(m => [m.id, m]));
  /* 処理（下流から先に捌くと、同 tick 内で押し出し先が空く）。
     出力側が満杯なら処理自体が止まる（背圧）: 在庫は buf+hold の上限で
     頭打ちになり、どの工程の前にも一方的に増え続けない */
  for(let ki = FLOOR_KINDS.length - 1; ki >= 0; ki--){
    for(const m of f.machines.filter(mm => mm.kind === FLOOR_KINDS[ki].id)){
      const rate = floorMachineRate(m) * (m.kind === "test" ? bugFactor() : 1);
      const room = Math.max(0, floorBufCap(m) - m.hold);
      if(m.kind === "plan"){ m.hold += Math.min(rate * dt, room); continue; }
      const take = m.kind === "ship" ? Math.min(m.buf, rate * dt) : Math.min(m.buf, rate * dt, room);
      if(take < rate * dt - 1e-9 && m.buf <= 0) starved.add(m.kind);
      m.buf -= take;
      if(m.kind === "ship") floorSim.shipped += take;
      else m.hold += take;
    }
  }
  /* 押し出し（上流から）: Link 容量と下流バッファの空きで制限される */
  for(const k of FLOOR_KINDS){
    for(const m of f.machines.filter(mm => mm.kind === k.id)){
      if(m.hold <= 0) continue;
      const outs = f.links.filter(l => l.from === m.id);
      if(!outs.length){ overflow.add(m.kind); continue; }
      let pushed = 0;
      for(const l of outs){
        const down = byId.get(l.to);
        if(!down) continue;
        const share = m.hold / outs.length;
        const can = Math.min(share, floorLinkCap(l, f.machines) * dt, Math.max(0, floorBufCap(down) - down.buf));
        down.buf += can; pushed += can;
      }
      m.hold -= pushed;
      if(m.hold > 1e-9) overflow.add(m.kind);
    }
  }
  floorSim.overflow = overflow; floorSim.starved = starved;
}

/* 工程の信号（stageStatus の文法を不変に、配置由来の状態を統合。
   状態語は「溢れ」「空」の2語に固定し、新色は作らない: UX §5） */
function floorStatus(kind){
  if(floorMachines(kind).length === 0) return { key: "off", label: "マシンなし", color: "#8a8a8a" };
  const ki = floorKindIdx(kind);
  if(ki > 0 && floorLinksBetween(FLOOR_KINDS[ki - 1].id, kind) === 0)
    return { key: "cut", label: "つながっていない", color: "#d9534f" };
  if(floorSim.overflow.has(kind)) return { key: "overflow", label: "溢れ", color: "#d9534f" };
  if(floorSim.starved.has(kind)) return { key: "starved", label: "空", color: "#e8b93a" };
  const st = stageStatus().find(s => s.id === kind);
  if(st && st.lamp === "red") return { key: "overflow", label: "溢れ", color: "#d9534f" };
  if(st && st.lamp === "yellow") return { key: "starved", label: "空", color: "#e8b93a" };
  return { key: "flow", label: "流れている", color: "#5aa469" };
}

/* ---------- 編集 UI の揮発状態（保存しない） ---------- */
let floorView = "plan";        /* "plan" = 計画（数値） / "edit" = 配置（グリッド） */
let floorTool = "code";        /* パレットで選択中の道具: 工程 kind / "link" / "erase" */
let floorLinkFrom: number | null = null;   /* Link 作成中: 始点マシンの id */

/* ---------- 編集操作（配置は無料・即時・可逆: 転用原則7） ---------- */
function floorPlace(kind, x, y){
  const f = floorEnsure(), s = FLOOR_CFG.machineSize;
  if(x < 0 || y < 0 || x + s > FLOOR_CFG.gridW || y + s > FLOOR_CFG.gridH) return false;
  if(f.machines.some(m => x < m.x + s && m.x < x + s && y < m.y + s && m.y < y + s)) return false;
  f.machines.push({ id: f.seq++, kind, x, y, crew: [], buf: 0, hold: 0 });
  save();
  return true;
}
function floorRemoveMachine(id){
  const f = floorEnsure();
  f.machines = f.machines.filter(m => m.id !== id);
  f.links = f.links.filter(l => l.from !== id && l.to !== id);
  save();
}
function floorCanLink(fromM, toM){
  if(!fromM || !toM || fromM.id === toM.id) return false;
  return floorKindIdx(toM.kind) === floorKindIdx(fromM.kind) + 1;
}
function floorAddLink(fromId, toId){
  const f = floorEnsure();
  const a = floorMachineById(fromId), b = floorMachineById(toId);
  if(!floorCanLink(a, b)) return false;
  if(f.links.some(l => l.from === fromId && l.to === toId)) return false;
  f.links.push({ from: fromId, to: toId, cats: [] });
  save();
  return true;
}
function floorRemoveLinkAt(cx, cy){
  const f = floorEnsure(), s = FLOOR_CFG.machineSize;
  for(let i = 0; i < f.links.length; i++){
    const a = floorMachineById(f.links[i].from), b = floorMachineById(f.links[i].to);
    if(!a || !b) continue;
    const mx = (a.x + b.x) / 2 + s / 2, my = (a.y + b.y) / 2 + s / 2;
    if(Math.abs(cx - mx) <= 0.8 && Math.abs(cy - my) <= 0.8){ f.links.splice(i, 1); save(); return true; }
  }
  return false;
}
function floorReset(){
  S.floor = floorStandard();
  floorLinkFrom = null;
  save();
}

/* ---------- 工場タブのセクション（計画→配置の二段階: 転用原則5） ---------- */
let floorMsg = "";
function floorSetView(v){ floorView = v; floorMsg = ""; renderPanel(); }
function floorSetTool(t){ floorTool = t; floorLinkFrom = null; floorMsg = ""; renderPanel(); }
function floorDoReset(){ floorReset(); floorMsg = "標準レイアウトに戻したよ"; renderPanel(); }

function floorSectionHTML(){
  floorEnsure();
  let h = "<h3 style='margin-top:12px'>🏭 工場フロア <small style='color:var(--ide-sub)'>（工業拡張・試作）</small></h3>";
  h += "<div class='floorbar'>" +
    "<button class='" + (floorView === "plan" ? "on" : "") + "' onclick='floorSetView(\"plan\")'>📐 計画</button>" +
    "<button class='" + (floorView === "edit" ? "on" : "") + "' onclick='floorSetView(\"edit\")'>🧩 配置</button>" +
    "<span class='floornote'>配置が決めるのは分配・効率・比重。力そのものは工程のレベルと担当猫が作ります</span></div>";
  if(floorMsg) h += "<div class='note' style='margin-top:6px'>" + esc(floorMsg) + "</div>";
  h += floorView === "plan" ? floorPlanHTML() : floorEditHTML();
  return h;
}
/* 計画: この配置の算出結果（転用原則1）。数字は「力」と対で出す（数字の憲法） */
function floorPlanHTML(){
  let h = "<div class='floorrows'>";
  for(const k of FLOOR_KINDS){
    const st = floorStatus(k.id);
    const n = floorMachines(k.id).length;
    const power = floorPower(k.id), flow = floorEffRate(k.id);
    const ki = floorKindIdx(k.id);
    let trans = "—";
    if(ki > 0){
      const f = floorEnsure();
      const prevIds = new Set(f.machines.filter(m => m.kind === FLOOR_KINDS[ki - 1].id).map(m => m.id));
      const myIds = new Set(f.machines.filter(m => m.kind === k.id).map(m => m.id));
      const cap = f.links.filter(l => prevIds.has(l.from) && myIds.has(l.to)).reduce((s, l) => s + floorLinkCap(l, f.machines), 0);
      trans = fmtDec(cap, 0) + " DP/分";
    }
    h += "<div class='floorrow'>" +
      "<span class='fk' style='border-color:" + k.color + "'>" + esc(k.name) + "</span>" +
      "<span class='fv'>マシン <b>" + n + "</b> 台</span>" +
      "<span class='fv'>力 <b>" + fmtDec(power, 0) + "</b> DP/分</span>" +
      "<span class='fv'>実効フロー <b>" + fmtDec(flow, 0) + "</b> DP/分" +
        (power > 0 ? " <small>（力の " + Math.round(flow / power * 100) + "%）</small>" : "") + "</span>" +
      "<span class='fv'>搬送容量 <b>" + trans + "</b></span>" +
      "<span class='fv'>配置倍率 <b>×" + fmtDec(floorCapMult(k.id), 2) + "</b></span>" +
      "<span class='fchip' style='background:" + st.color + "'>" + esc(st.label) + "</span>" +
      "</div>";
  }
  h += "</div>";
  h += "<div class='note' style='margin-top:6px'>この配置の出荷フローは <b>" + fmtDec(floorEffRate("ship"), 0) + " DP/分</b>（標準レイアウト比 ×" + fmtDec(floorCapMult("ship"), 2) + "）。" +
    "数値は LD Round 5 の裁定（基礎レート 企画32／実装8／テスト16／ビルド16／出荷16、Link 容量 = 下流÷4 ＋ 運搬猫 40÷(1+距離÷10)）。生産への接続は試作の橋渡しとして「標準レイアウト比の配置倍率」で行っています。</div>";
  return h;
}
/* 配置: パレット＋グリッドキャンバス。描画は floorDraw（renderPanel の末尾から） */
function floorEditHTML(){
  let h = "<div class='floorbar'>";
  for(const k of FLOOR_KINDS)
    h += "<button class='floortool " + (floorTool === k.id ? "on" : "") + "' onclick='floorSetTool(\"" + k.id + "\")'><i style='background:" + k.color + "'></i>" + esc(k.name) + "</button>";
  h += "<button class='floortool " + (floorTool === "link" ? "on" : "") + "' onclick='floorSetTool(\"link\")'>🔗 つなぐ</button>" +
    "<button class='floortool " + (floorTool === "erase" ? "on" : "") + "' onclick='floorSetTool(\"erase\")'>🧹 消す</button>" +
    "<button class='floortool' onclick='floorDoReset()'>↩️ 標準に戻す</button></div>";
  h += "<div class='floornote' style='margin:4px 0 6px'>" +
    (floorTool === "link"
      ? (floorLinkFrom !== null ? "つなぎ先のマシン（次の工程）をクリック。やめるときは空きマスをクリック" : "つなぎ元のマシンをクリック（Link は隣り合う工程の間にだけ引けます）")
      : floorTool === "erase" ? "マシンをクリックで撤去（Link も一緒に消えます）。Link の中点あたりをクリックすると Link だけ消せます"
      : "空きマスをクリックで「" + esc(floorKindDef(floorTool).name) + "」マシン（2×2）を置きます。配置は無料・その場で生産に反映されます") + "</div>";
  h += "<canvas id='floorCv' width='840' height='360' onclick='floorCanvasClick(event)'></canvas>";
  return h;
}
function floorMachineAt(cx, cy){
  const s = FLOOR_CFG.machineSize;
  return floorEnsure().machines.find(m => cx >= m.x && cx < m.x + s && cy >= m.y && cy < m.y + s) || null;
}
function floorCanvasClick(ev){
  const cv = ev.currentTarget;
  const rect = cv.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * cv.width / rect.width;
  const py = (ev.clientY - rect.top) * cv.height / rect.height;
  const cell = cv.width / FLOOR_CFG.gridW;
  const cx = Math.floor(px / cell), cy = Math.floor(py / cell);
  if(cx < 0 || cy < 0 || cx >= FLOOR_CFG.gridW || cy >= FLOOR_CFG.gridH) return;
  floorMsg = "";
  if(floorTool === "erase"){
    const m = floorMachineAt(cx, cy);
    if(m){ floorRemoveMachine(m.id); if(floorLinkFrom === m.id) floorLinkFrom = null; }
    else if(!floorRemoveLinkAt(cx + 0.5, cy + 0.5)) floorMsg = "そこには何もないよ";
  } else if(floorTool === "link"){
    const m = floorMachineAt(cx, cy);
    if(floorLinkFrom === null){
      if(!m) floorMsg = "まず、つなぎ元のマシンをクリックしてね";
      else if(floorKindIdx(m.kind) >= FLOOR_KINDS.length - 1) floorMsg = "「" + esc(floorKindDef(m.kind).name) + "」の先には工程がないよ";
      else floorLinkFrom = m.id;
    } else {
      if(m && floorAddLink(floorLinkFrom, m.id)) floorMsg = "つないだよ";
      else if(m) floorMsg = "つなげるのは隣り合う工程のマシンどうしだけだよ";
      floorLinkFrom = null;
    }
  } else {
    if(!floorPlace(floorTool, cx, cy)) floorMsg = "その場所には置けないよ（2×2 の空きが必要）";
  }
  renderPanel();
}
/* グリッド描画（色は IDE トークンの実値。キャンバスは CSS 変数を読めないため） */
function floorDraw(){
  const cv = document.getElementById("floorCv") as HTMLCanvasElement | null;
  if(!cv || typeof cv.getContext !== "function") return;
  const ctx = cv.getContext("2d");
  if(!ctx) return;
  const f = floorEnsure();
  const W = cv.width, H = cv.height, cell = W / FLOOR_CFG.gridW, s = FLOOR_CFG.machineSize;
  ctx.fillStyle = "#1E1E1E"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#2B2B2B"; ctx.lineWidth = 1;
  for(let x = 0; x <= FLOOR_CFG.gridW; x++){ ctx.beginPath(); ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, H); ctx.stroke(); }
  for(let y = 0; y <= FLOOR_CFG.gridH; y++){ ctx.beginPath(); ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(W, y * cell + 0.5); ctx.stroke(); }
  const center = (m: FloorMachine) => ({ x: (m.x + s / 2) * cell, y: (m.y + s / 2) * cell });
  for(const l of f.links){
    const a = floorMachineById(l.from), b = floorMachineById(l.to);
    if(!a || !b) continue;
    const pa = center(a), pb = center(b);
    ctx.strokeStyle = "#007ACC"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    ctx.fillStyle = "#007ACC";
    ctx.beginPath();
    ctx.moveTo(pb.x - Math.cos(ang) * cell * 0.9, pb.y - Math.sin(ang) * cell * 0.9);
    ctx.lineTo(pb.x - Math.cos(ang) * cell * 0.9 - Math.cos(ang - 2.6) * 9, pb.y - Math.sin(ang) * cell * 0.9 - Math.sin(ang - 2.6) * 9);
    ctx.lineTo(pb.x - Math.cos(ang) * cell * 0.9 - Math.cos(ang + 2.6) * 9, pb.y - Math.sin(ang) * cell * 0.9 - Math.sin(ang + 2.6) * 9);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, 3, 0, Math.PI * 2); ctx.fill();
    if((l.cats || []).length){   /* 運搬猫の頭数 */
      ctx.fillStyle = "#D4D4D4"; ctx.font = "700 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText("🐱×" + l.cats.length, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 5);
    }
  }
  for(const m of f.machines){
    const k = floorKindDef(m.kind), st = floorStatus(m.kind);
    const x = m.x * cell + 5, y = m.y * cell + 5, w = s * cell - 10, hgt = s * cell - 10;
    ctx.fillStyle = "#2D2D2D";
    ctx.strokeStyle = floorLinkFrom === m.id ? "#FFFFFF" : k.color;
    ctx.lineWidth = floorLinkFrom === m.id ? 3 : 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, hgt, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = k.color; ctx.fillRect(x, y, w, 5);
    /* 状態バッジ: 溢れは下流側（右上）、空は上流側（左上）— UX §5.2 の文法 */
    const badge = (bx: number, word: string, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(bx, y + 13, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = "700 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(word, bx, y + 24);
    };
    if(st.key === "overflow") badge(x + w - 10, "溢れ", st.color);
    else if(st.key === "starved" || st.key === "cut") badge(x + 10, st.key === "cut" ? "" : "空", st.color);
    else { ctx.fillStyle = st.color; ctx.beginPath(); ctx.arc(x + w - 9, y + 13, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#D4D4D4";
    ctx.font = "700 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(k.name, x + w / 2, y + hgt / 2 + 2);
    ctx.font = "10px sans-serif"; ctx.fillStyle = "#969696";
    ctx.fillText(fmtDec(floorMachineRate(m), 0) + "/分" + ((m.crew || []).length ? " 🐱×" + m.crew.length : ""), x + w / 2, y + hgt / 2 + 17);
    if(m.kind !== "plan" && m.buf > 0.5){   /* 入力バッファの滞留バー */
      const bw = Math.min(1, m.buf / floorBufCap(m));
      ctx.fillStyle = "#454545"; ctx.fillRect(x + 6, y + hgt - 9, w - 12, 4);
      ctx.fillStyle = st.color; ctx.fillRect(x + 6, y + hgt - 9, (w - 12) * bw, 4);
    }
  }
}
