import { useState, useEffect, useRef } from 'react';
import { Copy, Pencil, Trash2, Plus, Search, Check, X, Tag, PackageOpen, Save, Upload, Download, AlertTriangle, Archive, RotateCcw } from 'lucide-react';
import Papa from 'papaparse';

// Claude Artifacts環境の window.storage の代わりに、
// 通常のブラウザで動く localStorage を使った簡易ストレージ。
// 呼び出し側のコードは変更していません。
const storage = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return { key, value: raw };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
};

const COLORS = {
  bg: '#F4F5F0',
  surface: '#FFFFFF',
  ink: '#20262B',
  inkSoft: '#5B6570',
  inkFaint: '#8B93949',
  line: '#DDE0D6',
  lineSoft: '#EBEDE6',
  pine: '#3F6355',
  pineSoft: '#EAF0EC',
  denim: '#3F5372',
  denimSoft: '#EAEDF2',
  rose: '#A9524E',
  roseSoft: '#F3E7E6',
  mustard: '#B8863A',
  plum: '#6B4E71',
  plumSoft: '#EFE7EE',
  danger: '#A9524E',
  orange: '#D9A055',
  orangeSoft: '#F6EEDF',
  blue: '#4682B4',
  blueSoft: '#E8F0F6',
  red: '#B8404A',
  redSoft: '#F3E2E2',
};

const CATEGORY_CONFIG = {
  'トップス': {
    code: 'to',
    accent: COLORS.orange,
    soft: COLORS.orangeSoft,
    fields: [
      { key: 'kitake', label: '着丈' },
      { key: 'mihaba', label: '身幅' },
      { key: 'kataha', label: '肩幅' },
      { key: 'sodetake', label: '袖丈' },
    ],
  },
  'パンツ': {
    code: 'bt',
    accent: COLORS.blue,
    soft: COLORS.blueSoft,
    fields: [
      { key: 'waist', label: 'ウエスト' },
      { key: 'waistMax', label: 'ウエスト最大' },
      { key: 'watarihaba', label: 'わたり幅' },
      { key: 'matoue', label: '股上' },
      { key: 'matashita', label: '股下' },
    ],
  },
  'スカート': {
    code: 'bt',
    accent: COLORS.blue,
    soft: COLORS.blueSoft,
    fields: [
      { key: 'kitake', label: '丈' },
      { key: 'waist', label: 'ウエスト' },
      { key: 'waistMax', label: 'ウエスト最大' },
      { key: 'hip', label: 'ヒップ' },
    ],
  },
  'アクセサリー': {
    code: 'ac',
    accent: COLORS.red,
    soft: COLORS.redSoft,
    fields: [
      { key: 'kitake', label: '着丈' },
      { key: 'mihaba', label: '身幅' },
      { key: 'kataha', label: '肩幅' },
      { key: 'sodetake', label: '袖丈' },
    ],
  },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG);

function typeCode(category) {
  return (CATEGORY_CONFIG[category] && CATEGORY_CONFIG[category].code) || '';
}

function fullItemNo(category, itemNo) {
  return `${typeCode(category)}${itemNo || ''}`;
}

// タイトルには種類コード(to/bt/ac)を含めない、品番のみの接頭辞
function titlePrefix(itemNo, brand) {
  return `${itemNo || ''} ${brand || ''}`.trim();
}

// タイトル内の全角スペースは半角に統一する（全角スペース禁止）
function toHalfWidthSpaces(str) {
  return (str || '').replace(/\u3000/g, ' ');
}

const TITLE_MAX_LENGTH = 40;

// カタカナ→ひらがな変換（ひらがな・カタカナ・英字を区別せず予測できるように）
function toHiragana(str) {
  return String(str || '').replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function normalizeBrandText(str) {
  return toHiragana(str).toLowerCase().trim();
}

function matchBrandCandidates(query, candidates) {
  const q = normalizeBrandText(query);
  if (!q) return [];
  return candidates.filter((c) => c && normalizeBrandText(c).includes(q) && normalizeBrandText(c) !== q).slice(0, 8);
}

const DEFAULT_BRANDS = [
  "who's who Chico フーズフーチコ",
  "Cherite by PRIME PATTERN シェリエットバイプライムパターン",
  "JUSGLITTY ジャスグリッティー",
  "EPOCA エポカ",
  "ノーブランド",
  "JIL.HABIT",
  "SPINNER BAIT スピナーベイト",
  "アディダス adidas",
  "kikisky",
  "GUESS ゲス",
  "インフィールド In Field",
  "EMODA エモダ アウター ジャンパー コート 薄手コート",
  "FRAY I.D フレイアイディー",
  "PART2 BY JUNKOSHIMADA パート2BYジュンコシマダ",
  "M'sグレイシー エムズグレイシー",
  "ユニクロ UNIQLO",
  "AGASA",
  "Jocomomola Sybilla",
  "SONIA RYKIEL ソニアリキエル オンワード樫山",
  "K.T KIYOKO TAKASE K.T キヨコ タカセ",
  "MISSJ",
  "サンジョア saintjoie ナイガイ",
  "castleberry キャッスルベリー ナイガイ",
  "エンポリオアルマーニ EMPORIO ARMANI",
  "Laura Biagiotti ラウラ ビアジョッティ",
  "ADDA",
  "RAMUZ ラミューズ",
  "nitca ニトカ",
  "シビラ Sybilla",
  "Ron Herman ロンハーマン",
  "Jocomomola ホコモモラ",
  "NOLLEY'S light ノーリーズ",
  "GIANNI VALENTINO ジャンニヴァレンチノ",
  "エポカ epoca",
  "PLST プラステ",
  "ユナイテッドアローズ UNITED ARROWS",
  "ef-de エフデ",
  "ジルスチュアート jillstuart",
  "LEBOR GABALA レボル ガバラ",
  "BACK NUMBER バックナンバー",
  "AKM エイケイエム",
  "CAPRICIEUX LE'MAGE カプリシューレマージュ",
  "Banana Republic バナナリパブリック",
  "Diagram ダイアグラム",
  "The 1st.Floor ザファーストフロアー",
  "ZARA ザラ",
  "HANAE MORI ハナエモリ",
  "UNTITLED アンタイトル",
  "UNITED ARROWS ユナイテッドアローズ",
  "プラージュ Plage",
  "Aylesbury アリスバーリー",
  "FLORENT フローレント",
  "Spick & Span スピック＆スパン",
  "URBAN RESEARCH アーバンリサーチ",
  "PAUL STUART ポールスチュアート",
  "Rinascimento リナシメント",
  "PINKO ピンコ",
  "liberty garden リバティガーデン",
  "TO BE CHIC トゥービーシック",
  "DIANE von FURSTENBERG ダイアンフォンファステンバーグ",
  "J Crew ジェイクルー",
  "ザラ zara",
  "Theory セオリー",
  "Leilian レリアン",
  "pierre cardin ピエールカルダン",
  "Paul Smith BLACK ポールスミスブラック",
  "Sybilla シビラ",
  "レオナール LEONARD",
  "MISSONI ミッソーニ",
  "IENA イエナ",
  "TALBOTS タルボット",
  "dodgest",
  "エーシーデザインバイアルファキュービック A/C DESIGN BY ALPHA CUBIC",
  "barngard",
  "BURBERRY BLACK LABEL バーバリーブラックレーベル",
  "BEATING HEART ビーティングハート",
  "BEAMS HEART ビームス ハート",
  "Paule Ka ポールカ",
  "Theory luxe セオリーリュクス",
  "ベラルディ BERARDI",
  "ラルフ ローレン Ralph Lauren",
  "J.CREW ジェイクルー",
  "next",
  "LACOSTE ラコステ",
  "FRAGILE フラジール",
  "伊太利屋 イタリヤ",
  "M-PREMIER エムプルミエ",
  "ANAYI アナイ",
  "NARACAMICIE ナラカミーチェ",
  "FRED PERRY フレッド ペリー",
  "INDIVI インディヴィ",
  "ロートレアモン LAUTREAMONT",
  "SLOBE IENA スローブイエナ",
  "MK MICHEL KLEIN エムケーミッシェルクラン",
  "Dessin デッサン",
  "NATURAL BEAUTY ナチュラルビューティー",
  "Courreges クレージュ",
  "LOVELESS ラブレス",
  "Calvin Klein カルバンクライン",
  "MARC BY MARC JACOBS マーク バイ マーク ジェイコブス",
  "ホコモモラ Jocomomola",
  "ソニア リキエル SONIA RYKIEL",
  "アーバンリサーチ URBAN RESEARCH",
  "Maternal America マターナルアメリカ",
  "ジャーナルスタンダード レリューム JOURNAL STANDARD relume",
  "22OCTOBRE 22オクトーブル",
  "ESCADA エスカーダ",
  "agnes b. アニエスベー",
  "NEWYORKER ニューヨーカー",
  "エフデ ef-de",
  "tocco closet トッコ クローゼット",
  "Otto COLLECTION オットー コレクション",
  "Reflect リフレクト",
  "コントワー・デ・コトニエ Comptoir des Cotonniers",
  "EVEX by KRIZIA エヴェックス バイ クリツィア",
  "COUP DE CHANCE クードシャンス",
  "STRAWBERRY-FIELDS ストロベリーフィールズ",
  "SHIPS シップス",
  "INED イネド",
  "JOURNAL STANDARD ジャーナルスタンダード",
  "ROPE' ロペ",
  "組曲 KUMIKYOKU",
  "YECCA VECCA イェッカヴェッカ",
  "TOMORROWLAND トゥモローランド",
  "COMME CA ISM コムサイズム",
  "GALLARDAGALANTE ガリャルダガランテ",
  "ナラカミーチェNARACAMICIE",
  "ギャラリービスコンティ GALLERY VISCONTI",
  "WORK TRIP OUTFITS GREEN LABEL RELAXING ワークトリップアウトフィッツグリーンレーベル リラクシング",
  "カールヘルム Karl Helmut",
  "IKUKO イクコ",
  "ナラカミーチェ NARACAMICIE",
  "Max&Co. マックス&コー",
  "DoCLASSE ドゥクラッセ",
  "To b. by agnès b. トゥービー バイ アニエスベー",
  "HARDY AMIES LONDON ハーディエイミス ロンドン",
  "JOSEPH HOMME ジョゼフ オム",
  "Laura Ashley ローラアシュレイ",
  "agnès b. アニエスベー",
  "AKRIS アクリス／皇室御用達で有名なスイスのラグジュアリーブランド、アクリスのワンピースです。",
  "Yumi Katsura ユミカツラ",
  "PINK HOUSE ピンクハウス",
  "AGUAMARINA アグアマリーナ",
  "Kloset クロセット",
  "Laura Ashley ローラア シュレイ",
  "TRUSSARDI トラサルディ",
  "ジッツォインターナショナル JIZZO INTERNATIONAL",
  "PEPE JEANS LONDON ペペジーンズロンドン",
  "RENATO NUCCI レナートヌッチ ナラカミーチェ NARACAMICIE",
  "SONIA RYKIEL ソニアリキエル",
  "プーマ Puma",
  "RHYME ライム （rhyme city tailored clothing）",
  "TOCCA トッカ",
  "cashmere charoy",
  "BEAMS HEART ビームスハート",
  "Paul Smith ポール スミス",
  "MARC JACOBS マークジェイコブス",
  "STUDIO PICONE スタジオピッコーネ",
  "Jun Ashida ジュンアシダ",
  "ラディエイト RADIATE メロウトップス フリルトップsu",
  "JAEGER イエガー",
  "Aquascutum アクアスキュータム",
  "EGERIE エジェリ",
  "Maglie par ef-de マーリエ パー エフデ",
  "Moschino モスキーノ",
  "kate spade new york ケイトスペード",
  "ELIE TAHARI エリータハリ",
  "erika collection エリカコレクション",
  "etro エトロ",
  "M/M",
  "UNTITLED GRUPPOCINQUE",
  "DAKS ダックス",
  "TOMMY HILFIGER トミーヒルフィガー",
  "BLUE WORK ブルーワーク",
  "CRAIG GREEN クレイググリーン",
  "OLD ENGLAND オールド イングランド",
  "Arnold Palmer アーノルドパーマー",
  "alan martin アラン マーティン",
  "agnes b アニエスベー",
  "カシミヤ100%",
  "Arnold Palmer アーノルド パーマー",
  "DKNY ディーケーエヌワイ",
  "Repetto レペット",
  "MARC JACOBS マーク ジェイコブス",
  "Ci-MODA シーアイモーダ",
  "ラルトラモーダ LALTRAMODA",
  "ILVENTO&LASETA イルヴェントエラセタ",
  "green label relaxing グリーンレーベル リラクシング",
  "MOGA モガ",
  "Ray BEAMS レイビームス",
  "malla マーラ",
  "GROUND FLOOR グラウンドフロアー nano・universe ナノ・ユニバース",
  "URBAN RESEARCH アーバン リサーチ",
  "ITEMS URBANRESEARCH アイテムズアーバンリサーチ",
  "Max&Co マックス&コー",
  "green label relaxing グリーンレーベルリラクシング",
  "BANANA REPUBLIC バナナ・リパブリック",
  "FREAK'S STORE フリークスストア",
  "BAYFLOW ベイフロー",
  "kOhAKU コハク",
  "MARC BY MARC JACOBSマーク バイ マーク ジェイコブス",
  "BCBG MAXAZRIA ビーシービージーマックスアズリア",
  "M'S GRACY エムズグレイシー",
  "GALERIE VIE ギャルリー ヴィー",
  "MICHEL KLEIN ミッシェルクラン",
  "PQ",
  "two hearts",
  "ジリ JILI",
  "dreamijoey ドリーミージョイ",
  "ストールストール STOR STOR STO:R STO:R",
  "JENEVIEVE ジュヌヴィエーヴ",
  "ecruefil エクリュフィル",
  "from 5th サン・フェルメール",
  "CIAOPANIC チャオパニック",
  "Laura Ashley ローラ アシュレイ",
  "nano universe ナノユニバース",
  "31 Sons de mode トランテアン ソン ドゥ モード",
  "Ralph Lauren ラルフローレン",
  "heliopole Homme エリオポール オム",
  "EDIFICE エディフィス",
  "BALLSEY ボールジィ",
  "SALON adam et rope' サロン アダム エ ロペ",
  "Jili ジリ",
  "スローブ イエナ SLOBE IENA",
  "東京スタイル",
  "chatoyer",
  "LAPIS LUCE BEAMS ラピスルーチェビームス",
  "Demi-Luxe BEAMS デミルクス ビームス",
  "un dix cors アンディコール",
  "Kastane カスタネ",
  "GALLERY VISCONTI ギャラリービスコンティ",
  "Ray BEAMS レイ ビームス",
  "BALLOW",
  "H&M エイチアンドエム",
  "HIROKO KOSHINO ヒロココシノ",
  "Flora Fonte フローラ フォンテ",
  "β ベータ",
  "LAPINE BLANCHE ラピーヌ ブランシュ",
  "BARNYARDSTORM バンヤードストーム",
  "ラディエイト RADIATE",
  "Max Mara マックスマーラ",
  "Weekend Max Mara ウィークエンド マックスマーラ",
  "M-premierBLACK エムプルミエブラック",
  "ANTEPRIMA アンテプリマ",
  "TO BE CHIC トゥー ビー シック",
  "M-premier BLACK エムプルミエブラック",
  "GUILD PRIME ギルドプライム",
  "Adam et Rope' アダムエロぺ",
  "Michael Kors マイケルコース",
  "Paul Smith jeans ポールスミスジーンズ",
  "Eddie Bauer エディーバウアー",
  "Weekend Max Mara ウィークエンドマックスマーラ",
  "SONIA RYKIEL ソニア リキエル",
  "FUGAFUGA フーガフーガ",
  "ARMANI COLLEZIONI アルマーニコレツォーニ",
  "BUENA VISTA ブエナビスタ",
  "EN FOCUS STUDIO エンフォーカススタジオ",
  "Ne-net ネネット",
  "sabstreet my standard サブストリートマイスタンダード",
  "DIANE von FURSTENBERGダイアンフォンファステンバーグ",
  "Stola. ストラ",
  "BANANA REPUBLIC バナナ リパブリック",
  "Paul Smith Black Label ポールスミス ブラックレーベル",
  "NOKO OHNO ノコオーノ",
  "GU×UNDERCOVER ジーユー×アンダーカバー",
  "Nice Things ナイスシングス",
  "Liebe リエベ",
  "JOHN SMEDLEY ジョンスメドレー",
  "COMME CA DU MODE コムサデモード",
  "NOBLE ノーブル",
  "Harrods ハロッズ",
  "Viaggio Blu ビアッジョブルー 定価：24,200円",
  "23区 ニジュウサンク",
  "leara woman",
  "CDEC クードシャンス COUP DE CHANCE",
  "BURBERRY BLUE LABELバーバリーブルーレーベル",
  "ランバンコレクション LANVIN COLLECTION",
  "レジァンス REGENCE",
  "UNIVERVAL MUSE ユニバーバル ミューズ",
  "ジャイアンツ GIANTS",
  "ナイキ NIKE",
  "Guy Laroche ギ ラロッシュ",
  "Tory Burch トリーバーチ",
  "green label relaxing グリーンレーベルリラクシング GLR",
  "yoshie inaba ヨシエイナバ",
  "TABASA タバサ",
  "GRACE CLASS グレースクラス／GRACE CONTINENTAL グレースコンチネンタル",
  "NICOLE ニコル",
  "YUKI TORII ユキ トリヰ",
  "MAISON HONORE メゾンオノレ",
  "Mademoiselle NONNON マドモアゼルノンノン",
  "HUMAN WOMAN ヒューマンウーマン",
  "Johnny was ジョニーワズ",
  "ユニクロ×草間彌生 yayoi kusama",
  "wb ダブルビー",
  "ZARAWOMAN ザラ ウーマン",
  "Borbonebe ボルボネーゼ",
  "PUPULA ププラ",
  "TOMMY HILFIGER トミー ヒルフィガー",
  "Armani Exchange アルマーニ エクスチェンジ",
  "JILL STUART ジルスチュアート",
  "BIGI ビギ",
  "Balla Valentina ITALY バラ バレンティーナ",
  "BE RADIANCE ビーラディエンス",
  "PEARLY GATES パーリーゲイツ",
  "PROPORTION BODY DRESSING プロポーションボディドレッシング",
  "QUEENS COURT クイーンズコート",
  "ICB アイシービー",
  "RALPH LAUREN SPORT ラルフローレンスポーツ",
  "LANVIN COLLECTION ランバンコレクション",
  "L'EQUIPE yoshie inaba レキップ ヨシエイナバ",
  "HOLLISTER ホリスター",
  "FABIANA FILIPPI ファビアナフィリッピ",
  "FENN WRIGHT MANSON フェンライトマンソン",
  "Lallia Mù ラリアムー lalliaMu",
  "KariAng カリアング",
  "MARNI マルニ",
  "クルチアーニ Cruciani",
  "衣女路 イメージ",
  "grace'u grace u",
  "BROOKS BROTHERS ブルックスブラザーズ",
  "BROOKS BROTHERS",
  "ANNE FONTAINE アンフォンティーヌ",
  "Paul Stuart ポールスチュアート",
  "ESCADA SPORT エスカーダスポーツ",
  "PINK MOUSSEUX ピンクムスー",
  "POLO RALPH LAUREN ポロ ラルフ ローレン",
  "gyaza ギャザ",
  "Jil Sander ジルサンダー",
  "adidas アディダス",
  "CoSTUME NATIONAL コスチュームナショナル",
  "JOHN SMEDLEY ジョン スメドレー",
  "Luxe Relaxing ラックス リラクシング",
  "L.B CANDY STOCK キャンディーストック リリーブラウン",
  "IÉNA une petites merveille イエナ",
  "three dots スリードッツ",
  "COMME CA コムサ",
  "SILAS サイラス",
  "BEAUTY&YOUTH UNITED ARROWS ビューティーアンドユースユナイテッドアローズ",
  "marion マリオン",
  "ABAHOUSE アバハウス",
  "WRjoias ダブルアールジョイアス",
  "HANRO ハンロ",
  "Debbie by FREE'S SHOP デビーバイフリーズショップ",
  "AFTERNOON TEA WARDROBE アフタヌーンティーワードローブ",
  "JOURNAL STANDARD HOMESTEAD ジャーナルスタンダードホームステッド",
  "ROBERTA DI CAMERINO ロベルタディカメリーノ",
  "MISS ASHIDA ミス アシダ",
  "POLO RALPH LAUREN ポロラルフローレン",
  "MISSONIミッソーニ",
  "cawaii カワイイ",
  "FRENCH PAVE フレンチパヴェ cawaii カワイイ",
  "akane アカネ あむう",
  "M'SGRACY エムズグレィシー",
  "SUIVI スイヴィ",
  "ANTONIO FUSCO アントニオフスコ",
  "L.L.Bean エルエルビーン",
  "Cynthia Rowley シンシア ローリー",
  "MISCH MASCH ミッシュマッシュ",
  "FILA フィラ",
  "axes femme アクシーズファム",
  "ScoLar スカラー",
  "twenty oneトゥエンティワン",
  "YUMMY GRIMES ヤミーグライムス",
  "Celtic セルティック",
  "KUMIKYOKU クミキョク",
  "ICHIE STRAWBERRY-FIELDS イチエ ストロベリーフィールズ",
  "KUMIKYOKU 組曲",
  "anatelier アナトリエ",
  "EGOIST エゴイスト",
  "Mila Owen ミラ オーウェン",
  "PENNEYS ぺニーズ",
  "Belle vintage ベルヴィンテージ ラベルエチュード",
  "lululemon ルルレモン",
  "gypsophila ジプソフィア",
  "Patrizia Pepe パトリツィアペペ",
  "STUNNING LURE スタニングルアー",
  "Girly Doll ガーリードール",
  "Stilconf スタイルコンフ",
  "HANAE MORI PARIS ハナエモリ",
  "SCAPA スキャパ",
  "Abercrombie&Fitch アバクロンビーアンドフィッチ",
  "Donna Karan ダナキャラン",
  "LAUTREAMONT ロートレアモン",
  "Comptoir des Cotonniers コントワー デ コトニエ",
  "ROPE' PICNIC ロぺピクニック",
  "Courrèges クレージュ",
  "S.T.B",
  "Viaggio Blu ビアッジョブルー",
  "la.f... ラ エフ",
  "DOLLY GIRL BY ANNA SUI ドーリーガールバイアナスイ",
  "DIKAMNI",
  "OLD ENGLAND オールドイングランド",
  "FRANCO ZICHE フランコジッケ",
  "BURBERRY BLUE LABEL バーバリーブルーレーベル",
  "TAION タイオン",
  "MADAM JOCONDE マダム ジョコンダ",
  "Prenda Mia プレンダ ミア",
  "ジェイダ GYDA",
  "DIESEL ディーゼル",
  "TRICOT CHIC トリコ シック",
  "LE SOUK HOLIDAY ルスークホリデー",
  "FIGNO フィグノ",
  "FRAMeWORK フレームワーク",
  "ANNA SUI アナスイ",
  "SNIDEL スナイデル 定価：9,400円",
  "SLY スライ",
  "ZARA WOMAN ザラウーマン",
  "gelato pique ジェラートピケ",
  "MOUSSY マウジー",
  "KANSAI YAMAMOTO カンサイヤマモト",
  "ESTNATION エストネーション",
  "LIMI feu リミ フゥ",
  "NARA CAMICIE ナラ カミーチェ",
  "i+mu イム センソユニコ",
  "DAMA collection ダーマ コレクション",
  "BOSCH ボッシュ",
  "Shirley Temple シャーリーテンプル",
  "BURBERRY バーバリー",
  "RALPH LAUREN ラルフローレン",
  "Bobson ボブソン",
  "Columbia コロンビア",
  "hakka kids ハッカキッズ",
  "kladskap クレードスコープ",
  "トミカ TOMICA",
  "babyGAP ベビーギャップ",
  "JUNK STORE ジャンクストアー",
  "e-baby イーベビー",
  "MIKI HOUSE DOUBLE_B ミキハウス ダブルB",
  "THE NORTH FACE ザノースフェイス",
  "BABYDOLL ベビードール",
  "MICA&DEAL マイカ＆ディール",
  "qualite カリテ",
  "SUIT CLOSET スーツクローゼット",
  "LABEL LB.04 ナノ・ユニバース",
  "ALESSANDRO DE BENEDETTI アレッサンドロデベネデッティ",
  "BRORA ブローラ",
  "KBF ケービーエフ",
  "PIERRE BALMAIN ピエールバルマン",
  "Composition by kenzo コンポジション ケンゾー",
  "CHRISTIAN AUJARD クリスチャンオジャール",
  "VIVIDAKIKO ヴィヴィッドアキコ",
  "byblos ビブロス",
  "Byblos ビブロス",
  "PORTOMORO ポルトモーロ",
  "Ebonyivory エボニーアイボリー",
  "MARELLA マレーラ",
  "MISSONI SPORT ミッソーニスポーツ",
  "チャイハネ アミナ amina",
  "EMMA JAMES エマジェイムス",
  "MAJESTIC LEGON マジェスティックレゴン",
  "LILY BROWN リリーブラウン",
  "chocol raffine robe ショコラフィネ ローブ",
  "ehka sopo エヘカソポ",
  "Darich ダーリッチ 定価：19,800円",
  "VIS ビス",
  "MURUA ムルーア",
  "titivate ティティベイト",
  "theory luxe セオリーリュクス",
  "Sherrybon",
  "OLIVE des OLIVE オリーブ デ オリーブ",
  "良品計画 無印良品",
  "Helm ヘルム",
  "DAZY デイジー",
  "L'EST ROSE レストローズ",
  "SNIDEL スナイデル 定価：24,000円",
  "GU ジーユー",
  "jiffies ジフィーズ",
  "Samansa Mos2 サマンサモスモス",
  "Ensuite エンスウィート",
  "Noela ノエラ",
  "Karl Park Lane カールパークレーン",
  "CECIL McBEE セシルマクビー",
  "ROYAL PARTY ロイヤルパーティー",
  "KRYCLOTHING ケリークロッシング",
  "Piacere ピアチェーレ",
  "HUG.U ハグユー",
  "RANDY ランディ",
  "Ritsuko le troisieme リツコシラハマ",
  "Champion チャンピオン",
  "AZUL BY MOUSSY アズールバイマウジー",
  "RENA LANGE レナランゲ",
  "ARMANI JEANS アルマーニジーンズ",
  "Aveniretoile アベニールエトワール",
  "Nature's ネイチャーズ",
  "Yukiko Hanai ユキコ ハナイ",
  "Spick&Span Noble スピック＆スパン ノーブル",
  "AKRIS アクリス",
  "eimy istoire エイミー イストワール",
  "YOSHIYUKIKONISHI ヨシユキコニシ",
  "KUMIKYOKU クミキョク組曲",
  "BEARDSLEY ビアズリー",
  "BRAVO",
  "PINKY&DIANNE ピンキーアンドダイアン",
  "PINKY & DIANNE ピンキーアンドダイアン",
  "FOXEY フォクシー",
  "TAE ASHIDA タエアシダ",
  "me+em select ミームセレクト",
  "HISASHI HOSONO ヒサシホソノ",
  "belpaci ベルパーチ",
  "MAISON SPECIAL メゾンスペシャル",
  "UNIQLO ユニクロ",
  "REDYAZEL レディアゼル",
  "VERMEIL par iena ヴェルメイユパーイエナ",
  "NOLLEY'S ノーリーズ",
  "SENSE OF PLACE センスオブプレイス",
  "ARAN CRAFTS アランクラフト",
  "JULIA BOUTIQUE ジュリアブティック",
  "NICOLE CLUB FOR MEN ニコルクラブフォーメン",
  "SAINT JAMES セントジェームス",
  "Chillfar チルファー",
  "TOMORROWLAND TRICOT トゥモローランド",
  "NIMES ニーム",
  "KEITH キース",
  "SNIDEL スナイデル",
  "TSUMORI CHISATO ツモリチサト",
  "Apuweiser-riche アプワイザー リッシェ",
  "cherir la femme シェリーラファム フランシュリッペ",
  "Cacharel キャシャレル",
  "Lois CRAYON ロイスクレヨン",
  "Gabardine K.T ギャバジンK.T",
  "ENRICO COVERI エンリココベリ",
  "LANVIN COLLECTION ランバン コレクション",
  "SONTAKU ソンタク",
  "iBLUES イブルース Max Mara マックスマーラ",
  "MACKINTOSH PHILOSOPHY マッキントッシュフィロソフィー",
  "ROPÉ PICNIC ロペピクニック",
  "Peyton Place ペイトンプレイス",
  "tokyo style 東京スタイル",
  "Dorry Doll ドリードール",
  "Super Beauty スーパービューティ",
  "Petit Maison プチメゾン",
  "COOMB クーム",
  "ROKU BEAUTY&YOUTH UNITED ARROWS ロク ビューティーアンドユース 6",
  "BLUE LES COPAINS ブルー レ・コパン",
  "COMME ÇA COLLECTION コムサコレクション NIEDIECK VELVET ニーディック ベルベット",
  "Topys トピィーズ",
  "SANYOCOAT サンヨーコート",
  "LA MONET ラモネ",
  "TOMMY トミー TOMMY HILFIGER トミーヒルフィガー",
  "SHIZUKA KOMURO シズカコムロ",
  "FILA GOLF フィラゴルフ",
  "CHAPS RALPH LAUREN チャップスラルフローレン",
  "Blugirl ブルーガール",
  "Adidas アディダス",
  "Sally Scott サリースコット",
  "SACRA サクラ",
  "POLO SPORTS ポロスポーツ",
  "PAUL&JOE SISTER ポールアンドジョーシスター",
  "Mystrada マイストラーダ",
  "LANVIN en Bleu ランバンオンブルー",
  "TRUNK HIROKO KOSHINO トランク ヒロココシノ",
  "la.f... ラエフ",
  "Samantha Thavasa サマンサタバサ",
  "S Max Mara エスマックスマーラ",
  "REISS リース",
  "CONVERSE TOKYO コンバーストウキョウ",
  "Sousbois スーボア",
  "Abercrombie&Fitch アバクロンビー&フィッチ",
  "UNIQLO Mame Kurogouch マメクロゴウチ",
  "demain ドゥマン",
  "any SiS エニィスィス",
  "HONEY MI HONEY ハニーミーハニー",
  "Hoffmann ホフマン",
  "MIDIUMISOLID ミディウミソリッド",
  "Schott × earth music&ecology ショット",
  "PALACE GARDEN パレスガーデン",
  "setaichiro セタイチロウ",
  "untitled on closet アンタイトル",
  "mont-bell モンベル",
  "JUICY COUTURE ジューシークチュール",
  "ヒロタ",
  "UMBRO アンブロ",
  "See by Chloe シーバイクロエ",
  "Traditional Weatherwear トラディショナル ウェザーウェア",
  "Iroquois イロコイ 定価：49,000円",
  "ohana オハナ",
  "Comptoir des Cotonniers コントワーデコトニエ",
  "ADORE アドーア",
  "ニジュウサンク 23区",
  "mizuiro ind ミズイロインド",
  "JOURNAL STANDARD luxe ジャーナルスタンダード ラックス",
  "ROBERT FRIEDMAN ロバートフリードマン",
  "INGEBORG インゲボルグ",
  "titty&Co. ティティー&コー",
  "DUAL VIEW デュアルヴュー",
  "Feroux フェルゥ",
  "FUMIKA UCHIDA フミカウチダ",
  "自由区 ジユウク",
  "CINOH チノ",
  "eimy istoire エイミーイストワール",
  "ELLE エル",
  "Cara カーラ",
  "22 OCTOBRE ヴァンドゥーオクトーブル",
  "MACPHEE マカフィー",
  "L'EQUIPE レキップ",
  "GLOBAL WORK グローバルワーク",
  "EDWIN エドウイン",
  "cacharel キャシャレル",
  "BURBERRY LONDON バーバリーロンドン",
  "mercibeaucoup, メルシーボークー",
  "martinique マルティニーク",
  "echo71 エコー71",
  "FENNEL フェンネル",
  "ARTICLECOM",
  "SUPER HAKKA スーパーハッカ",
  "pattern torso パターントルソ アンティカ",
  "ADIEU TRISTESSE アデュートリステス",
  "Phase Eight フェイズエイト",
  "HAWAIIAN RESERVE ハワイアンリザーブ",
  "MICHAEL KORS マイケルコース",
  "JUSGLITTY ジャスグリッティー 定価：19,000",
  "DENNY ROSE デニーローズ",
  "MOGA モガ ／THE NEW DENIM PROJECT 再生デニム",
  "To b. by agnes b トゥービーバイアニエスベー",
  "POLO JEANS CO ポロジーンズカンパニー",
  "Liliane Burty リリアンビューティ",
  "Les Copains レ コパン",
  "Femicite フェミシテ クールカレアン株式会社",
  "Nanette Lepore ナネットレポー",
  "staple ステイプル",
  "SIMONE WILD シモーネ ワイルド",
  "LACE LADIES レースレディース",
  "PEYTON PLACE ペイトンプレイス",
  "viyella ビエラ",
  "ICEBERG アイスバーグ",
  "YUMI KATSURA ユミカツラ 桂由美",
  "Sov. ソブ",
  "45rpm studio 45アールピーエムスタジオ 45R",
  "KIMIJIMA BOUTIQUE キミジマブティック",
  "23区×LIBECO",
  "BURBERRY GOLF バーバリーゴルフ",
  "ungaro ウンガロ",
  "sacai luck サカイ ラック",
  "ZUCCa ズッカ",
  "axes femme kawaii アクシーズファムカワイイ",
  "JUNKO SHIMADA ジュンコ シマダ",
  "DANAPARIS ダナパリ",
  "フランドル FLANDR／ LIMITED EDITION with FLANDRE",
  "MAX&Co. マックス アンド コー",
  "NAPAPIJRI ナパピリ",
  "CAROLL キャロル",
  "U:UME ユーム",
  "SunaUna スーナウーナ",
  "Ralph Lauren ラルフ ローレン",
  "MINIMUM MINIMUM ミニマムミニマム",
  "LIVIANA CONTI リビアナコンティ",
  "ITEMS URBAN RESEARCH アイテムズ アーバンリサーチ",
  "LANVIN SPORT ランバンスポール",
  "PUAL CE CIN ピュアルセシン",
  "TOCCA トッカ 定価：16000円",
  "Te chichi テチチ",
  "AMACA アマカ",
  "HANAE MORI NEW YORK ハナエモリ ニューヨーク",
  "JAYRO ジャイロ",
  "ANN TAYLOR アンテイラー",
  "TETE HOMME テットオム",
  "INGNI イング",
  "tete de homme gem テットオム ジェム",
  "KID BLUE キッドブルー",
  "jun ashida ジュンアシダ",
  "ketty ケティ",
  "franche lippee フランシュリッペ",
  "KANEKO ISAO カネコイサオ",
  "URBAN RESEARCH DOORS アーバンリサーチ",
  "YOHEI OHNO ヨウヘイ オオノ",
  "12Twelve Agenda トゥエルブアジェンダ",
  "SUNAOKUWAHARA スナオクワハラ",
  "STUDIOUS ステュディオス",
  "pourlafrime プーラフリーム",
  "titty&Co ティティー&コー",
  "FLORENT RELAX フローレント",
  "MUSEE DUJI ミューゼドウジ",
  "leur logette ルール ロジェット",
  "DES PRES デプレ",
  "URBAN RESEARCH DOORS アーバンリサーチドアーズ",
  "Jewel Changes ジュエルチェンジズ",
  "JUSGLITTY ジャスグリッティー 定価12,000円",
  "ORCIVAL オーシバル",
  "JUNKOSHIMADA ジュンコシマダ",
  "BURBERRY BRIT バーバリーブリット",
  "PourVous プールヴー",
  "coen コーエン c.mountaineering",
  "LOEFF ロエフ Elotroi",
  "Morimucha モリムチャ",
  "SISTE'S",
  "EROS shozo tsujimura",
  "MARGARET HOWELL マーガレットハウエル",
  "Connected APPAREL コネクテッドアパレル",
  "Demi Luxe BEAMS デミルクス ビームス",
  "Risposte",
  "KAREN WALKER カレンウォーカー",
  "renoma レノマ",
  "DOUX ARCHIVES ドゥ アルシーヴ",
  "Paul Smith ポールスミス",
  "BARNEYS NEW YORK バーニーズ ニューヨーク",
  "AVENIRETOILE アベニールエトワール",
  "Supreme LaLa シュープリームララ",
  "synchro crossings シンクロ クロッシングズ",
  "TIARA ティアラ",
  "DO!FAMILY ドゥファミリィ",
  "HUGO BOSS ヒューゴボス",
  "Sov ソブ",
  "FRAY ID フレイアイディー",
  "ENFÖLD エンフォルド",
  "HEMISPHERES エミスフェール",
  "BODY DRESSING Deluxe ボディドレッシングデラックス",
  "Essentials エッセンシャルズ",
  "ユニクロ INES DE LA FRESSANGE",
  "REGINA ROMANTICO レジィーナロマンティコ",
  "Salvatore Piccolo サルヴァトーレピッコロ",
  "NAISSANCE ネサンス",
  "Emiria Wiz エミリアウィズ",
  "deicy me&me couture ミーアンドミークチュール",
  "DEICY デイシー",
  "beautiful people ビューティフルピープル",
  "LE CIEL BLEU ルシェルブルー",
  "Danny&Anne ダニーアンドアン",
  "me&me couture ミーアンドミークチュール",
  "ELFORBR エルフォーブル",
  "BEAMS ビームス",
  "Curensology カレンソロジー",
  "SPECCHIO スペッシオ",
  "Rirandture リランドチュール",
  "CECI OU CELA セシオセラ",
  "versus gianni versace",
  "Louis de Gama London",
  "Manhattan Portage マンハッタンポーテージ",
  "gicipi ジチピ",
  "REGAL リーガル",
  "pool studio alivier プールスタジオ アリヴィエ",
  "birthday bash バースデーバッシュ",
  "UNFILO アンフィ―ロ",
  "COCOLO BLAND ココロブランド",
  "齋藤都世子 SAITO KNIT サイトウトヨコ",
  "SHARE PARK シェアパーク",
  "HARROW TOWN STORES ハロータウンストアーズ",
  "Agnona アニオナ",
  "barassi バラシ",
  "Levi’s × HELLO KITTY 45th ANNIVERSARY",
  "NIKE ナイキ",
  "And Couture アンドクチュール",
  "CHILLE キリア",
  "MAGLIA STELLA マリアステラ",
  "GINZA Maggy 銀座マギー",
  "Petit fleur プチフルール",
  "jillstuart ジルスチュアート",
  "Taro Horiuchi タロウホリウチ 堀内太郎",
  "CLOUDY クラウディ",
  "SPORTMAX CODE スポーツマックスコード",
  "Velnica ヴェルニカ",
  "UNIQLO ユニクロ ANNASUI",
  "Loungedress ラウンジドレス",
  "BEAMS GOLF ビームスゴルフ",
  "UNITED TOKYO ユナイテッドトウキョウ",
  "TED BAKER テッドベイカー",
  "LOULOU WILLOUGHBY ルルウィルビー",
  "Shower Party シャワーパーティ",
  "allureville アルアバイル",
  "Tara Jarmon タラ ジャーモン",
  "ARAMIS アラミス",
  "MARMALADE",
  "SnowLotus スノーロータス",
  "AMERI アメリ",
  "KIMIJIMA BOUTIQUE",
  "GRACE CONTINENTAL グレースコンチネンタル",
  "la belle Etude ラベル エチュード",
  "bizzarro ビザロ",
  "Ronshan Chic ロンシャンチック",
  "FRAY.ID フレイアイディー",
  "Rady レディ",
  "Neiman Marcus ニーマンマーカス",
  "RACEA ラシア",
  "DRESS CODE INTERNATIONAL ドレスコードインターナショナル",
  "tricot COMME des GARCONS コムデギャルソン トリコット",
  "Alexander McQueen アレキサンダー・マックイーン",
  "Royal State",
  "madam keiko",
  "belle vintage ベルヴィンテージ LA BELLE ETUDE",
  "Traditional Weatherwear トラディショナルウェザーウェア",
  "Ungrid アングリッド",
  "CLANE クラネ",
  "REKISAMI レキサミ",
  "45R フォーティファイブアール",
  "HILTON ヒルトン",
  "1er Arrondissement プルミエ アロンディスモン",
  "BIANCA EPOCA ビアンカエポカ",
  "LEVI STRAUSS & CO リーバイス",
  "UNIQLO ジルサンダーコラボ",
  "Priority&TOLNERA トルネラ",
  "efla エフラ",
  "youk shim won ユクシムウォン",
  "FRAPBOIS フラボア",
  "ZIN KATO ジンカトウ",
  "MITSUKOSHI ミツコシ",
  "ef-de LA ROBE エフデラローブ",
  "YUMA KOSHINO ユマ コシノ",
  "VIKTOR&ROLF ヴィクター＆ロルフ",
  "3500",
  "la bastide des lourmarin ルールマラン",
  "MURUA ムルーア Champion チャンピオン",
  "TELA テラ",
  "Joël Robuchon gelato pique ジョエルロブション ジェラートピケ",
  "KZOOM MADE",
  "MODA MODE",
  "ZARA MAN ザラマン",
  "Inka Tradition",
  "In The Attic インジアティック",
  "hitoiro SOIR ヒトイロ ソワール",
  "PLAIN PEOPLE プレインピープル",
  "RAY CASSIN レイカズン",
  "NAUTICA ノーティカ",
  "Deuxieme Classe ドゥーズィエム クラス",
  "Champs de Mars シャンドマルス",
  "Semicouture セミクチュール",
  "NOVESPAZIO ノーベスパジオ",
  "montbell モンベル",
  "LESOUK ルスーク",
  "Stone Island ストーンアイランド",
  "The Virgnia ザ ヴァージニア",
  "MATTHEW WILLIAMSON マシューウィリアムソン",
  "A.P.C. アーペーセー",
  "Matthew Williamson マシューウィリアムソン",
  "RIVE DROITE リヴドロワ",
  "なめ猫 なめねこ",
  "NORC ノーク",
  "AMERICAN HOLIC アメリカンホリック",
  "Aveniretoileアベニールエトワール",
  "MUNSINGWEAR マンシングウェア",
  "cocoon コクーン",
  "pageboy ページボーイ",
  "SpRay PREMIUM スプレイプレミアム",
  "VICKY ビッキー",
  "earth music&ecology アース ミュージック＆エコロジー",
  "MAYSON GREY メイソングレイ",
  "ANNE KLEIN アンクライン",
  "FRAY I.D フレイ アイディー",
  "CARA O CRUZ キャラオクルス JOE'S ジョーズ",
  "LOEWE ロエベ",
  "TITE in the store ティテインザストア",
  "Fabiana Filippi ファビアナ・フィリッピ",
  "ARMANI EXCHANGE アルマーニエクスチェンジ",
  "IVISUTO イヴィスト",
  "CIAOPANIC TYPY チャオパニックティピー",
  "Patagonia パタゴニア",
  "伊太利屋 ITALIYA",
  "Leilian CESSILCROSSO レリアン",
  "KOBE LETTUCE コウベレタス",
  "トラサルディ ジーンズ TRUSSARDI JEANS",
  "Desert Rose デザートローズ",
  "willfully ウィルフリー",
  "aquagirl アクアガール",
  "Stola ストラ",
  "KENZO GOLF ケンゾーゴルフ",
  "RITSUKO SHIRAHAMA リツコシラハマ",
  "ユキコハナイ YUKIKO HANAI ハナイアンドコー HANAI&CO",
  "GIVENCHY Like ジバンシィ ライク",
  "Theory luxe セオリーリュクス／定価24,000円",
  "KETY ケティ",
  "POLO JEANS CO. ポロジーンズカンパニー",
  "HIROKO BIS ヒロコ ビス",
  "RULE bis ルール ビス",
  "SOMETHING サムシング *inedを中心としたセレクトショップ”SUPERIORCLOSET”と女性のためのデニムブランド”SOMETHING”のスタイリスト冨張愛さんのトリプルコラボデニム（定価：20,900円）",
  "Genny ジェニー",
  "ヴィンテージ 55 Vintage 55",
  "MANGO マンゴ",
  "SENSE OF PLACE センス オブ プレイス",
  "N.Natural Beauty Basic エヌ ナチュラルビューティーベーシック",
  "PARC LAMU パルクラミュー",
  "yuni ユニ",
  "LA MARINE FRANCAISE マリン フランセーズ ／定価21,800円",
  "traduire トラデュイール",
  "JEANASIS ジーナシス",
  "le coq sportif ルコックスポルティフ",
  "Cappellini カッペリーニ",
  "fifth フィフス",
  "Lee リー",
  "DES PRÉS デ プレ",
  "Solace ソレイス",
  "Weekend Max Mara マックスマーラ ウィークエンド",
  "LILIPETRUS リリペトラス",
  "SALA ABITO",
  "options",
  "UNIQLO×Theory ユニクロ×セオリー",
  "apart by lowrys アパートバイローリーズ",
  "TOMMY JEANS トミー ジーンズ",
  "TOMMY JEANS トミージーンズ",
  "DOLLY GIRL BY ANNA SUI ドーリーガール バイ アナスイ",
  "JILL STUART ジル スチュアート 定価23,000円",
  "SOIR PERLE ソワール ペルル",
  "SLOBE IENA スローブ イエナ",
  "zara ザラ",
  "DES PRÉS デ・プレ",
  "PAOLA FRANI パオラフラーニ",
  "PUNYUS プニュズ",
  "HARE ハレ",
  "Titilate Valet ティティレートヴァレット",
  "LUREM ルアム",
  "Levi's リーバイス",
  "D&G DOLCE&GABBANA ドルチェ&ガッバーナ",
  "UNSPECK アンスペック",
  "Andemiu アンデミュウ",
  "URBAN RESEARCH ROSSO アーバンリサーチ ロッソ",
  "PILGRIM TOMORROWLAND ピルグリム トゥモローランド",
  "J.PRESS ジェイプレス",
  "WILLSELECTION ウィルセレクション",
  "Christian Dior SPORTS クリスチャンディオールスポーツ",
  "PS Paul Smith ピーエスポールスミス",
  "Blumarine ブルマリン",
  "LANVIN TRADITION ランバン",
  "GRACE CLASS グレースクラス",
  "madame hanai hanai&co",
  "Deux cle ドゥクレ",
  "enLINE by nozomi",
  "SUGAR CANE シュガーケーン",
  "rag & bone ラグアンドボーン",
  "K.T LINO キヨコ タカセ",
  "CIVIDINI チヴィディーニ",
  "LAISSE PASSE レッセ パッセ",
  "尾道デニム ONOMICHI DENIM PROJECT",
  "Cafetty カフェッティ",
  "TODAYFUL トゥデイフル",
  "Comme des Garcons コムデギャルソン",
  "maggy マギー 銀座マギー",
  "HÉLIOPÔLE エリオポール",
  "ALLSAINTS オールセインツ",
  "REDPEPPER レッドペッパー",
  "pas de calais パドカレ",
  "PUMA プーマ",
  "CoCoJANE ココジェーン",
  "STRASBURGO ストラスブルゴ",
  "FRANCO FERRARO Milano フランコフェラーロ",
  "DRESSTERIOR ドレステリア",
  "49av JUNKO SHIMADA ジュンコ シマダ",
  "FORDMILLS フォードミルズ",
  "DOUBLE STANDARD CLOTHING ダブルスタンダードクロージング",
  "Polo by Ralph Lauren ポロバイラルフローレン",
  "B-THREE ビースリー",
  "sab street サブストリート",
  "GRAND FATHER グランドファザー",
  "Ungarofever ウンガロフィーバー",
  "SPORTMAX スポーツマックス",
  "Swingle スウィングル",
  "O'2nd オッズセカンド",
  "Yorkland ヨークランド",
  "Jack Bunny!! ジャックバニー",
  "EMPORIO ARMANI エンポリオアルマーニ",
  "MU SPORTS エムユースポーツ",
  "MACKINTOSH LONDON マッキントッシュ ロンドン",
  "torrazzo donna トラッゾドンナ",
  "Mila Owen ミラオーウェン",
  "ALBERTA FERRETTI アルベルタフェレッティ",
  "COGTHEBIGSMOKE コグザビッグスモーク",
];

const CSV_HEADERS = ['種類', '品番', 'ブランド', '色', 'サイズ表記', '価格', 'タイトル', '着丈', '身幅', '肩幅', '袖丈', 'ウエスト', 'ウエスト最大', 'わたり幅', '股上', '股下', 'ヒップ'];
const MEASURE_KEY_MAP = [
  ['着丈', 'kitake'],
  ['身幅', 'mihaba'],
  ['肩幅', 'kataha'],
  ['袖丈', 'sodetake'],
  ['ウエスト', 'waist'],
  ['ウエスト最大', 'waistMax'],
  ['わたり幅', 'watarihaba'],
  ['股上', 'matoue'],
  ['股下', 'matashita'],
  ['ヒップ', 'hip'],
];

// CSVエクスポート専用の列（種類コード・番号・品番・販売価格・ブランド・色・サイズ・タイトル・詳細）
const CSV_EXPORT_HEADERS = ['種類', '番号', '品番', '販売価格', 'ブランド', '色', 'サイズ', 'タイトル', '詳細'];

function entryToExportRow(entry) {
  return [
    typeCode(entry.category),
    entry.itemNo,
    fullItemNo(entry.category, entry.itemNo),
    entry.price,
    entry.brand,
    entry.color,
    entry.size,
    entry.title,
    generateDetail(entry),
  ];
}

// CSV2：自動出品貼り付け用CSVの列（商品名・商品説明・価格・フォルダ名）
const CSV_EXPORT2_HEADERS = ['商品名', '商品説明', '価格', 'フォルダ名'];

function entryToExport2Row(entry) {
  return [entry.title, generateDetail(entry), entry.price, fullItemNo(entry.category, entry.itemNo)];
}

function downloadTextFile(filename, content) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function emptyForm(category) {
  return {
    category,
    itemNo: '',
    brand: '',
    color: '',
    size: '',
    price: '',
    title: '',
    measurements: {},
    autoPrefix: true,
    appliedPrefix: '',
  };
}

function generateDetail(entry) {
  const cfg = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG['トップス'];
  const lines = [];

  const fullNo = fullItemNo(entry.category, entry.itemNo);
  if (entry.itemNo) lines.push(fullNo);
  lines.push('【アイテム詳細】');
  if (entry.brand) lines.push(`ブランド：${entry.brand}`);
  if (entry.color) lines.push(`色：${entry.color}`);
  if (entry.size) lines.push(`サイズ表記：${entry.size}`);

  const measureLines = cfg.fields
    .map((f) => {
      const v = entry.measurements ? entry.measurements[f.key] : '';
      return v ? `${f.label}：約${v}` : null;
    })
    .filter(Boolean);

  if (measureLines.length > 0) {
    lines.push('', '【実寸平置き（cm）】', ...measureLines);
  }

  return lines.join('\n');
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [form, setForm] = useState(emptyForm('トップス'));
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineForm, setInlineForm] = useState(null);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [view, setView] = useState('active');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [brandList, setBrandList] = useState([]);
  const [brandSuggestOpen, setBrandSuggestOpen] = useState(false);
  const [inlineBrandSuggestOpen, setInlineBrandSuggestOpen] = useState(false);
  const [brandManagerOpen, setBrandManagerOpen] = useState(false);
  const [brandManagerText, setBrandManagerText] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [measureVisible, setMeasureVisible] = useState({ 'トップス': true, 'パンツ': true, 'スカート': true, 'アクセサリー': true });
  const [csvMessage, setCsvMessage] = useState(null);
  const [formError, setFormError] = useState('');
  const [inlineError, setInlineError] = useState('');
  const csvInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get('items');
        if (res && res.value) setItems(JSON.parse(res.value));
      } catch (e) {
        // 初回はキーが存在しないためエラーになる場合がある
      }
      try {
        const res2 = await storage.get('measureVisibility');
        if (res2 && res2.value) setMeasureVisible((prev) => ({ ...prev, ...JSON.parse(res2.value) }));
      } catch (e) {
        // 初回は未設定
      }
      try {
        const res3 = await storage.get('brandList');
        if (res3 && res3.value) setBrandList(JSON.parse(res3.value));
      } catch (e) {
        // 初回は未設定
      }
      setLoaded(true);
    })();
  }, []);

  function saveBrandList(next) {
    setBrandList(next);
    (async () => {
      try {
        await storage.set('brandList', JSON.stringify(next));
      } catch (e) {
        // 保存できなくても候補表示は有効のまま
      }
    })();
  }

  function openBrandManager() {
    setBrandManagerText(brandList.join('\n'));
    setBrandManagerOpen(true);
  }

  function saveBrandManager() {
    const next = Array.from(
      new Set(
        brandManagerText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    saveBrandList(next);
    setBrandManagerOpen(false);
  }

  function toggleMeasureVisible(cat) {
    setMeasureVisible((prev) => {
      const next = { ...prev, [cat]: !prev[cat] };
      (async () => {
        try {
          await storage.set('measureVisibility', JSON.stringify(next));
        } catch (e) {
          // 保存できなくても表示切り替えは有効のまま
        }
      })();
      return next;
    });
  }

  async function persist(next) {
    setItems(next);
    try {
      const res = await storage.set('items', JSON.stringify(next));
      if (!res) setSaveError(true);
      else setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }

  function handleCsvImportClick() {
    if (csvInputRef.current) csvInputRef.current.click();
  }

  async function handleCsvFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });

    let added = 0;
    let skipped = 0;
    const overLength = [];
    const newItems = [];

    (parsed.data || []).forEach((row, idx) => {
      const category = CATEGORIES.find((c) => c === String(row['種類'] || '').trim());
      const itemNo = String(row['品番'] || '').trim().replace(/^(to|bt|ac)/i, '').replace(/[^0-9]/g, '');
      const brand = String(row['ブランド'] || '').trim();
      if (!category || !itemNo || !brand) {
        skipped++;
        return;
      }
      const measurements = {};
      MEASURE_KEY_MAP.forEach(([header, key]) => {
        const v = String(row[header] || '').trim().replace(/[^0-9.]/g, '');
        if (v) measurements[key] = v;
      });
      const prefix = titlePrefix(itemNo, brand);
      const rawTitle = toHalfWidthSpaces(String(row['タイトル'] || '').trim());
      const title = toHalfWidthSpaces(prefix ? (rawTitle ? `${prefix} ${rawTitle}` : prefix) : rawTitle);
      if (title.length > TITLE_MAX_LENGTH) {
        overLength.push(fullItemNo(category, itemNo));
      }
      newItems.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + idx,
        category,
        itemNo,
        brand,
        color: String(row['色'] || '').trim(),
        size: String(row['サイズ表記'] || '').trim(),
        price: String(row['価格'] || '').trim().replace(/[^0-9]/g, ''),
        title,
        measurements,
        autoPrefix: title.startsWith(prefix),
        appliedPrefix: title.startsWith(prefix) ? prefix : '',
        archived: false,
        createdAt: Date.now(),
      });
      added++;
    });

    if (newItems.length > 0) {
      await persist([...newItems, ...items]);
    }
    setCsvMessage({ added, skipped, overLength });
    setTimeout(() => setCsvMessage(null), 9000);
    e.target.value = '';
  }

  function handleDownloadTemplate() {
    const sample = [
      ['トップス', '4589', 'ガリャルダガランテ', 'キャメル', 'F', '3500', '', '78', '44', '38', '57', '', '', '', '', ''],
      ['パンツ', '861', 'サンプルブランド', 'ブラック', '2', '2800', '', '', '', '', '', '68', '76', '58', '26', '68'],
      ['スカート', '853', 'サンプルブランド', 'ネイビー', '1', '2200', '', '58', '', '', '', '64', '70', '', '', '88'],
    ];
    const csv = Papa.unparse({ fields: CSV_HEADERS, data: sample });
    downloadTextFile('出品ドラフト_テンプレート.csv', csv);
  }

  function handleExportCsv() {
    const csv = Papa.unparse({ fields: CSV_EXPORT_HEADERS, data: items.filter((i) => !i.archived).map(entryToExportRow) });
    downloadTextFile('下書き貼り付け用CSV.csv', csv);
  }

  function handleExportCsv2() {
    const csv = Papa.unparse({ fields: CSV_EXPORT2_HEADERS, data: items.filter((i) => !i.archived).map(entryToExport2Row) });
    downloadTextFile('自動出品貼り付け用CSV.csv', csv);
  }

  function handleCategoryChange(cat) {
    setForm((prev) => ({ ...prev, category: cat, measurements: {} }));
  }

  function handleField(key, value) {
    setForm((prev) => {
      let v = value;
      if (key === 'title') v = toHalfWidthSpaces(v);
      const next = { ...prev, [key]: v };
      if ((key === 'itemNo' || key === 'brand') && prev.autoPrefix) {
        const newPrefix = titlePrefix(next.itemNo, next.brand);
        let body = prev.title;
        if (prev.appliedPrefix && body.startsWith(prev.appliedPrefix)) {
          body = body.slice(prev.appliedPrefix.length).replace(/^\s+/, '');
        }
        next.title = toHalfWidthSpaces(newPrefix ? (body ? `${newPrefix} ${body}` : newPrefix) : body);
        next.appliedPrefix = newPrefix;
      }
      return next;
    });
  }

  function handleMeasure(key, value) {
    setForm((prev) => ({ ...prev, measurements: { ...prev.measurements, [key]: value } }));
  }

  function toggleAutoPrefix() {
    setForm((prev) => {
      if (prev.autoPrefix) {
        let body = prev.title;
        if (prev.appliedPrefix && body.startsWith(prev.appliedPrefix)) {
          body = body.slice(prev.appliedPrefix.length).replace(/^\s+/, '');
        }
        return { ...prev, autoPrefix: false, title: body, appliedPrefix: '' };
      }
      const newPrefix = titlePrefix(prev.itemNo, prev.brand);
      const title = toHalfWidthSpaces(newPrefix ? (prev.title ? `${newPrefix} ${prev.title}` : newPrefix) : prev.title);
      return { ...prev, autoPrefix: true, title, appliedPrefix: newPrefix };
    });
  }

  function startInlineEdit(entry) {
    setInlineEditId(entry.id);
    setInlineError('');
    setInlineForm({
      category: entry.category,
      itemNo: entry.itemNo,
      brand: entry.brand,
      color: entry.color,
      size: entry.size,
      price: entry.price,
      title: entry.title,
      measurements: entry.measurements || {},
    });
  }

  function cancelInlineEdit() {
    setInlineEditId(null);
    setInlineError('');
  }

  function handleInlineField(key, value) {
    const v = key === 'title' ? toHalfWidthSpaces(value) : value;
    setInlineForm((prev) => ({ ...prev, [key]: v }));
    if (key === 'title') setInlineError('');
  }

  function handleInlineMeasure(key, value) {
    setInlineForm((prev) => ({ ...prev, measurements: { ...prev.measurements, [key]: value } }));
  }

  function handleInlineCategoryChange(cat) {
    setInlineForm((prev) => ({ ...prev, category: cat, measurements: {} }));
  }

  function saveInlineEdit(id) {
    if (!inlineForm.itemNo.trim() || !inlineForm.brand.trim()) return;
    if (inlineForm.title.length > TITLE_MAX_LENGTH) {
      setInlineError(`タイトルが${TITLE_MAX_LENGTH}文字を超えています（現在${inlineForm.title.length}文字）。修正してください。`);
      return;
    }
    const original = items.find((i) => i.id === id);
    const updated = { ...inlineForm, id, archived: original ? !!original.archived : false, createdAt: original ? original.createdAt : Date.now() };
    persist(items.map((i) => (i.id === id ? updated : i)));
    setInlineEditId(null);
    setInlineError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.itemNo.trim() || !form.brand.trim()) return;
    if (form.title.length > TITLE_MAX_LENGTH) {
      setFormError(`タイトルが${TITLE_MAX_LENGTH}文字を超えています（現在${form.title.length}文字）。修正してください。`);
      return;
    }
    setFormError('');
    const newEntry = { ...form, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), archived: false, createdAt: Date.now() };
    persist([newEntry, ...items]);
    setForm(emptyForm(form.category));
  }

  function requestDelete(id) {
    setConfirmDeleteId(id);
  }

  function confirmDelete(id) {
    persist(items.filter((i) => i.id !== id));
    if (inlineEditId === id) setInlineEditId(null);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setConfirmDeleteId(null);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((i) => (allSelected ? next.delete(i.id) : next.add(i.id)));
      return next;
    });
  }

  function switchView(v) {
    setView(v);
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  }

  function archiveSelected() {
    if (selectedIds.size === 0) return;
    persist(items.map((i) => (selectedIds.has(i.id) ? { ...i, archived: true } : i)));
    setSelectedIds(new Set());
  }

  function requestBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleteConfirm(true);
  }

  function confirmBulkDelete() {
    persist(items.filter((i) => !selectedIds.has(i.id)));
    if (inlineEditId && selectedIds.has(inlineEditId)) setInlineEditId(null);
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  }

  function cancelBulkDelete() {
    setBulkDeleteConfirm(false);
  }

  function restoreItem(id) {
    persist(items.map((i) => (i.id === id ? { ...i, archived: false } : i)));
  }

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
    } catch (e) {
      setCopiedKey('error:' + key);
    }
    setTimeout(() => setCopiedKey(null), 1600);
  }

  const activeItems = items.filter((i) => !i.archived);
  const allBrandCandidates = Array.from(new Set([...DEFAULT_BRANDS, ...brandList, ...items.map((i) => i.brand).filter(Boolean)]));
  const brandMatches = matchBrandCandidates(form.brand, allBrandCandidates);
  const inlineBrandMatches = inlineForm ? matchBrandCandidates(inlineForm.brand, allBrandCandidates) : [];
  const archivedItems = items.filter((i) => i.archived);
  const baseList = view === 'archive' ? archivedItems : activeItems;

  const filtered = baseList.filter((i) => {
    if (!query.trim()) return true;
    const hay = [i.itemNo, fullItemNo(i.category, i.itemNo), i.brand, i.color, i.title, i.category].join(' ').toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const totalPrice = activeItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const activeCfg = CATEGORY_CONFIG[form.category];
  const previewDetail = generateDetail(form);

  return (
    <div style={{ background: COLORS.bg, minHeight: '100%', color: COLORS.ink, fontFamily: "'Noto Sans JP', sans-serif" }} className="p-6 lg:p-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap');
        .serif { font-family: 'Noto Sans JP', sans-serif; }
        .mono-num { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
        .item-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 6px;
          font-family: 'Noto Sans JP', sans-serif;
          font-weight: 700;
          font-size: 13px;
        }
        textarea, input, select { font-family: 'Noto Sans JP', sans-serif; }
        ::placeholder { color: #A7AFA6; }
      `}</style>

      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: COLORS.pine }}>
            <Tag size={18} />
            <span className="text-xs font-semibold tracking-widest uppercase">Listing Draft Tool</span>
          </div>
          <h1 className="serif text-3xl sm:text-4xl font-bold" style={{ color: COLORS.ink }}>出品ドラフト工房</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>採寸を入力すると、出品用のタイトルと詳細文をその場で組み立てます。</p>
        </div>
        <div className="flex gap-6 sm:text-right">
          <div>
            <div className="text-xs" style={{ color: COLORS.inkSoft }}>登録件数</div>
            <div className="mono-num text-2xl font-bold" style={{ color: COLORS.ink }}>{activeItems.length}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: COLORS.inkSoft }}>合計金額</div>
            <div className="mono-num text-2xl font-bold" style={{ color: COLORS.mustard }}>¥{totalPrice.toLocaleString('ja-JP')}</div>
          </div>
        </div>
      </header>

      {saveError && (
        <div className="max-w-6xl mx-auto mb-4 px-4 py-2 rounded-lg text-sm" style={{ background: COLORS.roseSoft, color: COLORS.rose, border: `1px solid ${COLORS.rose}` }}>
          ブラウザ保存に失敗しました。このセッション内では引き続き使用できますが、再読み込みするとデータが失われる可能性があります。
        </div>
      )}

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:w-96 w-full flex-shrink-0 rounded-2xl p-6"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
        >
          <h2 className="serif text-lg font-bold mb-4" style={{ color: COLORS.inkSoft }}>
            新しい商品を追加
          </h2>

          {/* カテゴリタブ */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {CATEGORIES.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const active = form.category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className="text-sm font-semibold py-2 rounded-lg transition-colors"
                  style={
                    active
                      ? { background: cfg.accent, color: '#fff' }
                      : { background: cfg.soft, color: cfg.accent }
                  }
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-1">
              <label className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>品番</label>
              <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.line}` }}>
                <span
                  className="px-2.5 py-2 text-sm font-bold select-none flex-shrink-0"
                  style={{ background: activeCfg.soft, color: activeCfg.accent }}
                >
                  {typeCode(form.category)}
                </span>
                <input
                  value={form.itemNo}
                  onChange={(e) => handleField('itemNo', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="4589"
                  inputMode="numeric"
                  className="w-full px-2.5 py-2 text-sm outline-none min-w-0"
                  required
                />
              </div>
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>価格（円）</label>
              <input
                value={form.price}
                onChange={(e) => handleField('price', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="3500"
                inputMode="numeric"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none mono-num"
                style={{ border: `1px solid ${COLORS.line}` }}
              />
            </div>
            <div className="col-span-2 relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>ブランド</label>
                <button type="button" onClick={openBrandManager} className="text-xs underline" style={{ color: COLORS.inkSoft }}>
                  候補を管理
                </button>
              </div>
              <input
                value={form.brand}
                onChange={(e) => { handleField('brand', e.target.value); setBrandSuggestOpen(true); }}
                onFocus={() => setBrandSuggestOpen(true)}
                onBlur={() => setTimeout(() => setBrandSuggestOpen(false), 150)}
                placeholder="GALLARDAGALANTE ガリャルダガランテ"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${COLORS.line}` }}
                autoComplete="off"
                required
              />
              {brandSuggestOpen && brandMatches.length > 0 && (
                <div
                  className="absolute z-10 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg"
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
                >
                  {brandMatches.map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => { handleField('brand', b); setBrandSuggestOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:opacity-70"
                      style={{ color: COLORS.ink, background: COLORS.surface }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
              {brandManagerOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 p-3 rounded-lg shadow-lg" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
                  <div className="text-xs mb-1.5" style={{ color: COLORS.inkSoft }}>ブランド候補を1行に1つ入力（予測変換に使われます）</div>
                  <textarea
                    value={brandManagerText}
                    onChange={(e) => setBrandManagerText(e.target.value)}
                    rows={6}
                    className="w-full px-2.5 py-2 rounded-lg text-sm outline-none resize-none"
                    style={{ border: `1px solid ${COLORS.line}` }}
                    placeholder={'GALLARDAGALANTE ガリャルダガランテ\nLeilian レリアン'}
                  />
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={saveBrandManager} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: activeCfg.accent }}>
                      保存する
                    </button>
                    <button type="button" onClick={() => setBrandManagerOpen(false)} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}>
                      閉じる
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>色</label>
              <input
                value={form.color}
                onChange={(e) => handleField('color', e.target.value)}
                placeholder="キャメル"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${COLORS.line}` }}
              />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>サイズ表記</label>
              <input
                value={form.size}
                onChange={(e) => handleField('size', e.target.value)}
                placeholder="F / 1 / 38"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${COLORS.line}` }}
              />
            </div>
          </div>

          {/* 採寸 */}
          <div className="mb-4 pt-3" style={{ borderTop: `1px solid ${COLORS.lineSoft}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>実寸平置き（cm）・{form.category}</div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: COLORS.inkSoft }}>
                <input
                  type="checkbox"
                  checked={!!measureVisible[form.category]}
                  onChange={() => toggleMeasureVisible(form.category)}
                />
                表示する
              </label>
            </div>
            {measureVisible[form.category] && (
              <div className="grid grid-cols-2 gap-3">
                {activeCfg.fields.map((f) => (
                  <div key={f.key}>
                    <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>{f.label}</label>
                    <input
                      value={form.measurements[f.key] || ''}
                      onChange={(e) => handleMeasure(f.key, e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none mono-num"
                      style={{ border: `1px solid ${COLORS.line}` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* タイトル */}
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>タイトル</label>
            <button type="button" onClick={toggleAutoPrefix} className="block text-xs underline mb-1 text-left" style={{ color: COLORS.inkSoft }}>
              {form.autoPrefix ? '品番＋ブランドを含めない' : '品番＋ブランドを挿入する'}
            </button>
            <textarea
              value={form.title}
              onChange={(e) => { handleField('title', e.target.value); setFormError(''); }}
              placeholder="4589 ガリャルダガランテ リブニット Vネック 長袖 ブラウン シンプル"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ border: `1px solid ${form.title.length > TITLE_MAX_LENGTH ? COLORS.danger : COLORS.line}` }}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: form.title.length > TITLE_MAX_LENGTH ? COLORS.danger : COLORS.inkSoft }}>
                {form.title.length} / {TITLE_MAX_LENGTH}文字{form.title.length > TITLE_MAX_LENGTH ? '（超過しています）' : ''}
              </span>
            </div>
            {formError && (
              <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: COLORS.danger }}>
                <AlertTriangle size={13} /> {formError}
              </div>
            )}
          </div>

          {/* 詳細プレビュー */}
          <div className="mb-5">
            <label className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>詳細文プレビュー（自動生成）</label>
            <pre
              className="w-full px-3 py-2 rounded-lg text-xs whitespace-pre-wrap"
              style={{ border: `1px dashed ${COLORS.line}`, background: COLORS.bg, color: COLORS.inkSoft, minHeight: '96px' }}
            >
              {previewDetail}
            </pre>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-lg text-white"
              style={{ background: activeCfg.accent }}
            >
              <Plus size={15} />
              追加する
            </button>
          </div>
        </form>

        {/* List */}
        <div className="flex-1 w-full">
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => switchView('active')}
              className="flex-1 text-sm font-semibold py-2 rounded-lg transition-colors"
              style={view === 'active' ? { background: COLORS.ink, color: '#fff' } : { background: COLORS.surface, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}
            >
              アクティブ（{activeItems.length}）
            </button>
            <button
              type="button"
              onClick={() => switchView('archive')}
              className="flex-1 text-sm font-semibold py-2 rounded-lg transition-colors"
              style={view === 'archive' ? { background: COLORS.ink, color: '#fff' } : { background: COLORS.surface, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}
            >
              <Archive size={14} className="inline mr-1 -mt-0.5" />
              アーカイブ（{archivedItems.length}）
            </button>
          </div>

          {view === 'active' && (
            <div className="flex flex-wrap gap-2 mb-3">
              <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCsvFile} style={{ display: 'none' }} />
              <button
                type="button"
                onClick={handleCsvImportClick}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                style={{ background: COLORS.pine }}
              >
                <Upload size={14} /> CSVで一括登録
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft, background: COLORS.surface }}
              >
                <Download size={14} /> テンプレートDL
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft, background: COLORS.surface }}
              >
                <Download size={14} /> 下書き貼り付け用CSV
              </button>
              <button
                type="button"
                onClick={handleExportCsv2}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft, background: COLORS.surface }}
              >
                <Download size={14} /> 自動出品貼り付け用CSV
              </button>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex items-center flex-wrap gap-3 mb-3 px-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: COLORS.inkSoft }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                すべて選択
              </label>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs" style={{ color: COLORS.inkSoft }}>{selectedIds.size}件選択中</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {view === 'active' && (
                      <button
                        type="button"
                        onClick={archiveSelected}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                        style={{ background: COLORS.mustard }}
                      >
                        <Archive size={14} /> アーカイブ
                      </button>
                    )}
                    {bulkDeleteConfirm ? (
                      <>
                        <button
                          type="button"
                          onClick={confirmBulkDelete}
                          className="text-xs font-semibold px-3 py-2 rounded-lg text-white"
                          style={{ background: COLORS.danger }}
                        >
                          本当に削除する（{selectedIds.size}件）
                        </button>
                        <button
                          type="button"
                          onClick={cancelBulkDelete}
                          className="px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={requestBulkDelete}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                        style={{ background: COLORS.danger }}
                      >
                        <Trash2 size={14} /> 削除
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {csvMessage && (
            <div
              className="text-xs mb-3 px-3 py-2.5 rounded-lg"
              style={
                csvMessage.added === 0
                  ? { background: COLORS.roseSoft, color: COLORS.danger, border: `1px solid ${COLORS.danger}` }
                  : csvMessage.skipped > 0 || csvMessage.overLength.length > 0
                  ? { background: '#FBF3E4', color: COLORS.mustard, border: `1px solid ${COLORS.mustard}` }
                  : { background: COLORS.pineSoft, color: COLORS.pine }
              }
            >
              {csvMessage.added === 0 ? (
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>登録できる行がありませんでした。種類（トップス/パンツ/スカート/アクセサリー）・品番・ブランドが入力されているか確認してください。</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div>{csvMessage.added}件を登録しました。</div>
                  {csvMessage.skipped > 0 && (
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{csvMessage.skipped}件はスキップしました（種類・品番・ブランドのいずれかが未入力または不正です）。</span>
                    </div>
                  )}
                  {csvMessage.overLength.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        {csvMessage.overLength.length}件はタイトルが{TITLE_MAX_LENGTH}文字を超えています（{csvMessage.overLength.join('、')}）。登録はされていますが、一覧から編集して修正してください。
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="品番・ブランド・色・タイトルで検索"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${COLORS.line}`, background: COLORS.surface }}
            />
          </div>

          {!loaded ? (
            <div className="text-sm py-16 text-center" style={{ color: COLORS.inkSoft }}>読み込み中…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl py-16 flex flex-col items-center gap-2" style={{ background: COLORS.surface, border: `1px dashed ${COLORS.line}` }}>
              <PackageOpen size={28} style={{ color: COLORS.inkSoft }} />
              <div className="text-sm" style={{ color: COLORS.inkSoft }}>
                {baseList.length === 0
                  ? view === 'archive'
                    ? 'アーカイブされた商品はまだありません。'
                    : 'まだ商品が登録されていません。左のフォームから追加してください。'
                  : '該当する商品が見つかりません。'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((entry) => {
                const cfg = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG['トップス'];
                const isOpen = expandedId === entry.id;
                const detail = generateDetail(entry);
                const isInlineEditing = inlineEditId === entry.id;
                const inlineCfg = isInlineEditing ? CATEGORY_CONFIG[inlineForm.category] || CATEGORY_CONFIG['トップス'] : cfg;
                return (
                  <div key={entry.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${isInlineEditing ? inlineCfg.accent : COLORS.line}` }}>
                    {isInlineEditing ? (
                      <div className="p-4">
                        <div className="grid grid-cols-4 gap-1.5 mb-3">
                          {CATEGORIES.map((cat) => {
                            const c = CATEGORY_CONFIG[cat];
                            const active = inlineForm.category === cat;
                            return (
                              <button
                                type="button"
                                key={cat}
                                onClick={() => handleInlineCategoryChange(cat)}
                                className="text-xs font-semibold py-1.5 rounded-md"
                                style={active ? { background: c.accent, color: '#fff' } : { background: c.soft, color: c.accent }}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>品番</label>
                            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.line}` }}>
                              <span className="px-2 py-1.5 text-xs font-bold select-none flex-shrink-0" style={{ background: inlineCfg.soft, color: inlineCfg.accent }}>
                                {typeCode(inlineForm.category)}
                              </span>
                              <input
                                value={inlineForm.itemNo}
                                onChange={(e) => handleInlineField('itemNo', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full px-2 py-1.5 text-sm outline-none min-w-0"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>価格</label>
                            <input
                              value={inlineForm.price}
                              onChange={(e) => handleInlineField('price', e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none mono-num"
                              style={{ border: `1px solid ${COLORS.line}` }}
                            />
                          </div>
                          <div className="col-span-2 relative">
                            <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>ブランド</label>
                            <input
                              value={inlineForm.brand}
                              onChange={(e) => { handleInlineField('brand', e.target.value); setInlineBrandSuggestOpen(true); }}
                              onFocus={() => setInlineBrandSuggestOpen(true)}
                              onBlur={() => setTimeout(() => setInlineBrandSuggestOpen(false), 150)}
                              className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
                              style={{ border: `1px solid ${COLORS.line}` }}
                              autoComplete="off"
                            />
                            {inlineBrandSuggestOpen && inlineBrandMatches.length > 0 && (
                              <div
                                className="absolute z-10 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg"
                                style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
                              >
                                {inlineBrandMatches.map((b) => (
                                  <button
                                    type="button"
                                    key={b}
                                    onClick={() => { handleInlineField('brand', b); setInlineBrandSuggestOpen(false); }}
                                    className="w-full text-left px-3 py-1.5 text-sm hover:opacity-70"
                                    style={{ color: COLORS.ink, background: COLORS.surface }}
                                  >
                                    {b}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>色</label>
                            <input
                              value={inlineForm.color}
                              onChange={(e) => handleInlineField('color', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
                              style={{ border: `1px solid ${COLORS.line}` }}
                            />
                          </div>
                          <div>
                            <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>サイズ表記</label>
                            <input
                              value={inlineForm.size}
                              onChange={(e) => handleInlineField('size', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
                              style={{ border: `1px solid ${COLORS.line}` }}
                            />
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="text-xs font-semibold mb-1" style={{ color: COLORS.inkSoft }}>実寸平置き（cm）</div>
                          <div className="grid grid-cols-2 gap-2">
                            {inlineCfg.fields.map((f) => (
                              <div key={f.key}>
                                <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>{f.label}</label>
                                <input
                                  value={(inlineForm.measurements && inlineForm.measurements[f.key]) || ''}
                                  onChange={(e) => handleInlineMeasure(f.key, e.target.value.replace(/[^0-9.]/g, ''))}
                                  className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none mono-num"
                                  style={{ border: `1px solid ${COLORS.line}` }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>タイトル</label>
                          <textarea
                            value={inlineForm.title}
                            onChange={(e) => handleInlineField('title', e.target.value)}
                            rows={2}
                            className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none resize-none"
                            style={{ border: `1px solid ${inlineForm.title.length > TITLE_MAX_LENGTH ? COLORS.danger : COLORS.line}` }}
                          />
                          <div className="text-xs mt-1" style={{ color: inlineForm.title.length > TITLE_MAX_LENGTH ? COLORS.danger : COLORS.inkSoft }}>
                            {inlineForm.title.length} / {TITLE_MAX_LENGTH}文字{inlineForm.title.length > TITLE_MAX_LENGTH ? '（超過しています）' : ''}
                          </div>
                          {inlineError && (
                            <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: COLORS.danger }}>
                              <AlertTriangle size={13} /> {inlineError}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveInlineEdit(entry.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                            style={{ background: inlineCfg.accent }}
                          >
                            <Save size={13} /> 保存する
                          </button>
                          <button
                            type="button"
                            onClick={cancelInlineEdit}
                            className="px-3 py-2 rounded-lg text-xs font-medium"
                            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex items-center gap-3 px-4 py-2 cursor-pointer flex-wrap"
                          onClick={() => setExpandedId(isOpen ? null : entry.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 w-4 h-4"
                          />
                          <span className="item-badge" style={{ background: cfg.soft, color: cfg.accent }}>{entry.itemNo ? fullItemNo(entry.category, entry.itemNo) : '—'}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.soft, color: cfg.accent }}>
                            {entry.category}
                          </span>
                          <span className="serif text-sm font-bold flex-1 min-w-[120px]" style={{ color: COLORS.ink }}>{entry.brand}</span>
                          <span className="text-xs" style={{ color: COLORS.inkSoft }}>{entry.color}{entry.size ? ` / ${entry.size}` : ''}</span>
                          {(entry.title || '').length > TITLE_MAX_LENGTH && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: COLORS.roseSoft, color: COLORS.danger }}>
                              <AlertTriangle size={11} /> {TITLE_MAX_LENGTH}文字超過
                            </span>
                          )}
                          <span className="mono-num text-sm font-bold" style={{ color: COLORS.mustard }}>
                            {entry.price ? `¥${Number(entry.price).toLocaleString('ja-JP')}` : '—'}
                          </span>
                          <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                            {view === 'active' ? (
                              <button onClick={() => startInlineEdit(entry)} className="p-1.5 rounded-md hover:opacity-70" style={{ color: COLORS.inkSoft }} title="編集">
                                <Pencil size={15} />
                              </button>
                            ) : (
                              <button onClick={() => restoreItem(entry.id)} className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-md hover:opacity-70" style={{ color: COLORS.inkSoft }} title="アーカイブから戻す">
                                <RotateCcw size={14} /> 戻す
                              </button>
                            )}
                            {confirmDeleteId === entry.id ? (
                              <>
                                <button onClick={() => confirmDelete(entry.id)} className="text-xs font-semibold px-2 py-1 rounded-md text-white" style={{ background: COLORS.danger }}>
                                  削除する
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 rounded-md" style={{ color: COLORS.inkSoft }}>
                                  <X size={15} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => requestDelete(entry.id)} className="p-1.5 rounded-md hover:opacity-70" style={{ color: COLORS.inkSoft }} title="削除">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${COLORS.lineSoft}` }}>
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>タイトル</span>
                                <button
                                  onClick={() => copyText(entry.title || '', entry.id + ':title')}
                                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md"
                                  style={{ color: cfg.accent, background: cfg.soft }}
                                >
                                  {copiedKey === entry.id + ':title' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === entry.id + ':title' ? 'コピーしました' : 'コピー'}
                                </button>
                              </div>
                              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: COLORS.bg }}>{entry.title || '（未入力）'}</div>
                            </div>

                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>詳細</span>
                                <button
                                  onClick={() => copyText(detail, entry.id + ':detail')}
                                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md"
                                  style={{ color: cfg.accent, background: cfg.soft }}
                                >
                                  {copiedKey === entry.id + ':detail' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === entry.id + ':detail' ? 'コピーしました' : 'コピー'}
                                </button>
                              </div>
                              <pre className="text-xs px-3 py-2 rounded-lg whitespace-pre-wrap" style={{ background: COLORS.bg, color: COLORS.inkSoft }}>{detail}</pre>
                            </div>

                            <button
                              onClick={() => copyText(`${entry.title || ''}\n\n${detail}`, entry.id + ':both')}
                              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                              style={{ background: cfg.accent }}
                            >
                              {copiedKey === entry.id + ':both' ? <Check size={13} /> : <Copy size={13} />}
                              {copiedKey === entry.id + ':both' ? 'コピーしました' : 'タイトル＋詳細をまとめてコピー'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
