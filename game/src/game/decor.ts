/* ================= 家具カタログ（2026-11-18 sakuri 指示「家具配置と家具購入の仕組み」） =================
   コインで買う見た目だけの家具。効果は持たないので数値バランス（sim ゲート）は変わらない。
   - 品は最高到達社格（または通算 EXIT 回数）で増える。値段はその頃の手持ちで「少し迷う」額。
   - 通常の家具はコイン、特別な家具は星屑で買う（sakuri 決定 2026-11-18）。
   - 買った家具は恒久的に所持する。会社の資産ではなくみゅけの持ち物: EXIT でも持株化でも消えない（レイアウトと同じ）。
   - 置き場所は並べ替え（Phase E の layoutProps）にそのまま乗る: PROP_DEFS に "decor_<id>" で登録し、
     地面にも、小物なら机・棚・本棚の上にも置ける。本棚は買うと新しい「面」になる。
   - 帯の絵は既存アセットだけを使う（理念書 9章: スクリプト生成アートは禁止）。sprite が無い品は
     カタログに出さない — 発注した絵（DECOR_ORDER）が届けば自動で並ぶ。
   - 帯でクリックの当たりは持たない（理念書 1章: 何もない所はデスクトップへ素通し）。動かすのは並べ替えモードだけ。
   保存は追加フィールド S.decor のみ: { [id]: { at: 購入時刻, hidden?: 1 } } */
interface DecorDef {
  id: string; name: string; desc?: string;   /* desc 省略時は置き場の案内（decorDesc） */
  spr: string; scale: number;
  w: number; h: number; cls: "ground" | "small";
  rank?: number; exits?: number; cost: number; dust?: boolean;   /* dust = 特別な家具（星屑で買う） */
  def: { on: "ground"; x: number } | { on: string; dx: number };   /* 買った直後の置き場 */
}
const DECOR_DEFS: DecorDef[] = [
  /* --- 既存の絵で出せる品 --- */
  { id: "plant",  name: "観葉植物",   desc: "小さな鉢植え。机や棚の上にも置けます", spr: "prop_plant", scale: 1, w: 16, h: 20, cls: "small",
    rank: 1, cost: 300, def: { on: "shelf", dx: 24 } },
  { id: "books",  name: "技術書の列", desc: "読み込んだ技術書。棚や机の上に並べられます", spr: "prop_books", scale: 1, w: 24, h: 7, cls: "small",
    rank: 2, cost: 1500, def: { on: "shelf", dx: -24 } },
  { id: "boxes",  name: "段ボール箱", desc: "資料を詰めた箱の山。創業期の空気", spr: "prop_archive_boxes", scale: 1, w: 18, h: 25, cls: "small",
    rank: 2, cost: 2500, def: { on: "ground", x: 0.025 } },
  { id: "bookshelf", name: "本棚",    desc: "小さな本棚。天板に小物を置けます（新しい置き場になります）", spr: "prop_shelf", scale: 2, w: 80, h: 56, cls: "ground",
    rank: 3, cost: 15000, def: { on: "ground", x: 0.415 } },
  { id: "server", name: "小型サーバー", desc: "棚に収まらなかった一台。ランプが光る", spr: "prop_server", scale: 1, w: 24, h: 32, cls: "ground",
    rank: 4, cost: 200000, def: { on: "ground", x: 0.965 } },
  /* --- 特別な家具（星屑で買う）。廃止した「推しの一本」用に sakuri が描いた絵（A7 特等席・A2 推しリボン）を家具として活かす --- */
  { id: "vipseat", name: "特等席", desc: "赤いじゅうたんとロープの特別な台。星屑で買う特別な家具", spr: "a7_special_seat", scale: 1, w: 24, h: 24, cls: "ground",
    exits: 1, cost: 5, dust: true, def: { on: "ground", x: 0.5 } },
  { id: "rosette", name: "金のロゼット", desc: "勲章のリボン飾り。机や棚の上に飾れる特別な家具", spr: "a2_oshi_ribbon", scale: 1, w: 24, h: 24, cls: "small",
    exits: 1, cost: 3, dust: true, def: { on: "shelf", dx: 0 } },
  /* --- 届いた家具の絵（2026-11-16 統合: sakuri 戻り22+3点・みゅー作画 新規16点・R6 描き直し37点）。
     原寸は作画時のキャンバス寸法が正本。フロアランプ・大きな観葉植物・ソファ・金魚の水槽は、
     発注していた品にこの絵を当てた（品・値段・解放は家具カタログの決定のまま） --- */
  { id: "lamp",   name: "フロアランプ", desc: "やわらかい光の背の高いランプ", spr: "prop_floor_lamp", scale: 1, w: 48, h: 48, cls: "ground",
    rank: 6, cost: 1e6, def: { on: "ground", x: 0.985 } },
  { id: "bigplant", name: "大きな観葉植物", desc: "背の高い鉢植え。オフィスらしさが一気に出る", spr: "prop_plant_large", scale: 1, w: 64, h: 64, cls: "ground",
    rank: 6, cost: 1e7, def: { on: "ground", x: 0.05 } },
  { id: "sofa",   name: "ソファ",     desc: "休憩用のふかふかソファ", spr: "prop_sofa", scale: 1, w: 64, h: 64, cls: "ground",
    exits: 1, cost: 1e8, def: { on: "ground", x: 0.42 } },
  /* 以下は説明文なし（置き場の案内を出す）。値段は社格ごとの帯の中で並び順に上がる暫定値 */
  { id: "first_desk", name: "創業の小机", spr: "prop_first_desk", scale: 1, w: 48, h: 48, cls: "ground", rank: 1, cost: 300, def: { on: "ground", x: 0.172 } },
  { id: "cup_ramen", name: "カップ麺", spr: "prop_cup_ramen", scale: 1, w: 48, h: 48, cls: "ground", rank: 1, cost: 400, def: { on: "ground", x: 0.440 } },
  { id: "mug", name: "マグカップ", spr: "prop_mug", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 400, def: { on: "ground", x: 0.508 } },
  { id: "trash_can", name: "ゴミ箱", spr: "prop_trash_can", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 500, def: { on: "ground", x: 0.828 } },
  { id: "clock", name: "置き時計", spr: "prop_clock", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 500, def: { on: "ground", x: 0.800 } },
  { id: "calendar", name: "カレンダー", spr: "prop_calendar", scale: 1, w: 25, h: 24, cls: "small", rank: 1, cost: 600, def: { on: "ground", x: 0.752 } },
  { id: "cactus", name: "サボテン", spr: "prop_cactus", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 600, def: { on: "ground", x: 0.218 } },
  { id: "succulent", name: "多肉植物", spr: "prop_succulent", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 800, def: { on: "ground", x: 0.470 } },
  { id: "power_strip", name: "電源タップ", spr: "prop_power_strip", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 800, def: { on: "ground", x: 0.387 } },
  { id: "extinguisher", name: "消火器", spr: "prop_extinguisher", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 800, def: { on: "ground", x: 0.850 } },
  { id: "can_tower", name: "エナドリ缶タワー", spr: "prop_can_tower", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 1000, def: { on: "ground", x: 0.204 } },
  { id: "paper_pile", name: "書類の山", spr: "prop_paper_pile", scale: 1, w: 48, h: 48, cls: "ground", rank: 1, cost: 1000, def: { on: "ground", x: 0.326 } },
  { id: "keyboard", name: "推しキーボード", spr: "prop_keyboard", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 1200, def: { on: "ground", x: 0.095 } },
  { id: "zabuton", name: "座布団", spr: "prop_zabuton", scale: 1, w: 48, h: 48, cls: "ground", rank: 1, cost: 1500, def: { on: "ground", x: 0.599 } },
  { id: "kettle", name: "電気ケトル", spr: "prop_kettle", scale: 1, w: 24, h: 24, cls: "small", rank: 1, cost: 1500, def: { on: "ground", x: 0.492 } },
  { id: "cardboard_box", name: "大きな段ボール箱", spr: "prop_cardboard_box", scale: 1, w: 48, h: 48, cls: "ground", rank: 1, cost: 1500, def: { on: "ground", x: 0.345 } },
  { id: "desk_lamp", name: "デスクランプ", spr: "prop_desk_lamp", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 2000, def: { on: "ground", x: 0.695 } },
  { id: "drawer", name: "引き出しチェスト", spr: "prop_drawer", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 2500, def: { on: "ground", x: 0.190 } },
  { id: "coat_rack", name: "ポールハンガー", spr: "prop_coat_rack", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 2500, def: { on: "ground", x: 0.035 } },
  { id: "side_table", name: "サイドテーブル", spr: "prop_side_table", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 3000, def: { on: "ground", x: 0.085 } },
  { id: "flower_vase", name: "花瓶", spr: "prop_flower_vase", scale: 1, w: 24, h: 24, cls: "small", rank: 2, cost: 4000, def: { on: "ground", x: 0.477 } },
  { id: "plush", name: "ぬいぐるみ", spr: "prop_plush", scale: 1, w: 24, h: 24, cls: "small", rank: 2, cost: 4000, def: { on: "ground", x: 0.545 } },
  { id: "figurine", name: "フィギュア", spr: "prop_figurine", scale: 1, w: 24, h: 24, cls: "small", rank: 2, cost: 4000, def: { on: "ground", x: 0.728 } },
  { id: "controller", name: "コントローラ", spr: "prop_controller", scale: 1, w: 24, h: 24, cls: "small", rank: 2, cost: 5000, def: { on: "ground", x: 0.668 } },
  { id: "console", name: "ゲーム機", spr: "prop_console", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 5000, def: { on: "ground", x: 0.640 } },
  { id: "toaster", name: "トースター", spr: "prop_toaster", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 6000, def: { on: "ground", x: 0.654 } },
  { id: "heater", name: "電気ヒーター", spr: "prop_heater", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 6000, def: { on: "ground", x: 0.814 } },
  { id: "humidifier", name: "加湿器", spr: "prop_humidifier", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 8000, def: { on: "ground", x: 0.740 } },
  { id: "storage_box", name: "収納ボックス", spr: "prop_storage_box", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 8000, def: { on: "ground", x: 0.115 } },
  { id: "tablet", name: "液晶タブレット", spr: "prop_tablet", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 8000, def: { on: "ground", x: 0.307 } },
  { id: "beanbag", name: "ビーズクッション", spr: "prop_beanbag", scale: 1, w: 64, h: 64, cls: "ground", rank: 2, cost: 10000, def: { on: "ground", x: 0.378 } },
  { id: "cardboard_fort", name: "段ボール要塞", spr: "prop_cardboard_fort", scale: 1, w: 64, h: 64, cls: "ground", rank: 2, cost: 10000, def: { on: "ground", x: 0.776 } },
  { id: "laser", name: "レーザーポインタ台", spr: "prop_laser", scale: 1, w: 24, h: 24, cls: "small", rank: 2, cost: 12000, def: { on: "ground", x: 0.426 } },
  { id: "router", name: "Wi-Fiルーター", spr: "prop_router", scale: 1, w: 48, h: 48, cls: "ground", rank: 2, cost: 12000, def: { on: "ground", x: 0.317 } },
  { id: "desk_l", name: "L字デスク", spr: "prop_desk_l", scale: 1, w: 64, h: 64, cls: "ground", rank: 3, cost: 20000, def: { on: "ground", x: 0.027 } },
  { id: "table_long", name: "長机", spr: "prop_table_long", scale: 1, w: 64, h: 64, cls: "ground", rank: 3, cost: 25000, def: { on: "ground", x: 0.065 } },
  { id: "wagon", name: "プリンタ台ワゴン", spr: "prop_wagon", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 25000, def: { on: "ground", x: 0.105 } },
  { id: "printer", name: "プリンタ", spr: "prop_printer", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 30000, def: { on: "ground", x: 0.297 } },
  { id: "file_cabinet", name: "ファイルキャビネット", spr: "prop_file_cabinet", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 30000, def: { on: "ground", x: 0.532 } },
  { id: "shredder", name: "シュレッダー", spr: "prop_shredder", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 40000, def: { on: "ground", x: 0.681 } },
  { id: "speaker", name: "スピーカー", spr: "prop_speaker", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 40000, def: { on: "ground", x: 0.353 } },
  { id: "headphone_stand", name: "ヘッドホンスタンド", spr: "prop_headphone_stand", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 40000, def: { on: "ground", x: 0.336 } },
  { id: "mic_arm", name: "マイクアーム", spr: "prop_mic_arm", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 50000, def: { on: "ground", x: 0.369 } },
  { id: "nas", name: "NAS", spr: "prop_nas", scale: 1, w: 24, h: 24, cls: "small", rank: 3, cost: 50000, def: { on: "ground", x: 0.403 } },
  { id: "globe", name: "地球儀", spr: "prop_globe", scale: 1, w: 24, h: 24, cls: "small", rank: 3, cost: 60000, def: { on: "ground", x: 0.524 } },
  { id: "mirror", name: "姿見", spr: "prop_mirror", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 60000, def: { on: "ground", x: 0.712 } },
  { id: "robot_vacuum", name: "ロボット掃除機", spr: "prop_robot_vacuum", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 80000, def: { on: "ground", x: 0.764 } },
  { id: "bonsai", name: "盆栽", spr: "prop_bonsai", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 80000, def: { on: "ground", x: 0.075 } },
  { id: "air_purifier", name: "空気清浄機", spr: "prop_air_purifier", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 80000, def: { on: "ground", x: 0.270 } },
  { id: "balance_ball", name: "バランスボール", spr: "prop_balance_ball", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 1e5, def: { on: "ground", x: 0.412 } },
  { id: "cable_box", name: "ケーブルボックス", spr: "prop_cable_box", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 1e5, def: { on: "ground", x: 0.243 } },
  { id: "snack_wagon", name: "おやつワゴン", spr: "prop_snack_wagon", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 1e5, def: { on: "ground", x: 0.288 } },
  { id: "monitors", name: "三画面モニタ", spr: "prop_monitors", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 1e5, def: { on: "ground", x: 0.485 } },
  { id: "build_lamp", name: "ビルド状態ランプ", spr: "prop_build_lamp", scale: 1, w: 24, h: 24, cls: "small", rank: 3, cost: 2e5, def: { on: "ground", x: 0.018 } },
  { id: "sunny_perch", name: "日なたの台", spr: "prop_sunny_perch", scale: 1, w: 48, h: 48, cls: "ground", rank: 3, cost: 2e5, def: { on: "ground", x: 0.055 } },
  { id: "hammock", name: "ハンモック", spr: "prop_hammock", scale: 1, w: 64, h: 64, cls: "ground", rank: 3, cost: 2e5, def: { on: "ground", x: 0.135 } },
  { id: "desk_lift", name: "昇降デスク", spr: "prop_desk_lift", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 3e5, def: { on: "ground", x: 0.045 } },
  { id: "locker", name: "ロッカー", spr: "prop_locker", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 4e5, def: { on: "ground", x: 0.163 } },
  { id: "partition", name: "パーティション", spr: "prop_partition", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 5e5, def: { on: "ground", x: 0.181 } },
  { id: "display_shelf", name: "ディスプレイ棚", spr: "prop_display_shelf", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 5e5, def: { on: "ground", x: 0.145 } },
  { id: "bigshelf", name: "大型本棚", spr: "prop_bookshelf", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 6e5, def: { on: "ground", x: 0.125 } },
  { id: "rug_large", name: "大判ラグ", spr: "prop_rug_large", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 8e5, def: { on: "ground", x: 0.230 } },
  { id: "bench", name: "ベンチ", spr: "prop_bench", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 8e5, def: { on: "ground", x: 0.257 } },
  { id: "gaming_chair", name: "ゲーミングチェア", spr: "prop_gaming_chair", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 1e6, def: { on: "ground", x: 0.572 } },
  { id: "vr_headset", name: "VRヘッドセット", spr: "prop_vr_headset", scale: 1, w: 24, h: 24, cls: "small", rank: 4, cost: 1e6, def: { on: "ground", x: 0.455 } },
  { id: "3d_printer", name: "3Dプリンタ", spr: "prop_3d_printer", scale: 1, w: 48, h: 48, cls: "ground", rank: 4, cost: 2e6, def: { on: "ground", x: 0.500 } },
  { id: "cat_rack", name: "キャットタワーラック", spr: "prop_cat_rack", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 2e6, def: { on: "ground", x: 0.612 } },
  { id: "kotatsu", name: "こたつ", spr: "prop_kotatsu", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 2e6, def: { on: "ground", x: 0.839 } },
  { id: "vending", name: "飲料自販機", spr: "prop_vending", scale: 1, w: 64, h: 64, cls: "ground", rank: 4, cost: 2e6, def: { on: "ground", x: 0.788 } },
  { id: "massage_chair", name: "マッサージチェア", spr: "prop_massage_chair", scale: 1, w: 64, h: 64, cls: "ground", rank: 5, cost: 3e6, def: { on: "ground", x: 0.361 } },
  { id: "stock_board", name: "株価ボード", spr: "prop_stock_board", scale: 1, w: 64, h: 64, cls: "ground", rank: 5, cost: 6e6, def: { on: "ground", x: 0.558 } },
  { id: "safe", name: "小型金庫", spr: "prop_safe", scale: 1, w: 48, h: 48, cls: "ground", rank: 5, cost: 1e7, def: { on: "ground", x: 0.626 } },
  { id: "xmas_tree", name: "クリスマスツリー", spr: "prop_xmas_tree", scale: 1, w: 64, h: 64, cls: "ground", rank: 5, cost: 2e7, def: { on: "ground", x: 0.516 } },
  { id: "ipo_bell", name: "上場の鐘", spr: "prop_ipo_bell", scale: 1, w: 48, h: 48, cls: "ground", rank: 6, cost: 5e7, def: { on: "ground", x: 0.395 } },
  /* --- 発注中の絵（届くまでカタログに出ない。名前契約は DECOR_ORDER と同じ） --- */
  { id: "water",  name: "ウォーターサーバー", desc: "冷たい水とお湯が出る", spr: "prop_water_server", scale: 1, w: 20, h: 44, cls: "ground",
    rank: 5, cost: 5e4, def: { on: "ground", x: 0.43 } },
  { id: "cattower", name: "キャットタワー", desc: "社員猫の憧れ", spr: "prop_cat_tower", scale: 1, w: 32, h: 64, cls: "ground",
    exits: 3, cost: 15, dust: true, def: { on: "ground", x: 0.975 } },
  { id: "aquarium", name: "金魚の水槽", desc: "台に載った小さな水槽。泳ぐ金魚", spr: "prop_aquarium", scale: 1, w: 48, h: 48, cls: "ground",
    exits: 10, cost: 40, dust: true, def: { on: "ground", x: 0.04 } },
];
/* 発注リスト（sakuri 作画）。DECOR_DEFS の「発注中」と同じ名前・原寸。下端中央が接地点 */
const DECOR_ORDER = ["water", "cattower"].map(id => DECOR_DEFS.find(d => d.id === id)).map(d => d.spr + " " + d.w + "×" + d.h);
/* 並べ替えの項目として登録（PROP_DEFS は strip-layout.ts。段は中景） */
for(const d of DECOR_DEFS) PROP_DEFS["decor_" + d.id] = { label: d.name, w: d.w, h: d.h, cls: d.cls };

function decorDesc(d){ return d.desc || (d.cls === "small" ? "机や棚の上にも置けます" : "床に置く家具"); }
function decorDef(id){ return DECOR_DEFS.find(d => d.id === id) || null; }
function decorOwned(id){ return !!(S.decor && S.decor[id]); }
function decorShown(id){ return decorOwned(id) && !S.decor[id].hidden && hasSprite((decorDef(id) || {} as DecorDef).spr); }
/* カタログに並ぶ品: 絵がある品だけ。解放前の品は「社格◯で解放」として次の1つだけ見せる */
function decorUnlocked(d){
  if(d.rank && (S.maxStudioLv || S.studioLv || 1) < d.rank) return false;
  if(d.exits && (S.prestiges || 0) < d.exits) return false;
  return true;
}
function decorUnlockText(d){ return d.exits ? "EXIT " + d.exits + " 回で解放" : "社格「" + rankName(d.rank) + "」で解放"; }
function decorCatalog(dust){
  const withArt = DECOR_DEFS.filter(d => hasSprite(d.spr) && !!d.dust === dust);
  const open = withArt.filter(d => decorUnlocked(d));
  /* 次に解放される1品: 解放の段が近い順、同じ段なら安い順 */
  const next = withArt.filter(d => !decorUnlocked(d)).sort((a, b) => decorTierOrder(a) - decorTierOrder(b) || a.cost - b.cost)[0];
  return { open, next };
}
function decorPrice(d){ return d.dust ? "星屑 " + d.cost + "⭐" : fmt(d.cost) + "🪙"; }
function buyDecor(id){
  const d = decorDef(id);
  if(!d || !hasSprite(d.spr)) return;
  if(!S.decor || typeof S.decor !== "object") S.decor = {};
  if(S.decor[id]){ say("もう持ってるにゃ"); return; }
  if(!decorUnlocked(d)){ say("まだ買えないにゃ（" + decorUnlockText(d) + "）"); return; }
  if(d.dust){
    if((S.dust || 0) < d.cost){ say("星屑が足りないにゃ…"); return; }
    S.dust -= d.cost;
  } else {
    if(S.coins < d.cost){ say("コインが足りないにゃ…"); return; }
    S.coins -= d.cost;
  }
  S.decor[id] = { at: Date.now() };
  /* 地面に置く家具は、買った時点の帯でいちばん広い空きの真ん中に置く（帯幅や家具の数で既定位置が埋まっていることがあるため） */
  if(d.def.on === "ground" && !propEntry("decor_" + id)){
    const x = decorFreeX(d.w);
    if(x !== null){
      if(!S.layoutProps || typeof S.layoutProps !== "object") S.layoutProps = {};
      S.layoutProps["decor_" + id] = { on: "ground", x: Math.round(x / stripVW * 1000) / 1000 };
    }
  }
  SoundKit.play("purchase");
  addLog("🪑 家具: 『" + d.name + "』を買った（-" + decorPrice(d) + "）");
  say("『" + d.name + "』が届いたにゃ！ ✥ 並べ替えで好きな所に置いてね");
  checkStamps(); save(); renderPanel();
}
/* しまう／出す（持ち物は残る。帯が混んできた時の逃げ道） */
function toggleDecor(id){
  if(!decorOwned(id)) return;
  if(S.decor[id].hidden) delete S.decor[id].hidden; else S.decor[id].hidden = 1;
  save(); renderPanel();
}
/* 帯の地面でいちばん広い空き（並べ替えの全項目の矩形の隙間）の中心。幅 w が入らなければ null */
function decorFreeX(w){
  if(!stripVW) return null;
  const spans = layoutItems().map(it => [it.cx - it.w / 2, it.cx + it.w / 2]).sort((a, b) => a[0] - b[0]);
  let best = null, bestW = 0, cur = 0;
  /* 右端は並べ替えボタンの下を避けて少し空ける */
  for(const sp of spans.concat([[stripVW - 4, stripVW]])){
    const gap = sp[0] - cur;
    if(gap > bestW){ bestW = gap; best = (cur + sp[0]) / 2; }
    cur = Math.max(cur, sp[1]);
  }
  return bestW >= w + 8 ? Math.round(best) : null;
}
/* 買った直後の置き場（layoutProps に無いとき）。面が無ければ地面の既定位置 */
function decorDefaultPlace(pid){
  const d = decorDef(pid.slice(6));
  const G = stripTierG("mid");
  if(!d) return { cx: stripDeskCX(), baseY: G };
  if(d.def.on !== "ground"){
    const sf = layoutSurfaces().find(s => s.id === (d.def as { on: string; dx: number }).on);
    if(sf) return { cx: sf.cx + (d.def as { dx: number }).dx, baseY: sf.y };
    return { cx: Math.round(stripVW * 0.40), baseY: G };
  }
  return { cx: Math.round(stripVW * (d.def as { x: number }).x), baseY: G };
}
/* 本棚の天板（新しい面）。天板の見かけの上面は棚の絵の上端 +8（drawStripShelf の置物と同じ規則） */
function decorSurfaces(){
  if(!decorShown("bookshelf") || layoutEdit.dragId === "decor_bookshelf") return [];
  const pl = propPlace("decor_bookshelf");
  return [{ id: "decor_bookshelf", cx: pl.cx, y: pl.baseY - 56 + 10, w: 72 }];
}
/* 帯への描画。pass "ground" は家具層（主机より奥）、"surface" は面に載った小物（家具の後）。
   当たり判定は持たない（並べ替えの矩形は layoutPropItems が作る） */
function drawStripDecor(pass){
  if(!S.decor) return;
  for(const d of DECOR_DEFS){
    if(!decorShown(d.id)) continue;
    const pid = "decor_" + d.id;
    const e = propEntry(pid);
    const onSurface = layoutEdit.dragId === pid ? (layoutEdit.dragCand && layoutEdit.dragCand.on !== "ground")
      : (e ? e.on !== "ground" : d.def.on !== "ground");
    if((pass === "surface") !== !!onSurface) continue;
    const pl = propPlace(pid);
    if(!onSurface) sShadow(pl.cx, pl.baseY - 0.5, Math.max(12, d.w * 0.8));
    if(d.id === "bookshelf"){
      /* 本棚: officeTier 2 からはスチール枠（作品棚の旧棚と同じ規則）。下段に技術書 */
      const nm = officeTier(S) >= 2 && hasSprite("shelf_steel") ? "shelf_steel" : d.spr;
      sDrawSprite(nm, pl.cx, pl.baseY, d.scale);
      sDrawSprite("prop_books", pl.cx, pl.baseY - 10, 2);
      continue;
    }
    sDrawSprite(d.spr, pl.cx, pl.baseY, d.scale);
  }
}
/* インテリアタブのカタログ（カードレイアウト。2026-11-20 設定タブから独立、sakuri 指示） */
function decorCatalogHTML(){
  return decorGroupHTML(false) + decorGroupHTML(true);
}
/* 通常の家具（コイン）と特別な家具（星屑）を分けて並べる。特別な家具は解放されるまで見出しごと出さない。
   通常の家具は品が多いので、解放の段（社格・EXIT 回数）ごとの見出しにまとめ、開くのは1段だけ
   （既定で開くのは、まだ買っていない品がある段のうち最新の段）。開閉は既存の折りたたみ部品 foldSec */
function decorTierOrder(d){ return d.exits ? 100 + d.exits : (d.rank || 1); }
function decorGroupKey(d){ return d.exits ? "x" + d.exits : "r" + (d.rank || 1); }
function decorGroupName(k){ return k[0] === "x" ? "EXIT " + k.slice(1) + " 回の家具" : "社格「" + rankName(+k.slice(1)) + "」の家具"; }
/* 品カード: 絵（スプライト）→ 名前 → 置き場の案内 → 価格ボタン。
   買った品はボタンが「出す/しまう」に変わる */
function decorCardHTML(d){
  const url = spriteURL(d.spr);
  const ico = url ? "<img class='decor-ico' src='" + url + "' alt=''>" : "<span class='sock'>🪑</span>";
  const owned = decorOwned(d.id);
  let btn;
  if(owned){
    btn = "<button onclick='toggleDecor(\"" + d.id + "\")'>" + (S.decor[d.id].hidden ? "出す" : "しまう") + "</button>";
  } else {
    const can = d.dust ? (S.dust || 0) >= d.cost : S.coins >= d.cost;
    btn = "<button class='buybtn'" + (can ? "" : " disabled") + " onclick='buyDecor(\"" + d.id + "\")'>" + decorPrice(d) + "</button>";
  }
  return "<div class='decorcard'><div class='decorpic'>" + ico + "</div>" +
    "<div class='nm'>" + d.name + (owned ? " <small>（持っている）</small>" : "") + "</div>" +
    "<div class='ds'>" + decorDesc(d) + "</div>" + btn + "</div>";
}
function decorGroupHTML(dust){
  const { open, next } = decorCatalog(dust);
  let h = "";
  if(dust){
    if(!open.length) return "";
    h += "<div class='note'>✨ 特別な家具（星屑で買う・ずっと持っていられる）</div>";
    h += "<div class='decorgrid'>" + open.map(decorCardHTML).join("") + "</div>";
  } else {
    const keys = [];
    for(const d of open.slice().sort((a, b) => decorTierOrder(a) - decorTierOrder(b))){ const k = decorGroupKey(d); if(!keys.includes(k)) keys.push(k); }
    let cur = keys[0] || "";
    for(const k of keys) if(open.some(d => decorGroupKey(d) === k && !decorOwned(d.id))) cur = k;
    for(const k of keys){
      const items = open.filter(d => decorGroupKey(d) === k).sort((a, b) => a.cost - b.cost);
      const owned = items.filter(d => decorOwned(d.id)).length;
      h += foldSec("decor_" + k, k === cur, decorGroupName(k), items.length + " 品・持っている " + owned, "<div class='decorgrid'>" + items.map(decorCardHTML).join("") + "</div>");
    }
  }
  if(next){
    h += "<div class='decorcard locked'><span class='sock'>🔒</span><div class='lockmain'><span class='nm'>" + next.name + "</span><div class='ds'>" +
      decorUnlockText(next) + "</div></div><button disabled>" + decorPrice(next) + "</button></div>";
  }
  return h;
}
