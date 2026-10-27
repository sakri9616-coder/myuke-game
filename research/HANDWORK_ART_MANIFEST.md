# 手作業エフェクト ドット絵納品目録

2026-10-27 · 『みゅけ、きょうも開発中』 · [発注書](HANDWORK_ART_ORDER.md)

[スプライトデータ](../graphics/env-sprites-handwork.js) は `window.MIYUKE_ENV_SPRITES_HANDWORK = { palette, sprites }` を出力します。全8枚を手置きの文字列配列で収録し、`.` は透明です。前足は発注指定の作業エフェクト・操作合図として描き、キャラクター本体や既存素材は変更していません。

[全点一覧](../graphics/env-preview-handwork/contact-sheet.png) / [全4組の2コマ比較](../graphics/env-preview-handwork/anim.png)。個別PNGを含め、原寸データを **4倍・最近傍・背景 #808080** で表示しています。名前とサイズはプレビュー外枠だけにあり、スプライト本体には文字・数字・記号のラベルはありません。

再現コマンド: `node graphics/render-env-preview-handwork.cjs`。標準ライブラリだけの[プレビューレンダラー](../graphics/render-env-preview-handwork.cjs)です。完成済みの文字列を検証・PNG化するオフライン納品用ツールで、ゲームへの描画処理追加はありません。

## 納品一覧

アンカーは原寸キャンバス端の座標 `(幅/2, 高さ)`。全点で下端中央を使います。作業エフェクトは下のカード・箱の接地位置を固定し、前足と道具が動きます。タップ合図のみ発注どおり1px上下します。

| Sprite / preview | Pixels | Anchor | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [fx_handwork_test_0](../graphics/env-preview-handwork/fx_handwork_test_0.png) | 18×16 | bottom-centre (9,16) | 三毛の前足が赤いはんこを持ち上げ、下のQAカードに押す直前。クリーム地・オレンジと焦げ茶のぶち・ピンクの肉球。 | `AFHOPRWs` | なし |
| [fx_handwork_test_1](../graphics/env-preview-handwork/fx_handwork_test_1.png) | 18×16 | bottom-centre (9,16) | 同じ前足ではんこを押し当てる。カードに赤い印、左右に短い衝撃線を2本。 | `AFHOPRWYs` | なし |
| [fx_handwork_build_0](../graphics/env-preview-handwork/fx_handwork_build_0.png) | 18×16 | bottom-centre (9,16) | 三毛の前足が小さな木づちを振り上げる。下に固定したカード束。 | `AFOPTWst` | なし |
| [fx_handwork_build_1](../graphics/env-preview-handwork/fx_handwork_build_1.png) | 18×16 | bottom-centre (9,16) | 同じ前足が木づちを振り下ろし、カード束をとんとん叩く。短い衝撃線を2本。 | `AFOPTWYst` | なし |
| [fx_handwork_ship_0](../graphics/env-preview-handwork/fx_handwork_ship_0.png) | 18×16 | bottom-centre (9,16) | 肉球を小箱へ向けた三毛の前足。`icon_box` と同じ茶色・濃茶の縁・灰色のテープを使った小さな段ボール箱を、右へ押す構え。 | `AFOPW£¥®µ` | なし |
| [fx_handwork_ship_1](../graphics/env-preview-handwork/fx_handwork_ship_1.png) | 18×16 | bottom-centre (9,16) | 前足を右へ伸ばして小箱へ押し込む。箱の上部が右へ1px傾き、後ろに小さなクリーム色の土ぼこり。箱の下端は固定。 | `AFOPW£¥®µ` | なし |
| [icon_tap_0](../graphics/env-preview-handwork/icon_tap_0.png) | 10×10 | bottom-centre (5,10) | 下向きの丸い三毛の前足。オレンジ・焦げ茶のぶち、中央と指先にピンクの肉球。操作可能な山を示す上側のコマ。 | `AFOPW` | なし |
| [icon_tap_1](../graphics/env-preview-handwork/icon_tap_1.png) | 10×10 | bottom-centre (5,10) | 同じ前足を形・色ともそのまま1px下げた下側のコマ。 | `AFOPW` | なし |

## パレット再利用

**新色提案: 0。新規パレット文字: 0。** 以下の15色すべてを `graphics/sprites.js` の同じ文字・同じhexから再利用しています。輪郭は茶色系です。平塗りの色面だけを使い、グラデーション、アンチエイリアス、半透明色はありません。

| Character | Existing hex | 用途 |
| --- | --- | --- |
| `O` | #604B40 | 前足・道具・カードの茶色の輪郭 |
| `W` | #FFF5E6 | 前足のクリーム地、土ぼこり |
| `A` | #F49A45 | 三毛のオレンジのぶち |
| `F` | #463126 | 三毛の焦げ茶のぶち。既存みゅけ素材にもある焦げ茶を再利用 |
| `P` | #F49CAC | ピンクの肉球 |
| `H` | #C53333 | 赤いはんこの本体、カードの押印 |
| `R` | #E66B52 | はんこの赤い持ち手の色面 |
| `s` | #E9EFFF | `icon_card` と同じカードの紙色 |
| `T` | #C99A66 | 木づちの頭の木色 |
| `t` | #996D49 | 木づちの柄、頭の下側の色面 |
| `Y` | #FFDA64 | `fx_spark_*` と共通の明るい衝撃線 |
| `£` | #39261D | `icon_box` と同じ箱の輪郭 |
| `¥` | #856551 | `icon_box` と同じ箱の本体 |
| `µ` | #9D9C92 | `icon_box` と同じテープ |
| `®` | #543628 | `icon_box` と同じ箱の側面・底側 |

## 2コマの安定性と検証

作業3組はそれぞれ18×16の同一キャンバスで、最下行の文字列が完全一致します。衝撃線を除く左右の外接範囲も一致します。QAカードとビルド用カード束の下部は固定し、押印だけ赤く変わります。出荷箱は底辺を固定し、上部と前足が右へ押し込む動きを描いています。腕や道具の上下運動に伴い上端は変化し、衝撃線と土ぼこりが第1コマで現れます。

タップ合図は10×10の同一キャンバスで、上・左・右に1px以上の透明余白を確保。第0コマの下端は透明で、第1コマは全ピクセルが正確に1px下へ移動し、欠けはありません。`anim.png` は全4組の第0・第1コマを同じキャンバス下端で横並びにした静止比較表です。

レンダラーの検証結果: **PASS**。

- 発注どおりの全8名、行数・各行幅、全点の三毛色と肉球、タップ合図の透明余白。
- 15色の文字とhexが既存パレットと完全一致。未定義色・未使用パレット項目なし。
- 作業3組の下端固定、衝撃線を除く左右範囲の固定、カード下部の固定。
- タップ合図の正確な1px移動と欠けのない形状。
- 出力は **個別8枚 + contact-sheet.png + anim.png = 10 PNG**。
- 全PNGを読み戻し、CRC・寸法・RGBピクセルを検証。個別8枚は全ピクセルを文字列データと照合し、4倍最近傍と #808080 背景を確認。

全点一覧と2コマ比較表を目視確認しました。既存ファイルの変更、ゲーム実行、バージョン更新、コミットは行っていません。ゲーム内の配置・速度・効果時間は今回の範囲外です。
