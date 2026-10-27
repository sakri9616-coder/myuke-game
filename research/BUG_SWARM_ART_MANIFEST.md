# 在庫バグ群れ ドット絵納品目録

2026-10-27 · 『みゅけ、きょうも開発中』 · [発注書](BUG_SWARM_ART_ORDER.md)

[スプライトデータ](../graphics/env-sprites-bugs.js) は `window.MIYUKE_ENV_SPRITES_BUGS = { palette, sprites }` を出力します。全10枚を手置きの文字列配列として収録し、`.` は透明です。キャラクター素材は含みません。

[全点一覧](../graphics/env-preview-bugs/contact-sheet.png) / [全4組の2コマ比較](../graphics/env-preview-bugs/anim.png)。個別PNGも含め、原寸データを **4倍・最近傍・背景 #808080** で表示しています。名前とサイズの文字はプレビュー外枠だけにあり、スプライト本体にはありません。`fx_patch` の小さな「+」は発注指定の絆創膏の記号です。

再現コマンド: `node graphics/render-env-preview-bugs.cjs`。標準ライブラリだけの[プレビューレンダラー](../graphics/render-env-preview-bugs.cjs)です。完成済みの文字列を検証・PNG化するオフライン納品用ツールで、ゲームへの描画処理追加はありません。

## 納品一覧

アンカーは原寸キャンバス端の座標 `(幅/2, 高さ)`。全点で下端中央を使い、上・左・右は1px以上透明、最下行には描画ピクセルがあります。

| Sprite / preview | Pixels | Anchor | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [icon_bug_s_0](../graphics/env-preview-bugs/icon_bug_s_0.png) | 14×10 | bottom-centre (7,10) | 右向きの赤い丸胴・濃灰の頭・2本の触角・3対の脚。這い歩きの第0コマ。 | `KRz` | なし |
| [icon_bug_s_1](../graphics/env-preview-bugs/icon_bug_s_1.png) | 14×10 | bottom-centre (7,10) | 同じ虫の第1コマ。胴・頭・触角は固定し、手前と奥の脚の運びを交替。 | `KRz` | なし |
| [icon_bug_swarm_s_0](../graphics/env-preview-bugs/icon_bug_swarm_s_0.png) | 26×13 | bottom-centre (13,13) | 小さな同種の虫6匹。上下各3匹が寄り集まる群れの第0コマ。 | `KRz` | なし |
| [icon_bug_swarm_s_1](../graphics/env-preview-bugs/icon_bug_swarm_s_1.png) | 26×13 | bottom-centre (13,13) | 同じ6匹の第1コマ。一部の胴と頭の境界を1px動かし、脚を交替してうごめく。 | `KRz` | なし |
| [icon_bug_swarm_l_0](../graphics/env-preview-bugs/icon_bug_swarm_l_0.png) | 44×20 | bottom-centre (22,20) | 小群れと同じ描き方の17匹。上から3・4・5・5匹が重なる山の第0コマ。 | `KRz` | なし |
| [icon_bug_swarm_l_1](../graphics/env-preview-bugs/icon_bug_swarm_l_1.png) | 44×20 | bottom-centre (22,20) | 同じ17匹の第1コマ。一部の胴と頭の境界、最前列の脚が交互に動く。 | `KRz` | なし |
| [fx_patch](../graphics/env-preview-bugs/fx_patch.png) | 12×10 | bottom-centre (6,10) | 濃い青灰の縁取り、水色の四角い当て布、中央に明るい3×3の「+」。自動デバッグで落ちてくるパッチ。 | `BSWd` | なし |
| [fx_bug_poof_0](../graphics/env-preview-bugs/fx_bug_poof_0.png) | 16×12 | bottom-centre (8,12) | 淡い青の縁と白い丸煙。小さな黄・クリーム色の十字星を添えた消滅の第0コマ。 | `SWYs` | なし |
| [fx_bug_poof_1](../graphics/env-preview-bugs/fx_bug_poof_1.png) | 16×12 | bottom-centre (8,12) | 煙が小片に散る第1コマ。濃い縁と星をなくし、透明領域を増やして薄くする。 | `s` | なし |
| [fx_bug_splat](../graphics/env-preview-bugs/fx_bug_splat.png) | 14×6 | bottom-centre (7,6) | 赤い胴と濃灰の頭がぺちゃんこになり、脚が横に広がった虫。クリック後に短時間残す。流血表現なし。 | `KRz` | なし |

## パレット再利用

**新色提案: 0。新規パレット文字: 0。** 以下の9色すべてを `graphics/sprites.js` の同じ文字・同じhexから再利用しています。色の混合、グラデーション、アンチエイリアス、半透明色はありません。

| Character | Existing hex | 用途 |
| --- | --- | --- |
| `z` | #211711 | 既存 `icon_bug` と同じ虫の輪郭・触角・脚 |
| `K` | #45414A | 既存 `icon_bug` と同じ頭 |
| `R` | #E66B52 | 既存 `icon_bug` と同じ赤い胴 |
| `d` | #465464 | パッチの濃い縁 |
| `B` | #71BED3 | パッチの水色の布 |
| `S` | #C7DCF3 | パッチの淡色の周縁、煙の縁 |
| `s` | #E9EFFF | 煙と散る小片 |
| `W` | #FFF5E6 | パッチの「+」、既存 `fx_spark_*` に合わせた星の中心 |
| `Y` | #FFDA64 | 既存 `fx_spark_*` に合わせた小さな星の外側 |

## 2コマの安定性と検証

全4組でキャンバス寸法・不透明ピクセルの外接範囲・下端接地を一致させています。虫3組は脚以外の透明／不透明マスクも一致します。個体は身体を跳ねさせず脚を運び、群れは外形を保って内側の色境界と脚を動かします。煙は同じ範囲内で散り、描画密度を半分未満に減らします。煙の第1コマは散開表現のため内部のマスクが変わります。`anim.png` は全組の第0・第1コマを同じ基準線で横並びにした静止比較表です。

レンダラーの検証結果: **PASS**。

- 発注どおりの全10名、行数・各行幅、透明余白、下端接地。
- 9色の文字とhexが既存パレットと完全一致。未定義色・未使用パレット項目なし。
- 虫は `z/K/R` の3色だけを使用。小群れ6個、大群れ17個の頭を両コマで確認。
- 全4組の外接範囲固定、虫の身体マスク固定、煙の散開と密度低下。
- 出力は **個別10枚 + contact-sheet.png + anim.png = 12 PNG**。
- 全PNGを読み戻し、CRC・寸法・RGBピクセルを検証。個別10枚は全ピクセルを文字列データと照合し、4倍最近傍と #808080 背景を確認。

全点一覧と2コマ比較表を目視確認しました。既存ファイルの変更、ゲーム実行、バージョン更新、コミットは行っていません。ゲーム内の配置・速度・効果時間は今回の範囲外です。
