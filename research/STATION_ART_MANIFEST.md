# 持ち場（ステーション）ドット絵納品目録

2026-10-27 · 『みゅけ、きょうも開発中』 · [発注書](STATION_ART_ORDER.md)

[スプライトデータ](../graphics/env-sprites-station.js) は `window.MIYUKE_ENV_SPRITES_STATION = { palette, sprites }` を出力します。全8枚は手置きの文字列配列、`.` は透明です。

[全点一覧](../graphics/env-preview-station/contact-sheet.png) / [2コマ比較](../graphics/env-preview-station/anim.png) / [既存前景との合成](../graphics/env-preview-station/overlay.png)。個別PNGは **4倍・最近傍・背景 #808080**。名前・寸法はプレビュー外枠だけにあり、素材内に文字はありません。

再現コマンド: `node graphics/render-env-preview-station.cjs`。標準ライブラリだけの[レンダラー](../graphics/render-env-preview-station.cjs)で、完成済みの文字列を検証・PNG化するオフライン納品用ツールです。

## 納品一覧

全点で下端中央アンカー `(幅/2, 高さ)` を使います。ブースは最下行に接地します。

| Sprite / preview | Pixels | Anchor | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [prop_station_plan](../graphics/env-preview-station/prop_station_plan.png) | 48×44 | (24,44) | 木・ベージュの仕切り、付箋3枚と線の落書きのホワイトボード。左に丸テーブル、マグ、メモ、丸椅子2脚。右下24px幅は無地の壁。 | `BLOTWYbdtwy` | なし |
| [prop_station_test](../graphics/env-preview-station/prop_station_test.png) | 48×44 | (24,44) | チェックリスト、拡大鏡付きアームライト、緑のチェックの小型モニタ。検査台の両端を見せ、中央32×30は無地の壁と幅木。 | `BDGLOTWdgstw` | なし |
| [prop_station_build](../graphics/env-preview-station/prop_station_build.png) | 48×44 | (24,44) | スパナと木づちの有孔ボード、右端に歯車と手回しハンドルの機械。作業台の両端を見せ、中央40×30は無地の壁と幅木。 | `DLOTltw` | なし |
| [prop_station_ship](../graphics/env-preview-station/prop_station_ship.png) | 64×48 | (32,48) | 半分開いた鋼色のシャッター付き搬出口。左脇に台車、右の床に黄色の養生テープ。中央は上半分がシャッター、下半分は透過の開口。 | `DLOTYlw` | なし |
| [fx_handwork_plan_0](../graphics/env-preview-station/fx_handwork_plan_0.png) | 18×16 | (9,16) | 既存test_0と同形・同色の三毛の前足が青いペンをメモの上に構える。 | `ABDFOPWbs` | なし |
| [fx_handwork_plan_1](../graphics/env-preview-station/fx_handwork_plan_1.png) | 18×16 | (9,16) | 既存test_1と同形・同色の前足で書き込む。紙に短い線、小さなきらめき1つ。 | `ABDFOPWYbs` | なし |
| [fx_handwork_code_0](../graphics/env-preview-station/fx_handwork_code_0.png) | 18×16 | (9,16) | 既存test_0と同形・同色の前足を鋼色のキーボードの上に持ち上げる。 | `ADFLOPW` | なし |
| [fx_handwork_code_1](../graphics/env-preview-station/fx_handwork_code_1.png) | 18×16 | (9,16) | 既存test_1と同形・同色の前足でキーを押し込む。衝撃線2本。 | `ADFLOPWY` | なし |

## パレット再利用

**新色提案: 0。新規パレット文字: 0。** 以下の19色はすべて `graphics/sprites.js` と同じ文字・同じhexです。輪郭は茶色の `O`、前足の焦げ茶のぶちは `F`。平塗りで、グラデーション・アンチエイリアス・半透明色はありません。

| Character | Existing hex |
| --- | --- |
| `O` | #604B40 |
| `W` | #FFF5E6 |
| `w` | #DFCDB7 |
| `A` | #F49A45 |
| `F` | #463126 |
| `P` | #F49CAC |
| `T` | #C99A66 |
| `t` | #996D49 |
| `Y` | #FFDA64 |
| `y` | #C99A42 |
| `B` | #71BED3 |
| `b` | #408599 |
| `G` | #85CA91 |
| `g` | #437660 |
| `D` | #718293 |
| `d` | #465464 |
| `L` | #C1C8CB |
| `l` | #8F9AA1 |
| `s` | #E9EFFF |

## 前景合成と2コマ

`overlay.png` は全レイヤーを下端中央アンカー・同じ地面に置き、以下の順で奥から手前へ合成。既存素材は透明余白も含め原寸のまま使います。

- plan: ブース → `prop_backlog_1`。ボード中心を原寸12px右に置き、右側24pxの予約範囲に合わせる。
- test: ブース → `prop_qa_tray` → `prop_autotester_2`。全中心を一致。
- build: ブース → `prop_build_stand` → `prop_packer_2`。全中心を一致。
- ship: ブース → `prop_ship`。全中心を一致。

会議室の右下、検査室とビルド室の中央下部は壁・幅木だけです。出荷場の中央48pxは上部に鋼色のシャッター帯を置き、y=23以降は透明な搬出口です。台車と養生テープは両脇8px内に収めています。

前足は第0コマで既存 `fx_handwork_test_0` の0〜7行、第1コマで `fx_handwork_test_1` の0〜9行を位置・形・配色とも完全一致で再利用。クリーム地 `W`、オレンジ `A`、焦げ茶 `F`、ピンクの肉球 `P`、茶色の輪郭 `O` を保持。それ以降の行でペン／キーへの接触を表現します。各組は18×16の同一キャンバス、同じ最下行で切り替わります。`anim.png` は2組の第0・第1コマの横並び静止比較表です。

## 検証

レンダラー結果: **PASS**。

- 全8名、指定寸法、全行幅、行数、未定義色なし、ブースの最下行接地。
- 既存パレットとの文字・hex一致。未使用項目なし。19色再利用、新色0。
- 既存前足とのピクセル一致、2組の下端固定、コマの差分あり。
- 前景予約領域に小道具なし。出荷場の上部シャッター、各ブースの外枠・幅木は背景として検査。
- **個別8枚 + contact-sheet.png + anim.png + overlay.png = 11 PNG**。
- 全PNGの読み戻し、CRC・寸法・RGB照合。個別8枚は全ピクセルを元データと照合し、4倍最近傍・#808080背景を確認。

全点一覧・2コマ比較・前景合成を目視確認しました。既存ファイルの変更、ゲーム実行、バージョン更新、コミットは行っていません。ゲーム内の配置・動作検証は今回の範囲外です。
