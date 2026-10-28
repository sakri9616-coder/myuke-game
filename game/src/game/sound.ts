/* ---------- Sprint 2: WebAudio 効果音キット（アセット不要・全て合成） ----------
   tone（オシレータ＋減衰エンベロープ）と noise（フィルタ付きノイズ）の
   2プリミティブだけで全キューを合成する。ファイル容量はゼロ。
   AudioContext は最初のユーザー操作で遅延生成する（自動再生ポリシー対策）。
   操作前に届いたキューは無音で捨てる。音が出せない環境（Node スモーク等）では
   全キューが安全な no-op になる。既定の考え方は下の SOUND_GATE_MENU_ONLY 参照。
   設定で明示したらそちらが常に優先。 */
const SoundKit = (function(){
  let actx = null, master = null, gestured = false, noiseBuf = null;
  /* 音の既定 (設計原則 / sakuri 確定, 設計 §5.7 改訂): 「メニューは開かない状態が
     ニュートラルなゲームプレイ状態」。音はメニューの開閉に連動させず、帯 (owner) で
     設定トグルに従って鳴らすのが既定 — 未設定の間も帯で鳴る。リリース等の帯の
     セレモニーはニュートラル状態でこそ起きるので、そこで無音だと体験が欠ける。
     メニューは着脱式の管理コンソールであって、開いていないと欠ける状態は作らない。
     SOUND_GATE_MENU_ONLY は旧案 (menu が開いている間だけ鳴る) の名残として残すが
     既定 false (この原則に反するので通常は触らない)。true のときだけ旧案に戻る */
  const SOUND_GATE_MENU_ONLY = false;
  function enabled(){
    if(typeof S === "undefined" || !S.settings) return false;
    if(typeof S.settings.sound === "boolean") return S.settings.sound;
    /* 未設定でも鳴る側に倒す (ニュートラル状態=帯が完全な体験)。
       旧案ゲートが明示的に true の場合だけ owner は menuAwake 連動に戻る */
    if(ROLE === "owner" && SOUND_GATE_MENU_ONLY) return !!menuAwake;
    return true;
  }
  function volume(){
    const v = (typeof S !== "undefined" && S.settings) ? S.settings.soundVol : undefined;
    return (typeof v === "number" && isFinite(v)) ? Math.min(1, Math.max(0, v)) : 0.5;
  }
  function ensure(){
    if(actx) return actx;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = volume();
      /* 同時に鳴った音の合算で割れないよう、出口にリミッターを挟む
         (単発の音量には効かない程度の閾値: 単発のピークは -10dBFS 前後) */
      let out: AudioNode = actx.destination;
      try{
        const lim = actx.createDynamicsCompressor();
        lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20;
        lim.attack.value = 0.003; lim.release.value = 0.1;
        lim.connect(actx.destination);
        out = lim;
      }catch(e){}
      master.connect(out);
    }catch(e){ actx = null; }
    return actx;
  }
  function unlock(){
    gestured = true;
    const c = ensure();
    if(c && c.state === "suspended"){ try{ c.resume(); }catch(e){} }
  }
  function applyVolume(){
    if(master && actx){ try{ master.gain.setTargetAtTime(volume(), actx.currentTime, 0.02); }catch(e){} }
  }
  function tone(o){
    if(!actx || !master) return;
    try{
      const dur = o.dur || 0.1, t0 = actx.currentTime + (o.delay || 0);
      const osc = actx.createOscillator(), g = actx.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.f0 || 440, t0);
      if(o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol || 0.5), t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }catch(e){}
  }
  function noise(o){
    if(!actx || !master) return;
    try{
      const dur = o.dur || 0.1, t0 = actx.currentTime + (o.delay || 0);
      /* ノイズは1秒ぶんを1回だけ作り、毎回その中のばらばらな位置から切り出して鳴らす
         (連打で毎回ノイズを作り直すと、1回あたり数千個の乱数と新しいバッファが要った) */
      if(!noiseBuf){
        const len = actx.sampleRate;
        noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for(let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      }
      const src = actx.createBufferSource(); src.buffer = noiseBuf;
      const f = actx.createBiquadFilter();
      f.type = o.ftype || "lowpass"; f.frequency.value = o.ffreq || 1200; f.Q.value = o.q || 0.8;
      const g = actx.createGain();
      /* いきなり最大音量で始めるとプチッと鳴るので 3ms で立ち上げる */
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(o.vol || 0.4, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0, Math.random() * Math.max(0, 1 - dur - 0.05)); src.stop(t0 + dur + 0.05);
    }catch(e){}
  }
  const CUES = {
    /* 応援クリック: コンボが伸びるほど少しずつ高くなるピッチは呼び出し側が渡す */
    click(o){ const p = (o && o.pitch) || 1; tone({ f0: 620 * p, f1: 880 * p, dur: 0.07, type: "triangle", vol: 0.35 }); },
    /* 工程完了（コミット）: タイプライタ風のカチャッ×2 */
    phaseComplete(){ noise({ dur: 0.03, ffreq: 3200, ftype: "highpass", vol: 0.16 });
      tone({ f0: 1150, dur: 0.05, type: "square", vol: 0.09 });
      tone({ f0: 1450, dur: 0.06, type: "square", vol: 0.09, delay: 0.07 }); },
    /* バグ叩き: ポフッというノイズ＋低い落下音 */
    bugSquash(){ noise({ dur: 0.13, ffreq: 700, vol: 0.5 }); tone({ f0: 320, f1: 70, dur: 0.14, type: "sawtooth", vol: 0.20 }); },
    /* 購入・雇用: コインのチャリン（2音） */
    purchase(){ tone({ f0: 1568, dur: 0.07, vol: 0.30 }); tone({ f0: 2093, dur: 0.13, vol: 0.30, delay: 0.06 }); },
    /* リリース: 小さなファンファーレ（上昇アルペジオ＋余韻） */
    releaseFanfare(){ [523, 659, 784, 1047].forEach((fq, i) =>
        tone({ f0: fq, dur: 0.16, type: "triangle", vol: 0.32, delay: i * 0.09 }));
      tone({ f0: 1319, dur: 0.32, vol: 0.15, delay: 0.38 }); },
    /* 金の魚: キラッと上がるスライド＋高音の余韻 */
    fishCatch(){ tone({ f0: 420, f1: 1250, dur: 0.16, vol: 0.34 }); tone({ f0: 1760, dur: 0.1, vol: 0.16, delay: 0.12 }); },
    /* おやつ: もぐもぐ2口ぶんの柔らかい音 */
    snack(){ tone({ f0: 210, f1: 160, dur: 0.09, vol: 0.38 }); tone({ f0: 190, f1: 150, dur: 0.1, vol: 0.38, delay: 0.13 }); },
    /* 買えるようになった: 購入音とは別の、控えめな1音 (何も買っていないのに「買った」音が鳴らないように) */
    ready(){ tone({ f0: 1319, f1: 1568, dur: 0.12, type: "sine", vol: 0.14 }); }
  };
  /* 同じ音が同じ瞬間に何度も重なると音割れするので、短い間隔の連打は1回にまとめる
     (応援クリックはコンボの手応えを残すため間隔を短く) */
  const lastPlayedAt = {};
  const MIN_GAP_MS = { click: 25 };
  function play(name, opts?){
    try{
      if(!enabled()) return;
      if(!gestured || !actx) return;   /* 操作前・未生成なら無音（エラーにしない） */
      if(actx.state === "suspended"){ try{ actx.resume(); }catch(e){} }
      const now = Date.now();
      if(now - (lastPlayedAt[name] || 0) < (MIN_GAP_MS[name] || 60)) return;
      lastPlayedAt[name] = now;
      if(CUES[name]) CUES[name](opts || {});
    }catch(e){}
  }
  try{
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
  }catch(e){}
  return { play, unlock, enabled, volume, applyVolume };
})();

