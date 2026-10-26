/* ---------- Sprint 2: ジュース（手触り）の部品 ----------
   パーティクルはプール上限つきの単純な配列で、レイアウトには触らない。
   帯モードでも粒子とバウンスは出すが、音だけは帯の既定 OFF（SoundKit 側）。 */
/* みゅけのスクワッシュ＆ストレッチ: 地面アンカー中心に約350msのバネ。
   応援クリック／なでなでで startBounce() を呼ぶ */
let bounceT0 = 0;
function startBounce(){ bounceT0 = Date.now(); }
function bounceScale(){
  if(!bounceT0) return null;
  const t = (Date.now() - bounceT0) / 350;
  if(t >= 1){ bounceT0 = 0; return null; }
  const amp = 0.22 * Math.exp(-3.2 * t) * Math.cos(t * Math.PI * 2.6);
  return { sx: 1 + amp * 0.8, sy: 1 - amp };
}
const CONFETTI_COLS = ["#e2543e", "#ffd94d", "#5aa469", "#4a90c2", "#f49cac"];
/* リリースの紙吹雪（帯）: Date.now() 基準。帯の検知側（stripUpdate）から呼ぶ */
let stripConfetti = [];
function spawnStripConfetti(cx){
  for(let i = 0; i < 36; i++){
    stripConfetti.push({
      x: cx + (Math.random() - 0.5) * 44, y: STRIP_GROUND - 62 - Math.random() * 18,
      vx: (Math.random() - 0.5) * 15, vy: -(9 + Math.random() * 17),
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9,
      col: CONFETTI_COLS[i % CONFETTI_COLS.length], born: Date.now()
    });
  }
  if(stripConfetti.length > 80) stripConfetti.splice(0, stripConfetti.length - 80);
}
/* 節目（機能完成・コミット・リリース）到達で進捗エリアをパルスさせる期限 */
let milestonePulseUntil = 0;
function pulseMilestone(){ milestonePulseUntil = Date.now() + 900; }

