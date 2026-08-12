import { useState, useEffect, useRef } from 'react';
import { Copy, Pencil, Trash2, Plus, Search, Check, X, Tag, PackageOpen, Save, Upload, Download, AlertTriangle } from 'lucide-react';
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

  lines.push('', '※');
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
      setLoaded(true);
    })();
  }, []);

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
    const csv = Papa.unparse({ fields: CSV_EXPORT_HEADERS, data: items.map(entryToExportRow) });
    downloadTextFile('出品ドラフト_一覧.csv', csv);
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
    const updated = { ...inlineForm, id, createdAt: original ? original.createdAt : Date.now() };
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
    const newEntry = { ...form, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), createdAt: Date.now() };
    persist([newEntry, ...items]);
    setForm(emptyForm(form.category));
  }

  function requestDelete(id) {
    setConfirmDeleteId(id);
  }

  function confirmDelete(id) {
    persist(items.filter((i) => i.id !== id));
    if (inlineEditId === id) setInlineEditId(null);
    setConfirmDeleteId(null);
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

  const filtered = items.filter((i) => {
    if (!query.trim()) return true;
    const hay = [i.itemNo, fullItemNo(i.category, i.itemNo), i.brand, i.color, i.title, i.category].join(' ').toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const totalPrice = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const activeCfg = CATEGORY_CONFIG[form.category];
  const previewDetail = generateDetail(form);

  return (
    <div style={{ background: COLORS.bg, minHeight: '100%', color: COLORS.ink, fontFamily: "'Noto Sans JP', sans-serif" }} className="p-6 lg:p-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        .serif { font-family: 'Shippori Mincho', serif; }
        .mono-num { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
        .tag-badge {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 3px 12px 3px 18px;
          border: 1.5px dashed currentColor;
          border-radius: 3px 10px 10px 3px;
          font-family: 'Shippori Mincho', serif;
          font-weight: 700;
          font-size: 13px;
        }
        .tag-badge::before {
          content: '';
          position: absolute;
          left: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${COLORS.bg};
          border: 1.5px solid currentColor;
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
            <div className="mono-num text-2xl font-bold" style={{ color: COLORS.ink }}>{items.length}</div>
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
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>ブランド</label>
              <input
                value={form.brand}
                onChange={(e) => handleField('brand', e.target.value)}
                placeholder="GALLARDAGALANTE ガリャルダガランテ"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${COLORS.line}` }}
                required
              />
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
              <Download size={14} /> CSVエクスポート
            </button>
          </div>

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
                {items.length === 0 ? 'まだ商品が登録されていません。左のフォームから追加してください。' : '該当する商品が見つかりません。'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
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
                          <div className="col-span-2">
                            <label className="text-xs block mb-1" style={{ color: COLORS.inkSoft }}>ブランド</label>
                            <input
                              value={inlineForm.brand}
                              onChange={(e) => handleInlineField('brand', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
                              style={{ border: `1px solid ${COLORS.line}` }}
                            />
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
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer flex-wrap"
                          onClick={() => setExpandedId(isOpen ? null : entry.id)}
                        >
                          <span className="tag-badge" style={{ color: cfg.accent }}>{entry.itemNo ? fullItemNo(entry.category, entry.itemNo) : '—'}</span>
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
                            <button onClick={() => startInlineEdit(entry)} className="p-1.5 rounded-md hover:opacity-70" style={{ color: COLORS.inkSoft }} title="編集">
                              <Pencil size={15} />
                            </button>
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
