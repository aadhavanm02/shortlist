import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, updateProfile } from '../lib/store.js';
import { fetchFeed, setJobStatus, pruneSkipped } from '../lib/jobs.js';
import { TopBar, Icon, Banner, Empty, Score, Skeleton, Toggle, useToast, useMobile, Avatar, Modal } from '../components/ui.jsx';

function JobCard({ j, extra, dim, mobile, isNew }) {
  if (mobile) return (
    <a className={`job ${dim ? 'dim' : ''}`} href={`#/job/${j.id}`}>
      <div className="col" style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <div className="row" style={{ gap: 8 }}>{isNew ? <span className="chip acc" style={{ padding: '2px 8px', fontSize: 12 }}>New</span> : null}<span className="t">{j.title}</span>{j.dream ? <span className="chip blue">Dream company</span> : null}</div>
        <span style={{ fontSize: 14 }}>{j.company} · {j.location} · {j.mode}</span>
        <div className="meta"><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{j.salary}</span>{j.expText ? <span>{j.expText}</span> : null}{j.ago ? <span>{j.ago}</span> : null}</div>
        {extra}
      </div>
      <Score n={j.score} />
    </a>
  );
  return (
    <a className={`job ${dim ? 'dim' : ''}`} href={`#/job/${j.id}`}>
      <div className="logo-sq">{(j.company || '?')[0]}</div>
      <div className="col" style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <div className="row" style={{ gap: 8 }}>{isNew ? <span className="chip acc" style={{ padding: '2px 8px', fontSize: 12 }}>New</span> : null}<span className="t">{j.title}</span>{j.dream ? <span className="chip blue">Dream company</span> : null}</div>
        <span style={{ fontSize: 14 }}>{j.company} · {j.location} · {j.mode}</span>
        <div className="meta"><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{j.salary}</span>{j.expText ? <span>{j.expText}</span> : null}{j.ago ? <span>{j.ago}</span> : null}<span>via {j.source}</span></div>
        {extra}
      </div>
      <Score n={j.score} big />
    </a>
  );
}

export default function Jobs({ pid, route, tab }) {
  const p = useStore((s) => s.profiles[pid]);
  const [state, setState] = useState({ loading: false, error: null, kind: null });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('match');
  const [showFilters, setShowFilters] = useState(false);
  const [flt, setFlt] = useState({ office: true, hybrid: true, remote: true, salaryOnly: false, days: 3, src: '' });
  // Jobs you haven't seen before get a New badge and go to the top (snapshot taken when the screen opens)
  const seenAtOpen = useRef(p.seen || null);
  const isNew = (j) => !!seenAtOpen.current && !seenAtOpen.current[j.id];
  useEffect(() => {
    const ids = (p.feed?.list || []).map((j) => j.id);
    if (!ids.length) return;
    updateProfile(pid, (pp) => { const seen = { ...(pp.seen || {}) }; ids.forEach((id) => { if (!seen[id]) seen[id] = Date.now(); }); const cutoff = Date.now() - 30 * 86400000; Object.keys(seen).forEach((k) => { if (seen[k] < cutoff) delete seen[k]; }); pp.seen = seen; });
  }, [p.feed?.fetchedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [toast, showToast] = useToast();
  const mobile = useMobile();

  const load = async (force) => {
    setState({ loading: true, error: null, kind: null });
    try { await fetchFeed(pid, { force }); setState({ loading: false, error: null, kind: null }); }
    catch (e) { setState({ loading: false, error: e.message, kind: e.kind || (navigator.onLine ? 'source' : 'offline') }); }
  };
  useEffect(() => { pruneSkipped(pid); load(false); }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const feed = p.feed;
  const byStatus = (s) => Object.entries(p.status).filter(([, v]) => v.s === s).sort((a, b) => b[1].at - a[1].at).map(([id, v]) => ({ ...(p.jobCache[id] || { id, title: 'Job', company: '' }), at: v.at }));
  const newList = (feed?.list || []).filter((j) => !p.status[j.id]);
  const applied = byStatus('applied'); const skipped = byStatus('skipped');

  const filtered = useMemo(() => {
    let list = tab === 'applied' ? applied : tab === 'skipped' ? skipped : newList;
    if (q.trim()) { const t = q.toLowerCase(); list = list.filter((j) => `${j.title} ${j.company} ${j.description || ''}`.toLowerCase().includes(t)); }
    if (tab === 'new') {
      list = list.filter((j) => flt[(j.mode || 'Office').toLowerCase()] !== false);
      if (flt.salaryOnly) list = list.filter((j) => j.salMin || j.salMax);
      if (flt.days < 3) list = list.filter((j) => !j.posted || Date.now() - new Date(j.posted) < flt.days * 86400000);
      if (flt.src) list = list.filter((j) => (j.source || '').toLowerCase().includes(flt.src));
      if (sort === 'salary') list = [...list].sort((a, b) => (b.salMax || b.salMin || 0) - (a.salMax || a.salMin || 0));
      if (sort === 'new') list = [...list].sort((a, b) => new Date(b.posted || 0) - new Date(a.posted || 0));
      list = [...list].sort((a, b) => Number(isNew(b)) - Number(isNew(a)));
    }
    return list;
  }, [tab, q, flt, sort, feed, p.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = (j) => { setJobStatus(pid, j, 'skipped'); showToast(`Skipped ${j.title}`, 'Undo', () => setJobStatus(pid, j, null)); };
  const fetchedAt = feed?.fetchedAt ? new Date(feed.fetchedAt) : null;
  const isToday = feed?.date && fetchedAt && fetchedAt.toDateString() === new Date().toDateString();
  const sub = state.loading ? `Finding jobs for ${p.name}…` : feed ? `${newList.length} new ${newList.length === 1 ? 'match' : 'matches'} · ${isToday ? 'updated' : 'last updated'} ${fetchedAt.toLocaleString('en-IN', { weekday: isToday ? undefined : 'short', hour: 'numeric', minute: '2-digit' })}` : 'Jobs are fetched once a day when you open the app.';

  const tabLink = (id, label, n) => <a className={`tab ${tab === id ? 'on' : ''}`} role="tab" aria-selected={tab === id} href={`#/jobs?tab=${id}`} style={{ textDecoration: 'none' }}>{label} · {n}</a>;

  const body = (
        state.loading ? <><div className="progress" role="progressbar" aria-label="Loading jobs"><div style={{ width: '60%' }} /></div>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)}</> : (
          <>
            {state.error && state.kind === 'nokey' ? <Banner tone="info" icon="info">{state.error}</Banner> : null}
            {state.error && state.kind !== 'nokey' ? <Banner icon={state.kind === 'offline' ? 'wifi' : 'alert'} action={<button className="btn secondary sm" onClick={() => load(true)}>Retry</button>}>{state.kind === 'offline' ? "You're offline. " : "Couldn't get today's jobs. "}{feed ? 'Showing the last list we saved. ' : ''}{state.kind === 'offline' ? 'Tailoring needs internet.' : state.error}</Banner> : null}
            {feed?.notes?.length && !state.error ? <Banner tone="info" icon="info">Some sources had problems: {feed.notes.join(' · ')}. Showing what we found.</Banner> : null}

            {mobile ? null : <>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="search"><Icon n="search" s={18} c="var(--mut)" /><input aria-label="Search jobs" placeholder="Search title, company or skill" value={q} onChange={(e) => setQ(e.target.value)} />{q ? <button className="iconbtn" aria-label="Clear search" onClick={() => setQ('')}><Icon n="x" s={18} /></button> : null}</div>
              {tab === 'new' ? <>
                <label className="row small" style={{ gap: 8, flexWrap: 'nowrap' }}>Sort by<select className="select" style={{ width: 'auto', height: 46, fontWeight: 600 }} value={sort} onChange={(e) => setSort(e.target.value)}><option value="match">Best match</option><option value="salary">Highest salary</option><option value="new">Newest</option></select></label>
                <button className={`btn secondary sm ${showFilters ? 'on' : ''}`} style={{ height: 46 }} aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><Icon n="sliders" s={16} />Filters</button>
              </> : null}
            </div>
            {tab === 'new' && showFilters ? (
              <div className="card" style={{ gap: 16, boxShadow: '0 16px 40px rgba(28,26,34,.08)' }}>
                <div className="col"><span className="label">Work type</span><div className="row">{['office', 'hybrid', 'remote'].map((m) => <Toggle key={m} on={flt[m]} onClick={() => setFlt({ ...flt, [m]: !flt[m] })}>{m[0].toUpperCase() + m.slice(1)}</Toggle>)}</div></div>
                <div className="col"><span className="label">Salary</span><div className="row"><Toggle on={!flt.salaryOnly} onClick={() => setFlt({ ...flt, salaryOnly: false })}>Any</Toggle><Toggle on={flt.salaryOnly} onClick={() => setFlt({ ...flt, salaryOnly: true })}>Shows salary only</Toggle></div></div>
                <div className="col"><span className="label">Posted</span><div className="row">{[[1, 'Today'], [3, 'Last 3 days']].map(([d, l]) => <Toggle key={d} on={flt.days === d} onClick={() => setFlt({ ...flt, days: d })}>{l}</Toggle>)}</div></div>
                <div className="col"><span className="label">Source</span><div className="row">{[['', 'All'], ['linkedin', 'LinkedIn'], ['naukri', 'Naukri'], ['indeed', 'Indeed'], ['adzuna', 'Adzuna']].map(([s, l]) => <Toggle key={l} on={flt.src === s} onClick={() => setFlt({ ...flt, src: s })}>{l}</Toggle>)}</div></div>
                <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}><button className="btn ghost sm" onClick={() => setFlt({ office: true, hybrid: true, remote: true, salaryOnly: false, days: 3, src: '' })}>Reset filters</button><button className="btn sm" onClick={() => setShowFilters(false)}>Show {filtered.length} jobs</button></div>
              </div>
            ) : null}

            </>}
            {filtered.map((j) => (
              <div key={j.id} style={{ position: 'relative' }}>
                <JobCard j={j} mobile={mobile} isNew={tab === 'new' && isNew(j)} extra={tab === 'applied' ? <span className="small" style={{ color: 'var(--ok)', fontWeight: 600 }}>Applied {new Date(j.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{p.versions[j.id] ? ' · resume saved' : ''}</span> : tab === 'skipped' ? <span className="small">Skipped {new Date(j.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · disappears after 7 days</span> : null} />
                {tab === 'new' && !mobile ? <button className="iconbtn" style={{ position: 'absolute', right: 8, bottom: 8 }} aria-label={`Skip ${j.title} at ${j.company}`} title="Skip" onClick={() => skip(j)}><Icon n="x" s={18} /></button> : null}
                {tab === 'skipped' ? <button className="btn secondary sm" style={{ position: 'absolute', right: 12, bottom: 12 }} onClick={() => setJobStatus(pid, j, null)}><Icon n="undo" s={16} />Restore</button> : null}
              </div>
            ))}

            {!filtered.length && q ? <Empty title={`No jobs match “${q}”`} actions={<button className="btn secondary" onClick={() => setQ('')}>Clear search</button>}>Search only looks at this list. Try another word or clear the search.</Empty> : null}
            {!filtered.length && !q && tab === 'new' && feed && (feed.list.length ? (
              <Empty icon="check" tone="ok" title="You're all caught up" actions={<a className="btn" href="#/jobs?tab=applied">See applied jobs</a>}>You went through every job for today: {applied.filter((a) => new Date(a.at).toDateString() === new Date().toDateString()).length} applied, {skipped.filter((a) => new Date(a.at).toDateString() === new Date().toDateString()).length} skipped. New jobs arrive tomorrow.</Empty>
            ) : (
              <Empty title="No new matches today" actions={<a className="btn secondary" href="#/setup">Widen preferences</a>}>Your filters are narrow right now. Try adding a city, Remote, more job titles, or a lower minimum salary. We'll check again tomorrow.</Empty>
            ))}
            {!filtered.length && !q && tab === 'applied' ? <Empty icon="check" title="No applications yet">When you download a tailored resume and say you applied, the job moves here with the resume you sent.</Empty> : null}
            {!filtered.length && !q && tab === 'skipped' ? <Empty icon="x" title="Nothing skipped">Jobs you skip stay here for 7 days, in case you change your mind.</Empty> : null}

          </>
        )
  );

  const resetFlt = () => setFlt({ office: true, hybrid: true, remote: true, salaryOnly: false, days: 3, src: '' });
  const filterFields = (
    <>
      <div className="col"><span className="label">Work type</span><div className="row">{['office', 'hybrid', 'remote'].map((m) => <Toggle key={m} on={flt[m]} onClick={() => setFlt({ ...flt, [m]: !flt[m] })}>{m[0].toUpperCase() + m.slice(1)}</Toggle>)}</div></div>
      <div className="col"><span className="label">Salary</span><div className="row"><Toggle on={!flt.salaryOnly} onClick={() => setFlt({ ...flt, salaryOnly: false })}>Any</Toggle><Toggle on={flt.salaryOnly} onClick={() => setFlt({ ...flt, salaryOnly: true })}>Shows salary only</Toggle></div></div>
      <div className="col"><span className="label">Posted</span><div className="row">{[[1, 'Today'], [3, 'Last 3 days']].map(([d, l]) => <Toggle key={d} on={flt.days === d} onClick={() => setFlt({ ...flt, days: d })}>{l}</Toggle>)}</div></div>
    </>
  );

  if (mobile) return (
    <div className="app">
      <header className="mhead">
        <div className="between" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
          <h1>Today's jobs</h1>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <a className="avatar-btn" aria-label="Account and settings" href="#/settings"><Avatar id={pid} s={40} /></a>
          </div>
        </div>
        <div className="search" style={{ flex: 'none' }}><Icon n="search" s={18} c="var(--mut)" /><input aria-label="Search jobs" placeholder="Search title, company or skill" value={q} onChange={(e) => setQ(e.target.value)} />{q ? <button className="iconbtn" style={{ width: 36, height: 36 }} aria-label="Clear search" onClick={() => setQ('')}><Icon n="x" s={18} /></button> : null}{tab === 'new' ? <button className="iconbtn" style={{ width: 36, height: 36 }} aria-label="Filter and sort" onClick={() => setShowFilters(true)}><Icon n="sliders" s={18} /></button> : null}</div>
        <div className="tabs" role="tablist">{tabLink('new', 'New', newList.length)}{tabLink('applied', 'Applied', applied.length)}{tabLink('skipped', 'Skipped', skipped.length)}</div>
      </header>
      <main className="main" style={{ padding: '14px 16px 24px', gap: 10 }}>
        {body}
      </main>
      {showFilters ? (
        <Modal onClose={() => setShowFilters(false)} labelledBy="fs">
          <div className="between"><h2 id="fs" style={{ fontSize: 20 }}>Filter and sort</h2><button className="iconbtn" aria-label="Close" onClick={() => setShowFilters(false)}><Icon n="x" /></button></div>
          <div className="col"><span className="label">Sort by</span><div className="row">{[['match', 'Best match'], ['new', 'Newest'], ['salary', 'Highest salary']].map(([k, l]) => <Toggle key={k} on={sort === k} onClick={() => setSort(k)}>{l}</Toggle>)}</div></div>
          {filterFields}
          <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, flexWrap: 'nowrap' }}><button className="btn ghost sm" onClick={resetFlt}>Reset</button><button className="btn" style={{ flex: 1 }} onClick={() => setShowFilters(false)}>Show {filtered.length} jobs</button></div>
        </Modal>
      ) : null}
      <TopBar pid={pid} route={route} />
      {toast}
    </div>
  );

  return (
    <div className="app">
      <TopBar pid={pid} route={route} />
      <main className="main">
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div className="col" style={{ gap: 6 }}><h1 className="title">Today's jobs</h1><p className="sub">{sub}</p></div>
          <div className="row">
            <button className="btn secondary sm" onClick={() => load(true)} disabled={state.loading} title="Uses your job search quota"><Icon n="refresh" s={16} />Refresh</button>
            <a className="btn secondary sm" href="#/setup"><Icon n="sliders" s={16} />Preferences</a>
          </div>
        </div>
        <div className="tabs" role="tablist">{tabLink('new', 'New', newList.length)}{tabLink('applied', 'Applied', applied.length)}{tabLink('skipped', 'Skipped', skipped.length)}</div>

        {body}
      </main>
      {toast}
    </div>
  );
}
