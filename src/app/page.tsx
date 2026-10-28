"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Bid = { bidder: string; amount: number; at: number };
type Auction = {
  id: string; title: string; category: string; condition: string; description: string;
  emoji: string; color: string; image?: string; seller: string; start: number; increment: number;
  closes: number; bids: Bid[]; status: "live" | "pending" | "reserved" | "unsold" | "rejected" | "cancelled" | "failed_pickup" | "sold";
};
const hour = 60 * 60 * 1000;
const seed: Auction[] = [
  { id: "a1", title: "Atlas commuter cycle", category: "Cycles", condition: "Good", description: "Single speed, recently serviced. Brakes and lights working. A few scratches from daily campus rides.", emoji: "🚲", color: "mint", seller: "Aarav M.", start: 1200, increment: 100, closes: Date.now() + 2.4 * hour, bids: [{ bidder: "Nisha R.", amount: 1400, at: Date.now() - 12 * 60000 }, { bidder: "Kabir S.", amount: 1300, at: Date.now() - 25 * 60000 }], status: "live" },
  { id: "a2", title: "Casio scientific calculator", category: "Electronics", condition: "Like new", description: "FX-991EX, includes the original cover. Reset and ready for its next semester.", emoji: "🧮", color: "lavender", seller: "Rhea P.", start: 350, increment: 25, closes: Date.now() + 5.7 * hour, bids: [{ bidder: "Dev A.", amount: 400, at: Date.now() - 50 * 60000 }], status: "live" },
  { id: "a3", title: "Engineering maths bundle", category: "Books", condition: "Good", description: "Three core texts for first and second year. Some pencil notes, no missing pages.", emoji: "📚", color: "peach", seller: "Ishaan K.", start: 500, increment: 50, closes: Date.now() + 25 * 60000, bids: [], status: "live" },
  { id: "a4", title: "Desk lamp with USB port", category: "Electronics", condition: "Good", description: "Warm and cool light modes, flexible neck. Works perfectly; moving out this week.", emoji: "💡", color: "blue", seller: "Meera T.", start: 250, increment: 25, closes: Date.now() + 9 * hour, bids: [], status: "live" },
  { id: "a5", title: "Badminton racket + cover", category: "Sports", condition: "Like new", description: "Lightweight racket, used for a few games. Grip is fresh.", emoji: "🏸", color: "yellow", seller: "Arjun D.", start: 600, increment: 50, closes: Date.now() + 1.2 * hour, bids: [{ bidder: "You", amount: 700, at: Date.now() - 5 * 60000 }], status: "live" },
  { id: "a6", title: "Geography atlas & notes", category: "Books", condition: "Fair", description: "Well-loved atlas with neatly organised revision notes tucked inside.", emoji: "🗺️", color: "pink", seller: "Tara V.", start: 180, increment: 20, closes: Date.now() + 3.1 * hour, bids: [{ bidder: "You", amount: 200, at: Date.now() - 18 * 60000 }], status: "live" },
];
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const getCurrent = (a: Auction) => a.bids[0]?.amount ?? 0;
const timeLeft = (end: number, now: number) => {
  const seconds = Math.max(0, Math.floor((end - now) / 1000));
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
};

export default function Home() {
  const [auctions, setAuctions] = useState<Auction[]>(seed);
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [condition, setCondition] = useState("Any condition");
  const [priceLimit, setPriceLimit] = useState(0);
  const [sort, setSort] = useState("Ending soon");
  const [tab, setTab] = useState("Discover");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    try {
      const stored = localStorage.getItem("campus-auction-demo");
      if (stored) setAuctions(JSON.parse(stored));
      const storedSaved = localStorage.getItem("campus-auction-saved");
      if (storedSaved) setSaved(JSON.parse(storedSaved));
    } catch { /* start with sample data if browser storage is unavailable */ }
    setLoaded(true);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem("campus-auction-demo", JSON.stringify(auctions)); }, [auctions, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("campus-auction-saved", JSON.stringify(saved)); }, [saved, loaded]);
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(""), 2800); return () => window.clearTimeout(t); }, [notice]);
  useEffect(() => {
    if (!notice || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
    new Notification("RelayBid", { body: notice, icon: "/icon.svg" });
  }, [notice]);
  useEffect(() => {
    setAuctions(xs => {
      let changed = false;
      const next = xs.map(a => {
        if (a.status !== "live" || a.closes > now) return a;
        changed = true;
        return { ...a, status: a.bids.length ? "pending" as const : "unsold" as const };
      });
      return changed ? next : xs;
    });
  }, [now]);

  const active = auctions.filter(a => a.status === "live" && a.closes > now);
  const filtered = useMemo(() => {
    let list = active.filter(a => (category === "All categories" || a.category === category) && (condition === "Any condition" || a.condition === condition) && (!priceLimit || (getCurrent(a) || a.start) <= priceLimit) && `${a.title} ${a.description} ${a.category}`.toLowerCase().includes(query.toLowerCase()));
    if (tab === "My bids") list = list.filter(a => a.bids.some(b => b.bidder === "You"));
    if (tab === "Saved") list = list.filter(a => saved.includes(a.id));
    return [...list].sort((a, b) => sort === "Ending soon" ? a.closes - b.closes : sort === "Price: low to high" ? (getCurrent(a) || a.start) - (getCurrent(b) || b.start) : b.bids.length - a.bids.length);
  }, [active, category, condition, priceLimit, query, sort, tab, saved]);
  const current = auctions.find(a => a.id === selected) ?? null;
  const myListings = auctions.filter(a => a.seller === "You");

  function placeBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const amount = Number(bidAmount);
    const minimum = current.bids.length ? getCurrent(current) + current.increment : current.start;
    if (current.closes <= Date.now() || current.status !== "live") { setNotice("This auction has closed."); return; }
    if (!Number.isInteger(amount) || amount < minimum) { setNotice(`Your bid must be at least ${money(minimum)}.`); return; }
    setAuctions(xs => xs.map(a => a.id !== current.id ? a : { ...a, bids: [{ bidder: "You", amount, at: Date.now() }, ...a.bids], closes: a.closes - Date.now() <= 30000 ? Date.now() + 60000 : a.closes }));
    setBidAmount(""); setNotice("Your bid is in. Good luck!");
  }
  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    const duration = Number(f.get("duration"));
    const file = f.get("photo") as File;
    if (file?.size > 2_000_000) { setNotice("Choose a photo under 2 MB."); return; }
    const image = file?.size ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read photo")); reader.readAsDataURL(file); }) : auctions.find(a => a.id === editingId)?.image;
    const values = { title: String(f.get("title")), category: String(f.get("category")), condition: String(f.get("condition")), description: String(f.get("description")), emoji: String(f.get("emoji") || "📦"), image, start: Number(f.get("start")), increment: Number(f.get("increment")), closes: Date.now() + duration * hour };
    if (editingId) {
      setAuctions(xs => xs.map(a => a.id === editingId ? { ...a, ...values } : a));
      setNotice("Your listing has been updated.");
    } else {
      const a: Auction = { id: crypto.randomUUID(), ...values, color: "mint", seller: "You", bids: [], status: "live" };
      setAuctions(xs => [a, ...xs]); setNotice("Your item is now listed.");
    }
    setEditingId(null); setShowCreate(false); setTab("My listings");
  }
  function closeAuction(a: Auction) {
    setAuctions(xs => xs.map(item => item.id === a.id ? { ...item, status: item.bids.length ? "pending" : "unsold" } : item));
    setNotice(a.bids.length ? "Auction ended. Review the leading bid." : "Auction ended without bids; marked unsold.");
  }
  function sellerDecision(a: Auction, approved: boolean) {
    setAuctions(xs => xs.map(item => item.id === a.id ? { ...item, status: approved ? "reserved" : "rejected" } : item));
    setNotice(approved ? "Winning price approved. Item reserved for the buyer." : "Winning price rejected and recorded.");
  }
  function handover(a: Auction, successful: boolean) {
    setAuctions(xs => xs.map(item => item.id === a.id ? { ...item, status: successful ? "sold" as const : "failed_pickup" as const } : item));
    setNotice(successful ? "Handover confirmed. Sale complete." : "Failed pickup recorded.");
  }
  function cancelListing(a: Auction) {
    setAuctions(xs => xs.map(item => item.id === a.id ? { ...item, status: "cancelled" } : item)); setNotice("Listing cancellation recorded.");
  }
  function enableNotifications() {
    if (!("Notification" in window)) { setNotice("This browser does not support notifications."); return; }
    if (Notification.permission === "granted") { setNotice("Browser notifications are on."); return; }
    Notification.requestPermission().then(permission => setNotice(permission === "granted" ? "Browser notifications are on." : "Notifications are still off."));
  }

  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-mark">◎</span><span>Relay<span className="brand-light">Bid</span><small>SENIORS PASS IT ON</small></span></a>
      <div className="campus-pill"><span className="live-dot"/> North Campus <span className="chevron">⌄</span></div>
      <div className="nav-label">YOUR SPACE</div>
      <nav>{["Discover", "My bids", "Saved", "My listings"].map((name, i) => <button key={name} className={`nav-item ${tab === name ? "selected" : ""}`} onClick={() => setTab(name)}><span className="nav-icon">{["⌕", "♧", "♡", "▣"][i]}</span>{name}{name === "My bids" && <span className="nav-count">2</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="safety-card"><span className="safety-icon">✳</span><b>Good deals. Good people.</b><p>Every exchange stays on campus. Meet somewhere public and check before you trade.</p><a href="#trust">Our community pledge ↗</a></div><div className="profile"><div className="avatar">P</div><div><b>Priya Sharma</b><small>Final year · Engineering</small></div><button className="more">···</button></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">Marketplace <span>/</span> <b>{tab}</b></div><div className="top-actions"><button className="icon-button" title="Enable browser notifications" onClick={enableNotifications}>♧<i/></button><div className="top-avatar">P</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> GOOD MORNING, PRIYA</div><h1>{tab === "Discover" ? <>Find your next <em>favourite.</em></> : tab}</h1><p className="intro">Seniors pass it on. Juniors bid it forward.</p></div><button className="primary-button" onClick={() => setShowCreate(true)}><span>＋</span> List an item</button></div>
        {tab === "Discover" && <div className="hero"><div className="hero-copy"><div className="hero-kicker"><span>✳</span> THE CAMPUS PASS-ON</div><h2>Good things<br/>deserve a <i>second life.</i></h2><p>Bid on useful finds from graduating seniors and give them a new home for your next semester.</p><button onClick={() => document.getElementById("listing-grid")?.scrollIntoView({ behavior: "smooth" })}>Explore what’s here <span>↘</span></button></div><div className="hero-art"><span className="sun"/><span className="orbit o1"/><span className="orbit o2"/><div className="hero-object bike">🚲</div><div className="hero-object book">📚</div><div className="hero-object calc">🧮</div><span className="art-spark s1">✳</span><span className="art-spark s2">✦</span><div className="hero-note">passed on<br/>with love <span>↗</span></div></div><div className="hero-index">01 <span>/ 03</span></div></div>}

        <div className="section-heading" id="listing-grid"><div><div className="eyebrow section-eye">{tab === "My bids" ? "YOUR ACTIVITY" : tab === "Saved" ? "KEPT CLOSE" : tab === "My listings" ? "YOUR SELLER DESK" : "FRESH ON CAMPUS"}</div><h2>{tab === "Discover" ? "Out there, right now" : tab === "My bids" ? "Auctions you’re in" : tab === "Saved" ? "Your saved finds" : "Your listings"}<span className="result-count">{tab === "My listings" ? myListings.length : filtered.length}</span></h2></div><div className="view-toggle"><button className="active">▦</button><button>☷</button></div></div>
        <div className="filters"><label className="search-box"><span>⌕</span><input placeholder="Search for something…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><select value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option>{["Cycles", "Electronics", "Books", "Sports", "Furniture", "Other"].map(x => <option key={x}>{x}</option>)}</select><select value={condition} onChange={e => setCondition(e.target.value)}><option>Any condition</option>{["Like new", "Good", "Fair"].map(x => <option key={x}>{x}</option>)}</select><select value={priceLimit} onChange={e => setPriceLimit(Number(e.target.value))}><option value={0}>Any price</option><option value={500}>Under ₹500</option><option value={1000}>Under ₹1,000</option><option value={2000}>Under ₹2,000</option></select><select value={sort} onChange={e => setSort(e.target.value)}><option>Ending soon</option><option>Price: low to high</option><option>Most bids</option></select><button className="filter-button" onClick={() => { setCategory("All categories"); setCondition("Any condition"); setPriceLimit(0); setQuery(""); }}>↗</button></div>

        {tab === "My listings" ? <div className="seller-list">{myListings.length === 0 ? <div className="empty-state"><span>✳</span><h3>Your next good thing starts here.</h3><p>List something you no longer need and let it find its next owner.</p><button className="primary-button" onClick={() => { setEditingId(null); setShowCreate(true); }}>＋ List an item</button></div> : myListings.map(a => <div className="seller-row" key={a.id}><div className={`seller-thumb ${a.color}`} style={a.image ? { backgroundImage: `url(${a.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{a.image ? "" : a.emoji}</div><div className="seller-info"><b>{a.title}</b><span>{a.category} · {a.condition}</span></div><div className="seller-status"><small>STATUS</small><b className={`status ${a.status}`}>{a.status === "pending" ? "Needs your decision" : a.status === "reserved" ? "Reserved · arrange pickup" : a.status === "sold" ? "Sale complete" : a.status === "failed_pickup" ? "Failed pickup recorded" : a.status === "unsold" ? "Unsold" : a.status === "cancelled" ? "Seller cancelled" : a.status === "rejected" ? "Winning price rejected" : "Live auction"}</b></div><div className="seller-price"><small>LEADING BID</small><b>{a.bids.length ? money(getCurrent(a)) : "No bids yet"}</b></div><div className="seller-actions">{a.status === "pending" && <><button className="approve" onClick={() => sellerDecision(a, true)}>Approve</button><button className="decline" onClick={() => sellerDecision(a, false)}>Reject</button></>}{a.status === "reserved" && <><button className="approve" onClick={() => handover(a, true)}>Confirm pickup</button><button className="decline" onClick={() => handover(a, false)}>Failed pickup</button></>}{a.status === "live" && <>{a.bids.length === 0 && <button className="approve" onClick={() => { if (a.closes <= now) { setNotice("Closed auctions can’t be edited."); return; } setEditingId(a.id); setShowCreate(true); }}>Edit</button>}<button className="decline" onClick={() => cancelListing(a)}>Cancel</button></>}<button className="detail-link" onClick={() => setSelected(a.id)}>Details ↗</button></div></div>)}</div> : <>
          <div className="cards-grid">{filtered.map((a, i) => { const lead = getCurrent(a); const leading = a.bids[0]?.bidder === "You"; return <article className="auction-card" key={a.id} style={{ animationDelay: `${i * 55}ms` }}>
            <button className={`save-button ${saved.includes(a.id) ? "saved" : ""}`} title="Save listing" onClick={() => setSaved(xs => xs.includes(a.id) ? xs.filter(id => id !== a.id) : [...xs, a.id])}>{saved.includes(a.id) ? "♥" : "♡"}</button><button className={`card-art ${a.color}`} style={a.image ? { backgroundImage: `linear-gradient(#ffffff16,#ffffff16),url(${a.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} onClick={() => setSelected(a.id)}><span className="art-category">{a.category}</span>{!a.image && <span className="item-emoji">{a.emoji}</span>}<span className={`art-tag ${loaded && a.closes - now < hour ? "urgent" : ""}`}><i/> {loaded ? `${timeLeft(a.closes, now)} left` : "Auction timer"}</span></button>
            <div className="card-content"><div className="condition-line"><span>{a.condition.toUpperCase()}</span><span>·</span><span>BY {a.seller.toUpperCase()}</span></div><button className="card-title" onClick={() => setSelected(a.id)}>{a.title}</button><div className="price-row"><div><small>{leading ? "YOU’RE LEADING" : a.bids.length ? "CURRENT BID" : "STARTING AT"}</small><strong>{money(lead || a.start)}</strong></div><div className="bid-count"><b>{a.bids.length}</b><small>{a.bids.length === 1 ? "bid" : "bids"}</small></div></div><button className="card-cta" onClick={() => { setSelected(a.id); setBidAmount(""); }}><span>{leading ? "You’re in the lead" : "View & place a bid"}</span><span>↗</span></button></div>
          </article>; })}</div>
          {filtered.length === 0 && <div className="empty-state"><span>⌕</span><h3>Nothing here just yet.</h3><p>Try another search, or be the first to list something.</p><button className="primary-button" onClick={() => setShowCreate(true)}>＋ List an item</button></div>}
        </>}
        <footer className="footer"><span>Made for the things that find a new home.</span><span>North Campus · 2026</span></footer>
      </div>
    </section>

    {current && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}><section className="detail-modal"><button className="modal-close" onClick={() => setSelected(null)}>×</button><div className={`detail-art ${current.color}`} style={current.image ? { backgroundImage: `url(${current.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!current.image && <span>{current.emoji}</span>}<small>{current.category} · {current.condition}</small></div><div className="detail-body"><div className="eyebrow">LISTED BY {current.seller.toUpperCase()}</div><h2>{current.title}</h2><p>{current.description}</p><div className="detail-price"><div><small>{current.bids.length ? "CURRENT LEADING BID" : "STARTING PRICE"}</small><strong>{money(getCurrent(current) || current.start)}</strong></div><div className="detail-time">◷ &nbsp;{timeLeft(current.closes, now)} left</div></div><div className="bid-history-head"><b>Bid history</b><span>{current.bids.length} public {current.bids.length === 1 ? "bid" : "bids"}</span></div><div className="bid-history">{current.bids.length ? current.bids.map((b, i) => <div className="bid-row" key={`${b.at}-${i}`}><div className="mini-avatar">{b.bidder === "You" ? "P" : b.bidder[0]}</div><span>{b.bidder}{i === 0 && <small> · LEADING</small>}</span><b>{money(b.amount)}</b><time>{new Date(b.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>) : <div className="no-bids">No bids yet. Make the first one count.</div>}</div><form className="bid-form" onSubmit={placeBid}><label>Your bid <small>Minimum {money(current.bids.length ? getCurrent(current) + current.increment : current.start)}</small></label><div className="bid-input"><span>₹</span><input type="number" min={current.bids.length ? getCurrent(current) + current.increment : current.start} step="1" value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder={String(current.bids.length ? getCurrent(current) + current.increment : current.start)} required/><button type="submit">Place bid <span>↗</span></button></div></form><div className="detail-note">Bids are public. Meet on campus to complete the handover.</div></div></section></div>}

    {showCreate && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowCreate(false); setEditingId(null); } }}><form key={editingId ?? "new"} className="create-modal" onSubmit={createListing}><button type="button" className="modal-close" onClick={() => { setShowCreate(false); setEditingId(null); }}>×</button><div className="eyebrow">PASS IT ON</div><h2>{editingId ? "Edit your listing." : "List a good thing."}</h2><p className="create-intro">Give it a new home, right here on campus.</p><label>What are you selling?<input name="title" defaultValue={auctions.find(a => a.id === editingId)?.title} placeholder="e.g. Everyday commuter cycle" required maxLength={90}/></label><div className="form-two"><label>Category<select name="category" defaultValue={auctions.find(a => a.id === editingId)?.category ?? "Cycles"}>{["Cycles", "Electronics", "Books", "Sports", "Furniture", "Other"].map(x => <option key={x}>{x}</option>)}</select></label><label>Condition<select name="condition" defaultValue={auctions.find(a => a.id === editingId)?.condition ?? "Like new"}>{["Like new", "Good", "Fair"].map(x => <option key={x}>{x}</option>)}</select></label></div><label>A few details<textarea name="description" defaultValue={auctions.find(a => a.id === editingId)?.description} placeholder="Condition, what’s included, anything a buyer should know…" rows={3} required maxLength={500}/></label><label>Item photo <small>Optional · JPG, PNG, or WebP · up to 2 MB</small><input name="photo" type="file" accept="image/*"/></label><div className="form-two"><label>Starting price (₹)<input name="start" type="number" min="1" step="1" defaultValue={auctions.find(a => a.id === editingId)?.start} placeholder="500" required/></label><label>Minimum bid step (₹)<input name="increment" type="number" min="1" step="1" defaultValue={auctions.find(a => a.id === editingId)?.increment} placeholder="50" required/></label></div><div className="form-two"><label>Closes in<select name="duration">{[[1,"1 hour"],[6,"6 hours"],[12,"12 hours"],[24,"1 day"],[72,"3 days"],[168,"7 days"]].map(([n,label]) => <option value={n} key={n}>{label}</option>)}</select></label><label>Item icon<select name="emoji" defaultValue={auctions.find(a => a.id === editingId)?.emoji ?? "📦"}>{["📦","🚲","🧮","📚","💡","🏸","🪑","🎧"].map(x => <option key={x}>{x}</option>)}</select></label></div><div className="create-actions"><button type="button" className="secondary-button" onClick={() => { setShowCreate(false); setEditingId(null); }}>Cancel</button><button className="primary-button" type="submit">{editingId ? "Save changes" : "Publish listing"} <span>↗</span></button></div></form></div>}
    {notice && <div className="toast"><span>✳</span>{notice}</div>}
  </main>;
}
