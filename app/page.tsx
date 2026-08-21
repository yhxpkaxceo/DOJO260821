// ─────────────────────────────────────────────────────────
// 学生プロジェクト台帳
//
// 見聞きした学生団体を登録し、接触の段階を進めていく画面です。
// 宣伝ページ（LP）ではありません。
//
// 画面の骨格（この形は崩さない）:
//   左メニュー（.side）＋ 上部バー（.topbar）＋ 本体（.content）
//   一覧 / 新規登録 / 設定 の3画面を view で切り替える
// ─────────────────────────────────────────────────────────
"use client";

import { useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════
//  画面の型 ── docs/03_spec.md「0. 画面の型」で決めた値
//  ⚠ 新しいCSSは書かない。app/globals.css の選択肢から選ぶこと。
// ═══════════════════════════════════════════════════════════

/** 色み。学生起業支援＝教育・サービスなので pine */
const TONE = "pine";

/** 密度。月10団体・1件が面談という重い単位なので roomy */
const DENSITY = "roomy";

/** 画面の型。「どの段階で止まっているか」が知りたいので stage */
const LAYOUT: "queue" | "stage" | "due" = "stage";

/** 数え方。数えているのは「件」ではなく話す相手＝団体 */
const UNIT = "団体";

/** 段階。左から右へ、実際の進み方の順に並べる */
const CATEGORIES = ["見つけた", "連絡した", "面談した", "伴走中"];

/** 「動きなし」と見なす日数。月10団体のペースに合わせて14日 */
const STALE_DAYS = 14;

// ═══════════════════════════════════════════════════════════

/** 1団体分のデータ（5項目） */
type Project = {
  id: string;
  team: string;     // 団体名
  stage: string;    // いまの段階
  note: string;     // メモ
  movedOn: string;  // 最後に動いた日（YYYY-MM-DD）
  settled: boolean; // 決着したか（事業化 or 見送りで、もう追わない）
};

type View = "list" | "new" | "settings";
type Filter = "open" | "done" | "all";

const KEY = "student-projects-data";
const NAME_KEY = "student-projects-appname";

/** 画面じゅうの文言。ここを直せば言葉が揃って変わる */
const TEXT = {
  sub: "どの段階で止まっているかが分かります",
  open: "進行中",
  done: "決着",
  toTo: "決着にする",
  toBack: "進行中に戻す",
  dateLabel: "最後に動いた日",
  catLabel: "いまの段階",
  stat2: `${STALE_DAYS}日以上 動きなし`,
  headOpen: "進行中",
};

/** n日前の日付 */
const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const today = () => ago(0);

/** 今日との差。0=今日、-3=3日過ぎている */
const diff = (d: string) =>
  Math.round(
    (new Date(d + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 86400000
  );

/** 最後に動いた日から何日経ったか */
const waiting = (d: string) => Math.max(0, -diff(d));

/**
 * 見本データ。すべて架空の団体名です。
 * 実在の人名・団体名・連絡先は使っていません。
 */
const SAMPLE: Project[] = [
  { id: "s01", team: "なぎさ大 高校生向け進路相談チーム", stage: "見つけた", note: "学園祭で名前だけ聞いた。代表未確認",                movedOn: ago(21), settled: false },
  { id: "s02", team: "こもれび大 学内古着リユース",       stage: "見つけた", note: "サークル発。月1回の交換会を回している",          movedOn: ago(17), settled: false },
  { id: "s03", team: "つばさ大 手話通訳の割り当て研究",   stage: "見つけた", note: "研究室発。事業化の意思があるかは未確認",          movedOn: ago(5),  settled: false },
  { id: "s04", team: "やまびこ大 農家向け出荷管理",       stage: "連絡した", note: "代表にメッセージ送付。返事待ち",                  movedOn: ago(16), settled: false },
  { id: "s05", team: "せせらぎ大 地域交通アプリチーム",   stage: "連絡した", note: "過疎地の乗合バス予約。ビジコンで賞。返事待ち",    movedOn: ago(9),  settled: false },
  { id: "s06", team: "かえで大 学食サブスク検討チーム",   stage: "連絡した", note: "生協の担当者と話したいとのこと。日程調整中",      movedOn: ago(3),  settled: false },
  { id: "s07", team: "みなと大 フードロス削減プロジェクト", stage: "面談した", note: "学食の廃棄量を可視化。代表は3年生。次は指導教員に会う", movedOn: ago(24), settled: false },
  { id: "s08", team: "ほしのき大 生協の混雑可視化",       stage: "面談した", note: "試作まで完成。学内で試験運用したいと相談あり",    movedOn: ago(11), settled: false },
  { id: "s09", team: "みどり学院大 空き教室シェア",       stage: "伴走中",   note: "事務局と調整中。規程の壁を一緒に整理している",    movedOn: ago(6),  settled: false },
  { id: "s10", team: "うみかぜ高専 ロボット教材の販売",   stage: "伴走中",   note: "小学校向けの教材キット。法人化の相談中",          movedOn: ago(2),  settled: false },
  { id: "s11", team: "ひなた大 留学生向け生活支援",       stage: "連絡した", note: "代替わりで活動停止と判明。今回は見送り",          movedOn: ago(20), settled: true  },
  { id: "s12", team: "あおば工科大 3Dプリンタ受託",       stage: "面談した", note: "受託の域を出ず、事業化の意思なし。見送り",        movedOn: ago(18), settled: true  },
  { id: "s13", team: "くすのき大 防災アプリ開発",         stage: "面談した", note: "別の支援機関に決まったとのこと",                  movedOn: ago(15), settled: true  },
  { id: "s14", team: "しらさぎ大 学内配達サービス",       stage: "伴走中",   note: "法人化まで完了。以降は定例のみ",                  movedOn: ago(13), settled: true  },
];

/** 一覧をどう束ねるか。進行中は段階ごとに束ねる */
type Group = { key: string; label: string; items: Project[] };

function grouped(list: Project[], filter: Filter): Group[] {
  if (filter === "open") {
    // CATEGORIES の順に並べ、中身が無い段階は出さない
    return CATEGORIES.map((c) => ({
      key: c,
      label: c,
      items: list.filter((i) => i.stage === c),
    })).filter((g) => g.items.length > 0);
  }
  const head = filter === "done" ? TEXT.done : "すべて";
  return [{ key: "all", label: head, items: list }];
}

/** 行の右に出す小さなバッジ。放置日数を出す */
function rowBadge(p: Project): { text: string; kind: "warn" | "danger" } | null {
  if (p.settled) return null;
  const w = waiting(p.movedOn);
  return w >= STALE_DAYS ? { text: `${w}日 動きなし`, kind: "warn" } : null;
}

export default function Home() {
  const [items, setItems] = useState<Project[]>([]);
  const [appName, setAppName] = useState("学生プロジェクト台帳");
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);

  const [form, setForm] = useState({ team: "", stage: CATEGORIES[0], note: "", movedOn: today() });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setItems(raw ? (JSON.parse(raw) as Project[]) : SAMPLE);
      const n = localStorage.getItem(NAME_KEY);
      if (n) setAppName(n);
    } catch {
      setItems(SAMPLE);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(KEY, JSON.stringify(items));
    localStorage.setItem(NAME_KEY, appName);
  }, [items, appName, loaded]);

  // 見本データのまま触っていない状態か（1団体でも足す・消すと false になる）
  const isSample = items.length === SAMPLE.length && items.every((i) => i.id.startsWith("s"));

  const counts = useMemo(
    () => ({
      open: items.filter((i) => !i.settled).length,
      done: items.filter((i) => i.settled).length,
      all: items.length,
    }),
    [items]
  );

  /** 動きが止まっている団体の数 */
  const attention = useMemo(
    () => items.filter((i) => !i.settled && waiting(i.movedOn) >= STALE_DAYS).length,
    [items]
  );

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items
      .filter((i) => (filter === "all" ? true : filter === "open" ? !i.settled : i.settled))
      .filter((i) => !k || (i.team + i.note + i.stage).toLowerCase().includes(k))
      .sort((a, b) => a.movedOn.localeCompare(b.movedOn));
  }, [items, filter, q]);

  const groups = useMemo(() => grouped(shown, filter), [shown, filter]);

  function resetForm() {
    setForm({ team: "", stage: CATEGORIES[0], note: "", movedOn: today() });
    setEditing(null);
  }

  function save() {
    const team = form.team.trim();
    if (!team) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form, team } : i)));
    } else {
      setItems([...items, { id: String(Date.now()), ...form, team, settled: false }]);
    }
    resetForm();
    setView("list");
  }

  function startEdit(p: Project) {
    setEditing(p);
    setForm({ team: p.team, stage: p.stage, note: p.note, movedOn: p.movedOn });
    setView("new");
  }

  const toggle = (id: string) =>
    setItems(items.map((i) => (i.id === id ? { ...i, settled: !i.settled } : i)));
  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));

  const NAV: { k: View; label: string; count?: number }[] = [
    { k: "list", label: "一覧", count: counts.open },
    { k: "new", label: "新規登録" },
    { k: "settings", label: "設定" },
  ];

  const titles: { [K in View]: [string, string] } = {
    list: ["一覧", TEXT.sub],
    new: [editing ? "編集" : "新規登録", "入力して保存すると、一覧に追加されます"],
    settings: ["設定", "表示名の変更と、データの初期化"],
  };

  return (
    <div className="shell" data-tone={TONE} data-density={DENSITY}>
      {/* ───────── 左メニュー ───────── */}
      <nav className="side">
        <div className="side-brand">
          <div className="n">{appName}</div>
          <div className="s">この端末に保存</div>
        </div>
        <div className="side-label">メニュー</div>
        <div className="side-nav">
          {NAV.map((n) => (
            <button
              key={n.k}
              className="side-item"
              aria-current={view === n.k ? "page" : undefined}
              onClick={() => { if (n.k !== "new") resetForm(); setView(n.k); }}
            >
              {n.label}
              {typeof n.count === "number" && <span className="c">{n.count}</span>}
            </button>
          ))}
        </div>
        <div className="side-foot">記録した団体 {counts.all} {UNIT}</div>
      </nav>

      {/* ───────── 本体 ───────── */}
      <div className="main">
        <header className="topbar">
          <span className="t">{titles[view][0]}</span>
          <span className="d">{titles[view][1]}</span>
          {view === "list" && (
            <span className="right">
              <button className="btn" onClick={() => { resetForm(); setView("new"); }}>新規登録</button>
            </span>
          )}
        </header>

        <div className="content">
          {/* ── 一覧 ── */}
          {view === "list" && (
            <>
              {isSample && (
                <div className="notice">
                  表示中のデータは<b>見本</b>です。そのまま触って試せます。
                  消したいときは、左メニューの<b>設定</b>から。
                </div>
              )}

              <div className="stats">
                <div className="stat"><div className="n accent">{counts.open}</div><div className="l">{TEXT.open}</div></div>
                <div className="stat"><div className="n">{attention}</div><div className="l">{TEXT.stat2}</div></div>
                <div className="stat"><div className="n">{counts.all}</div><div className="l">全{UNIT}</div></div>
              </div>

              <div className="filters">
                <div className="search">
                  <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="団体名・メモで検索" />
                </div>
                <div className="seg">
                  {(["open", "done", "all"] as Filter[]).map((f) => (
                    <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                      {f === "open" ? `${TEXT.open} ${counts.open}`
                        : f === "done" ? `${TEXT.done} ${counts.done}`
                        : `全部 ${counts.all}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="list">
                {shown.length === 0 ? (
                  <>
                    <div className="list-head">
                      {filter === "open" ? TEXT.headOpen : filter === "done" ? TEXT.done : "すべて"}
                      <span className="count">0 {UNIT}</span>
                    </div>
                    <div className="empty">
                      <div className="t">{q ? "見つかりませんでした" : "ここに表示するものがありません"}</div>
                      <div className="d">
                        {q ? "検索の言葉を変えてみてください。" : "右上の「新規登録」から追加できます。"}
                      </div>
                    </div>
                  </>
                ) : (
                  groups.map((g) => (
                    <div key={g.key}>
                      <div className="group-head">
                        {g.label}
                        <span className="count">{g.items.length} {UNIT}</span>
                      </div>
                      {g.items.map((p) => {
                        const b = rowBadge(p);
                        return (
                          <div className="row" key={p.id}>
                            <div className="row-main">
                              <div className="row-title">{p.team}</div>
                              {p.note && <div className="row-sub">{p.note}</div>}
                            </div>
                            <div className="row-meta">
                              {b && <span className={`badge badge-${b.kind}`}>{b.text}</span>}
                              {filter !== "open" && <span className="badge">{p.stage}</span>}
                              <span className="row-time">{p.movedOn.slice(5).replace("-", "/")}</span>
                              <button className="btn-ghost" onClick={() => startEdit(p)}>編集</button>
                              <button className="btn-ghost" onClick={() => toggle(p.id)}>
                                {p.settled ? TEXT.toBack : TEXT.toTo}
                              </button>
                              <button className="btn-ghost danger-btn" onClick={() => remove(p.id)}>削除</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              <p className="note">データはこの端末のブラウザにだけ保存されます。外部には送信されません。</p>
            </>
          )}

          {/* ── 新規登録・編集 ── */}
          {view === "new" && (
            <div className="panel">
              <div className="form-row">
                <label className="label" htmlFor="f-team">団体名<span className="req">必須</span></label>
                <input id="f-team" className="field" value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="例：みなと大 フードロス削減プロジェクト" />
                <span className="hint">あとで見て、どの団体か分かる書き方にします</span>
              </div>

              <div className="form-row">
                <div className="inline">
                  <div>
                    <label className="label" htmlFor="f-stage">{TEXT.catLabel}</label>
                    <select id="f-stage" className="select" value={form.stage}
                      onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="f-date">{TEXT.dateLabel}</label>
                    <input id="f-date" className="field" type="date" value={form.movedOn}
                      onChange={(e) => setForm({ ...form, movedOn: e.target.value })} />
                  </div>
                </div>
                <span className="hint">
                  段階を進めたら、{TEXT.dateLabel}も今日に更新すると、放置に気づけます
                </span>
              </div>

              <div className="form-row">
                <label className="label" htmlFor="f-note">メモ</label>
                <textarea id="f-note" className="field" value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="何をしている団体か・代表・次の一手" />
              </div>

              <div className="form-actions">
                <button className="btn" onClick={save} disabled={!form.team.trim()}>
                  {editing ? "保存する" : "一覧に追加"}
                </button>
                <button className="btn-ghost" onClick={() => { resetForm(); setView("list"); }}>やめる</button>
                <span className="spacer" />
                {editing && (
                  <button className="btn-ghost danger-btn"
                    onClick={() => { remove(editing.id); resetForm(); setView("list"); }}>
                    この1{UNIT}を削除
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 設定 ── */}
          {view === "settings" && (
            <div className="panel">
              <div className="form-row">
                <label className="label" htmlFor="f-app">画面の表示名</label>
                <input id="f-app" className="field" value={appName}
                  onChange={(e) => setAppName(e.target.value)} />
                <span className="hint">左上に表示されます。変えるとすぐ反映されます</span>
              </div>

              <div className="form-row">
                <label className="label">データ</label>
                <div className="inline">
                  <button className="btn-ghost" onClick={() => setItems(SAMPLE)}>見本データを入れ直す</button>
                  <button className="btn-ghost danger-btn"
                    onClick={() => { if (confirm("全部消します。よろしいですか？")) setItems([]); }}>
                    全部消す
                  </button>
                </div>
                <span className="hint">
                  現在 {counts.all} {UNIT}（{TEXT.open} {counts.open} / {TEXT.done} {counts.done}）
                </span>
              </div>

              <p className="note">
                データはこの端末のブラウザにだけ保存されます。
                別の端末や他の人とは共有されません。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
