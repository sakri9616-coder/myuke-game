/* ---------- 帯のメーター表示 (2026-10-27) ----------
   sakuri「秒区切りではなく、メーターで数字やゲージの上り幅を見たい」。
   シミュレーションは1秒ごとに進むので、そのまま描くと数字とゲージが毎秒カクッと跳ぶ。
   表示だけを、前の値から新しい値へ一定の速さで流す (シミュレーションの値は変えない)。
   - 流す時間は「前回値が変わってからの間隔」(毎秒のティックなら 1 秒、連打のクリックなら
     その間隔)。次の値が来るころに追いつくので、増え続ける間は止まらずに動いて見える
   - 減ったとき (買い物・新しい作品で進捗が 0 に戻る) は即座に合わせる。smoothDown を
     指定した値 (集中力の減りなど) だけは減りも流す
   - 表示が 1 秒以上遅れないよう、流す時間は METER_MAX_MS で頭打ち */
const METER_MIN_MS = 120, METER_MAX_MS = 1000;
const stripMeters: Record<string, any> = {};
function stripMeter(key, target, smoothDown?){
  const now = Date.now();
  if(!isFinite(target)) return target;
  let m = stripMeters[key];
  if(!m){ m = stripMeters[key] = { from: target, to: target, t0: now, dur: 1, changedAt: now }; return target; }
  if(target !== m.to){
    const cur = meterValueAt(m, now);
    if(target < cur && !smoothDown){
      m.from = target; m.to = target; m.t0 = now; m.dur = 1;
    } else {
      m.from = cur; m.to = target; m.t0 = now;
      m.dur = Math.max(METER_MIN_MS, Math.min(METER_MAX_MS, now - m.changedAt));
    }
    m.changedAt = now;
  }
  return meterValueAt(m, now);
}
function meterValueAt(m, now){
  const k = Math.max(0, Math.min(1, (now - m.t0) / m.dur));
  return k >= 1 ? m.to : m.from + (m.to - m.from) * k;
}
