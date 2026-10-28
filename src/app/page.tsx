"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";

type Bid = { bidder: string; bidderId?: string; amount: number; at: number };
type Auction = {
  id: string; title: string; category: string; condition: string; description: string;
  emoji: string; color: string; image?: string; seller: string; start: number; increment: number;
  closes: number; bids: Bid[]; status: "live" | "pending" | "reserved" | "unsold" | "rejected" | "cancelled" | "failed_pickup" | "sold";
};
type RemoteBidRow = { listing_id: string; bidder_id: string; amount: number; created_at: string; bidder: { display_name: string } | null };
type RemoteListingRow = {
  id: string; seller_id: string; title: string; category: string; condition: string; description: string;
  emoji: string; image_url: string | null; start_price: number; bid_increment: number; closes_at: string;
  status: Auction["status"]; seller: { display_name: string } | null; bids: RemoteBidRow[];
};
const colorFor = (category: string) => {
  const colors: Record<string, string> = { Cycles: "mint", Electronics: "lavender", Books: "peach", Sports: "yellow", Furniture: "blue", Other: "pink" };
  return colors[category] ?? "mint";
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
  const supabaseConfigured = Boolean(getSupabaseConfig());
  const [auctions, setAuctions] = useState<Auction[]>(seed);
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [condition, setCondition] = useState("Any condition");
  const [priceLimit, setPriceLimit] = useState(0);
  const [sort, setSort] = useState("Ending soon");
  const [tab, setTab] = useState("Discover");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const auctionsRef = useRef(auctions);
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");

  function showActivityNotification(title: string, body: string) {
    if (!notificationsEnabledRef.current || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/icon.svg" });
  }

  useEffect(() => { auctionsRef.current = auctions; }, [auctions]);
  useEffect(() => { notificationsEnabledRef.current = notificationsEnabled; }, [notificationsEnabled]);

  useEffect(() => {
    const updateTime = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (!supabaseConfigured) {
        setAuctions(xs => {
          let changed = false;
          const next = xs.map(a => {
            if (a.status !== "live" || a.closes > currentTime) return a;
            changed = true;
            return { ...a, status: a.bids.length ? "pending" as const : "unsold" as const };
          });
          return changed ? next : xs;
        });
      }
    };
    const timer = window.setInterval(updateTime, 1000);
    const initialTick = window.setTimeout(updateTime, 0);
    let loadTimer: number | undefined;
    if (!supabaseConfigured) {
      loadTimer = window.setTimeout(() => {
        try {
          const stored = localStorage.getItem("campus-auction-demo");
          if (stored) setAuctions(JSON.parse(stored));
          const storedSaved = localStorage.getItem("campus-auction-saved");
          if (storedSaved) setSaved(JSON.parse(storedSaved));
        } catch { /* start with sample data if browser storage is unavailable */ }
        setLoaded(true);
        setAuthReady(true);
      }, 0);
    }
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialTick);
      if (loadTimer !== undefined) window.clearTimeout(loadTimer);
    };
  }, [supabaseConfigured]);
  useEffect(() => {
    if (!("Notification" in window)) return;
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem("relaybid-notifications-enabled");
      setNotificationsEnabled(stored === null ? Notification.permission === "granted" : stored === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? "");
      if (!session?.user) {
        setAuctions([]);
        setSaved([]);
        setLoaded(false);
      }
      setAuthReady(true);
    });
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) setNotice("Could not confirm your sign-in. Please sign in again.");
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? "");
      if (!data.user) {
        setAuctions([]);
        setSaved([]);
        setLoaded(false);
      }
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabaseConfigured]);
  useEffect(() => {
    if (!supabaseConfigured || !authReady) return;
    let disposed = false;
    const supabase = createSupabaseClient();
    const loadSharedData = async () => {
      setRemoteLoading(true);
      const { data, error } = await supabase.from("listings").select("id,seller_id,title,category,condition,description,emoji,image_url,start_price,bid_increment,closes_at,status,seller:profiles!listings_seller_id_fkey(display_name),bids(id,bidder_id,amount,created_at,bidder:profiles!bids_bidder_id_fkey(display_name))").order("created_at", { ascending: false });
      if (disposed) return;
      if (error) {
        setRemoteError(error.message);
        setRemoteLoading(false);
        setLoaded(true);
        return;
      }

      const rows = (data ?? []) as unknown as RemoteListingRow[];
      const mapped = rows.map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        condition: row.condition,
        description: row.description,
        emoji: row.emoji,
        color: colorFor(row.category),
        image: row.image_url ?? undefined,
        seller: userId && row.seller_id === userId ? "You" : row.seller?.display_name ?? "Campus student",
        start: row.start_price,
        increment: row.bid_increment,
        closes: Date.parse(row.closes_at),
        status: row.status,
        bids: [...(row.bids ?? [])].sort((a, b) => b.amount - a.amount || Date.parse(b.created_at) - Date.parse(a.created_at)).map(bid => ({
          bidder: userId && bid.bidder_id === userId ? "You" : bid.bidder?.display_name ?? "Campus student",
          bidderId: bid.bidder_id,
          amount: bid.amount,
          at: Date.parse(bid.created_at),
        })),
      } satisfies Auction));
      setAuctions(mapped);
      setRemoteError("");
      if (userId) {
        const { data: favorites } = await supabase.from("favorites").select("listing_id").eq("user_id", userId);
        if (disposed) return;
        setSaved((favorites ?? []).map(favorite => favorite.listing_id));
      } else {
        setSaved([]);
      }
      setLoaded(true);
      setRemoteLoading(false);
    };

    void loadSharedData();
    const channel = userId ? supabase.channel(`relaybid-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => { void loadSharedData(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, payload => {
        const bid = payload.new as { listing_id: string; bidder_id: string; amount: number };
        const listing = auctionsRef.current.find(item => item.id === bid.listing_id);
        if (listing && bid.bidder_id !== userId) {
          if (listing.seller === "You") showActivityNotification("New bid on your listing", `${listing.title} received a bid of ${money(bid.amount)}.`);
          if (listing.bids[0]?.bidderId === userId) showActivityNotification("You’ve been outbid", `${listing.title} now has a leading bid of ${money(bid.amount)}.`);
        }
        void loadSharedData();
      })
      .subscribe() : null;
    return () => { disposed = true; if (channel) void supabase.removeChannel(channel); };
  }, [supabaseConfigured, userId, authReady]);
  useEffect(() => { if (loaded && !supabaseConfigured) localStorage.setItem("campus-auction-demo", JSON.stringify(auctions)); }, [auctions, loaded, supabaseConfigured]);
  useEffect(() => { if (loaded && !supabaseConfigured) localStorage.setItem("campus-auction-saved", JSON.stringify(saved)); }, [saved, loaded, supabaseConfigured]);
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(""), 2800); return () => window.clearTimeout(t); }, [notice]);
  useEffect(() => {
    if (!notificationsEnabled || !notice || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
    new Notification("RelayBid", { body: notice, icon: "/icon.svg" });
  }, [notice, notificationsEnabled]);
  const displayAuctions = auctions;
  const displaySaved = saved;
  const active = displayAuctions.filter(a => a.status === "live" && a.closes > now);
  const filtered = useMemo(() => {
    let list = active.filter(a => (category === "All categories" || a.category === category) && (condition === "Any condition" || a.condition === condition) && (!priceLimit || (getCurrent(a) || a.start) <= priceLimit) && `${a.title} ${a.description} ${a.category}`.toLowerCase().includes(query.toLowerCase()));
    if (tab === "My bids") list = list.filter(a => a.bids.some(b => b.bidder === "You"));
    if (tab === "Saved") list = list.filter(a => displaySaved.includes(a.id));
    return [...list].sort((a, b) => sort === "Ending soon" ? a.closes - b.closes : sort === "Price: low to high" ? (getCurrent(a) || a.start) - (getCurrent(b) || b.start) : b.bids.length - a.bids.length);
  }, [active, category, condition, priceLimit, query, sort, tab, displaySaved]);
  const current = displayAuctions.find(a => a.id === selected) ?? null;
  const myListings = displayAuctions.filter(a => a.seller === "You" && a.status !== "cancelled");

  function requireSignIn(action: string) {
    if (supabaseConfigured && !userId) {
      setNotice(`Sign in with your email to ${action}.`);
      return false;
    }
    return true;
  }

  function openTab(name: string) {
    if (name !== "Discover" && !requireSignIn(`view ${name.toLowerCase()}`)) return;
    setTab(name);
  }

  function openCreateListing() {
    if (!requireSignIn("list an item")) return;
    setEditingId(null);
    setShowCreate(true);
  }

  async function placeBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("place a bid")) return;
    if (!current) return;
    const amount = Number(bidAmount);
    const minimum = current.bids.length ? getCurrent(current) + current.increment : current.start;
    if (current.closes <= now || current.status !== "live") { setNotice("This auction has closed."); return; }
    if (!Number.isInteger(amount) || amount < minimum) { setNotice(`Your bid must be at least ${money(minimum)}.`); return; }
    if (supabaseConfigured) {
      const supabase = createSupabaseClient();
      const { error } = await supabase.rpc("place_bid", { p_listing_id: current.id, p_amount: amount });
      if (error) { setNotice(error.message); return; }
      setAuctions(xs => xs.map(a => a.id === current.id ? { ...a, bids: [{ bidder: "You", bidderId: userId ?? undefined, amount, at: Date.now() }, ...a.bids] } : a));
      setBidAmount(""); setNotice("Your bid is in. Good luck!");
      return;
    }
    setAuctions(xs => xs.map(a => a.id !== current.id ? a : { ...a, bids: [{ bidder: "You", amount, at: Date.now() }, ...a.bids], closes: a.closes - Date.now() <= 30000 ? Date.now() + 60000 : a.closes }));
    setBidAmount(""); setNotice("Your bid is in. Good luck!");
  }
  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("list an item")) return;
    const f = new FormData(event.currentTarget);
    const duration = Number(f.get("duration"));
    const file = f.get("photo") as File;
    if (file?.size > 2_000_000) { setNotice("Choose a photo under 2 MB."); return; }
    if (supabaseConfigured && userId) {
      try {
        const existing = auctions.find(a => a.id === editingId);
        let imageUrl = existing?.image;
        if (file?.size) {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setNotice("Use a JPG, PNG, or WebP photo."); return; }
          const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
          const path = `${userId}/${crypto.randomUUID()}.${extension}`;
          const supabase = createSupabaseClient();
          const { data: uploaded, error: uploadError } = await supabase.storage.from("listing-photos").upload(path, file, { contentType: file.type });
          if (uploadError) throw uploadError;
          imageUrl = supabase.storage.from("listing-photos").getPublicUrl(uploaded.path).data.publicUrl;
        }
        const values = {
          title: String(f.get("title")), category: String(f.get("category")), condition: String(f.get("condition")),
          description: String(f.get("description")), emoji: String(f.get("emoji") || "📦"), image_url: imageUrl ?? null,
          start_price: Number(f.get("start")), bid_increment: Number(f.get("increment")),
          closes_at: new Date(Date.now() + duration * hour).toISOString(),
        };
        const supabase = createSupabaseClient();
        let listingId = editingId;
        if (editingId) {
          const { error } = await supabase.from("listings").update(values).eq("id", editingId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("listings").insert({ ...values, seller_id: userId }).select("id").single();
          if (error) throw error;
          listingId = data.id;
        }
        const auction: Auction = {
          id: listingId!, ...values, image: imageUrl, start: values.start_price, increment: values.bid_increment,
          closes: Date.parse(values.closes_at), color: colorFor(values.category), seller: "You",
          bids: existing?.bids ?? [], status: existing?.status ?? "live",
        };
        setAuctions(xs => editingId ? xs.map(a => a.id === editingId ? auction : a) : [auction, ...xs]);
        setNotice(editingId ? "Your listing has been updated." : "Your item is now listed.");
        setEditingId(null); setShowCreate(false); setTab("My listings");
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : "We couldn’t save your listing.");
      }
      return;
    }
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
  async function changeAuctionStatus(a: Auction, status: Auction["status"], message: string) {
    if (supabaseConfigured) {
      const { error } = await createSupabaseClient().from("listings").update({ status }).eq("id", a.id);
      if (error) { setNotice(error.message); return; }
    }
    setAuctions(xs => xs.map(item => item.id === a.id ? { ...item, status } : item));
    setNotice(message);
  }
  function closeAuction(a: Auction) {
    void changeAuctionStatus(a, a.bids.length ? "pending" : "unsold", a.bids.length ? "Auction ended. Review the leading bid." : "Auction ended without bids; marked unsold.");
  }
  function sellerDecision(a: Auction, approved: boolean) {
    void changeAuctionStatus(a, approved ? "reserved" : "rejected", approved ? "Winning price approved. Item reserved for the buyer." : "Winning price rejected and recorded.");
  }
  function handover(a: Auction, successful: boolean) {
    void changeAuctionStatus(a, successful ? "sold" : "failed_pickup", successful ? "Handover confirmed. Sale complete." : "Failed pickup recorded.");
  }
  function cancelListing(a: Auction) {
    if (a.bids.length) { setNotice("A listing can’t be deleted after it receives a bid."); return; }
    if (!window.confirm(`Delete “${a.title}” from the marketplace?`)) return;
    void changeAuctionStatus(a, "cancelled", "Your listing has been deleted.");
  }
  async function toggleSaved(id: string) {
    if (!requireSignIn("save a listing")) return;
    if (supabaseConfigured && userId) {
      const isSaved = saved.includes(id);
      const supabase = createSupabaseClient();
      const { error } = isSaved
        ? await supabase.from("favorites").delete().eq("listing_id", id).eq("user_id", userId)
        : await supabase.from("favorites").insert({ listing_id: id, user_id: userId });
      if (error) { setNotice(error.message); return; }
    }
    setSaved(xs => xs.includes(id) ? xs.filter(savedId => savedId !== id) : [...xs, id]);
  }
  async function signOut() {
    const { error } = await createSupabaseClient().auth.signOut();
    if (error) setNotice(error.message);
    else { setUserId(null); setUserEmail(""); setNotice("You’re signed out."); }
  }
  function toggleNotifications() {
    if (notificationsEnabled) {
      localStorage.setItem("relaybid-notifications-enabled", "false");
      notificationsEnabledRef.current = false;
      setNotificationsEnabled(false);
      setNotice("RelayBid notifications are off.");
      return;
    }
    if (!("Notification" in window)) { setNotice("This browser does not support notifications."); return; }
    const enable = () => {
      localStorage.setItem("relaybid-notifications-enabled", "true");
      notificationsEnabledRef.current = true;
      setNotificationsEnabled(true);
      setNotice("Browser bid alerts are on while RelayBid is open. No emails are sent.");
    };
    if (Notification.permission === "granted") { enable(); return; }
    if (Notification.permission === "denied") { setNotice("Notifications are blocked in browser settings. Allow them for this site, then try again."); return; }
    Notification.requestPermission().then(permission => {
      if (permission === "granted") enable();
      else setNotice("Notifications are still off. You can allow them in your browser settings.");
    });
  }
  if (supabaseConfigured && !authReady) return <main className="auth-required"><div><span className="brand-mark">◎</span><h1>Opening RelayBid…</h1><p>Checking your student sign-in.</p></div></main>;
  if (supabaseConfigured && remoteLoading && !loaded) return <main className="auth-required"><div><span className="brand-mark">◎</span><h1>Loading the marketplace…</h1><p>Fetching listings shared by your campus.</p></div></main>;

  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-mark">◎</span><span>Relay<span className="brand-light">Bid</span><small>PASS IT ON</small></span></a>
      <div className="nav-label">YOUR SPACE</div>
      <nav>{["Discover", "My bids", "Saved", "My listings"].map((name, i) => <button key={name} className={`nav-item ${tab === name ? "selected" : ""}`} onClick={() => openTab(name)}><span className="nav-icon">{["⌕", "♧", "♡", "▣"][i]}</span>{name}{name === "My bids" && <span className="nav-count">{userId ? displayAuctions.filter(a => a.bids.some(b => b.bidder === "You")).length : 0}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="safety-card"><span className="safety-icon">✳</span><b>Good deals. Good people.</b><p>Every exchange stays on campus. Meet somewhere public and check before you trade.</p><a href="#trust">Our community pledge ↗</a></div><div className="profile"><div className="avatar">{userEmail ? userEmail[0].toUpperCase() : "G"}</div><div><b>{userEmail || "Guest preview"}</b><small>{userEmail ? "Student account" : "Browse-only access"}</small></div><button className="more" title={userId ? "Sign out" : "Sign in"} onClick={() => { if (userId) void signOut(); else window.location.href = "/login"; }}>{userId ? "↪" : "↗"}</button></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">Marketplace <span>/</span> <b>{tab}</b></div><div className="top-actions">{userId ? <button className="sign-in-link" onClick={signOut}>Sign out</button> : <a className="sign-in-link" href="/login">Sign in</a>}<button className="icon-button" type="button" title={notificationsEnabled ? "Turn notifications off" : "Turn notifications on"} aria-label={notificationsEnabled ? "Turn notifications off" : "Turn notifications on"} aria-pressed={notificationsEnabled} onClick={toggleNotifications}>♧<i className={notificationsEnabled ? "enabled" : "disabled"}/></button><div className="top-avatar">{userEmail ? userEmail[0].toUpperCase() : "G"}</div></div></header>
      <div className="content">
        {remoteError && <div className="data-error" role="alert">We couldn’t load shared listings: {remoteError}</div>}
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {userEmail ? "WELCOME BACK" : supabaseConfigured ? "CAMPUS MARKETPLACE" : "GOOD MORNING, PRIYA"}</div><h1>{tab === "Discover" ? <>Find your next <em>favourite.</em></> : tab}</h1><p className="intro">Seniors pass it on. Juniors bid it forward.</p></div><button className="primary-button" onClick={openCreateListing}><span>＋</span> List an item</button></div>
        {tab === "Discover" && <div className="hero"><div className="hero-copy"><div className="hero-kicker"><span>✳</span> THE CAMPUS PASS-ON</div><h2>Good things<br/>deserve a <i>second life.</i></h2><p>Bid on useful finds from graduating seniors and give them a new home for your next semester.</p><button onClick={() => document.getElementById("listing-grid")?.scrollIntoView({ behavior: "smooth" })}>Explore what’s here <span>↘</span></button></div><div className="hero-art"><span className="sun"/><span className="orbit o1"/><span className="orbit o2"/><div className="hero-object bike">🚲</div><div className="hero-object book">📚</div><div className="hero-object calc">🧮</div><span className="art-spark s1">✳</span><span className="art-spark s2">✦</span><div className="hero-note">passed on<br/>with love <span>↗</span></div></div><div className="hero-index">01 <span>/ 03</span></div></div>}

        <div className="section-heading" id="listing-grid"><div><div className="eyebrow section-eye">{tab === "My bids" ? "YOUR ACTIVITY" : tab === "Saved" ? "KEPT CLOSE" : tab === "My listings" ? "YOUR SELLER DESK" : "FRESH ON CAMPUS"}</div><h2>{tab === "Discover" ? "Out there, right now" : tab === "My bids" ? "Auctions you’re in" : tab === "Saved" ? "Your saved finds" : "Your listings"}<span className="result-count">{tab === "My listings" ? myListings.length : filtered.length}</span></h2></div>{tab !== "My listings" && <div className="view-toggle" role="group" aria-label="Listing layout"><button type="button" className={viewMode === "grid" ? "active" : ""} aria-label="Grid view" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>▦</button><button type="button" className={viewMode === "list" ? "active" : ""} aria-label="List view" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>☷</button></div>}</div>
        <div className="filters"><label className="search-box"><span>⌕</span><input placeholder="Search for something…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><select value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option>{["Cycles", "Electronics", "Books", "Sports", "Furniture", "Other"].map(x => <option key={x}>{x}</option>)}</select><select value={condition} onChange={e => setCondition(e.target.value)}><option>Any condition</option>{["Like new", "Good", "Fair"].map(x => <option key={x}>{x}</option>)}</select><select value={priceLimit} onChange={e => setPriceLimit(Number(e.target.value))}><option value={0}>Any price</option><option value={500}>Under ₹500</option><option value={1000}>Under ₹1,000</option><option value={2000}>Under ₹2,000</option></select><select value={sort} onChange={e => setSort(e.target.value)}><option>Ending soon</option><option>Price: low to high</option><option>Most bids</option></select><button className="filter-button" onClick={() => { setCategory("All categories"); setCondition("Any condition"); setPriceLimit(0); setQuery(""); }}>↗</button></div>

        {tab === "My listings" ? <div className="seller-list">{myListings.length === 0 ? <div className="empty-state"><span>✳</span><h3>Your next good thing starts here.</h3><p>List something you no longer need and let it find its next owner.</p><button className="primary-button" onClick={openCreateListing}>＋ List an item</button></div> : myListings.map(a => <div className="seller-row" key={a.id}><div className={`seller-thumb ${a.color}`} style={a.image ? { backgroundImage: `url(${a.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{a.image ? "" : a.emoji}</div><div className="seller-info"><b>{a.title}</b><span>{a.category} · {a.condition}</span></div><div className="seller-status"><small>STATUS</small><b className={`status ${a.status}`}>{a.status === "pending" ? "Needs your decision" : a.status === "reserved" ? "Reserved · arrange pickup" : a.status === "sold" ? "Sale complete" : a.status === "failed_pickup" ? "Failed pickup recorded" : a.status === "unsold" ? "Unsold" : a.status === "cancelled" ? "Deleted" : a.status === "rejected" ? "Winning price rejected" : a.closes <= now ? "Auction ended · review" : "Live auction"}</b></div><div className="seller-price"><small>LEADING BID</small><b>{a.bids.length ? money(getCurrent(a)) : "No bids yet"}</b></div><div className="seller-actions">{a.status === "pending" && <><button className="approve" onClick={() => sellerDecision(a, true)}>Approve</button><button className="decline" onClick={() => sellerDecision(a, false)}>Reject</button></>}{a.status === "reserved" && <><button className="approve" onClick={() => handover(a, true)}>Confirm pickup</button><button className="decline" onClick={() => handover(a, false)}>Failed pickup</button></>}{a.status === "live" && <>{a.closes <= now && <button className="approve" onClick={() => closeAuction(a)}>Close auction</button>}{a.bids.length === 0 && a.closes > now && <button className="approve" onClick={() => { setEditingId(a.id); setShowCreate(true); }}>Edit</button>}{a.bids.length === 0 && <button className="decline" onClick={() => cancelListing(a)}>Delete</button>}</>}<button className="detail-link" onClick={() => setSelected(a.id)}>Details ↗</button></div></div>)}</div> : <>
          <div className={`cards-grid ${viewMode === "list" ? "list-view" : ""}`}>{filtered.map((a, i) => { const lead = getCurrent(a); const leading = a.bids[0]?.bidder === "You"; return <article className="auction-card" key={a.id} style={{ animationDelay: `${i * 55}ms` }}>
            <button className={`save-button ${displaySaved.includes(a.id) ? "saved" : ""}`} title={userId ? "Save listing" : "Sign in to save listing"} onClick={() => void toggleSaved(a.id)}>{displaySaved.includes(a.id) ? "♥" : "♡"}</button><button className={`card-art ${a.color}`} style={a.image ? { backgroundImage: `linear-gradient(#ffffff16,#ffffff16),url(${a.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} onClick={() => setSelected(a.id)}><span className="art-category">{a.category}</span>{!a.image && <span className="item-emoji">{a.emoji}</span>}<span className={`art-tag ${loaded && a.closes - now < hour ? "urgent" : ""}`}><i/> {loaded ? `${timeLeft(a.closes, now)} left` : "Auction timer"}</span></button>
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
