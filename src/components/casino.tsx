import { useEffect, useMemo, useRef, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useHydrated, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CASINO_ASSETS, CASINO_IMG, getCasinoGames, getCasinoJackpots, getCasinoWinners, playCasinoGame, type CasinoGame } from "@/lib/fortebet.functions";
import { availableKeys, CASINO_CATEGORIES, CASINO_PROVIDERS, DEFAULT_CASINO_FILTER, filterGames, isFiltered, jackpotCounter, jackpotStart, popularGames, type CasinoFilter } from "@/lib/casino";

const G = "rgb(0,166,90)";

export const casinoGamesQuery = queryOptions({ queryKey: ["fb-casino-games"], queryFn: () => getCasinoGames(), staleTime: 600_000 });
const jackpotsQuery = queryOptions({ queryKey: ["fb-casino-jackpots"], queryFn: () => getCasinoJackpots(), refetchInterval: 60_000, staleTime: 50_000 });
const winnersQuery = queryOptions({ queryKey: ["fb-casino-winners"], queryFn: () => getCasinoWinners(), refetchInterval: 60_000, staleTime: 50_000 });

const CSS = `
.fbCasino{padding-bottom:calc(10px * var(--factor));}
.fbCasino .jackpots,.fbCasino .casinoFilter,.fbCasino .casinoHeader{display:flex;gap:calc(50px * var(--factor));justify-content:center;align-items:center;background:#2E3139;color:#a3a4a8;margin:calc(10px * var(--factor)) 0;border-radius:calc(6px * var(--factor))}
.fbCasino .jackpots{min-height:calc(60px * var(--factor));flex-wrap:wrap;gap:calc(30px * var(--factor)) calc(80px * var(--factor))}
.fbCasino .jackpot{display:flex;padding:0 calc(10px * var(--factor)) 0 calc(90px * var(--factor));height:calc(60px * var(--factor));color:#fff;flex-flow:column;justify-content:center;gap:calc(5px * var(--factor));position:relative;align-items:flex-start}
.fbCasino .jackpot:before{content:"";position:absolute;left:0;top:0;height:100%;width:calc(80px * var(--factor));background:var(--jp) calc(8px * var(--factor)) center/calc(62px * var(--factor)) auto no-repeat}
.fbCasino .jackpot h3{font-size:calc(15px * var(--factor));font-style:italic;font-weight:800;text-transform:uppercase;margin:0;color:#fff9;width:100%;text-align:center}
.fbCasino .jackpot h3:after{display:block;content:"";height:calc(2px * var(--factor));background:#fff3;width:100%;margin-top:2px}
.fbCasino .jackpot .counter{font-size:calc(20px * var(--factor));font-weight:900;line-height:1em;letter-spacing:.06em;font-variant-numeric:tabular-nums}
.fbCasino .casinoHeader{height:calc(44px * var(--factor));font-size:calc(20px * var(--factor));font-weight:500;color:#fff;text-transform:uppercase}
.fbCasino .casinoFilter{padding:calc(5px * var(--factor)) calc(10px * var(--factor));gap:calc(10px * var(--factor));min-height:calc(60px * var(--factor));align-items:stretch;justify-content:space-between}
.fbCasino .casinoFilter>ul{flex:1;display:flex;flex-wrap:wrap;gap:calc(10px * var(--factor));list-style:none;margin:0;padding:0}
.fbCasino .casinoFilter>ul button{display:block;border:0;border-radius:calc(4px * var(--factor));background:#0d1017;color:#828389;font-size:calc(7px * var(--factor));font-weight:700;text-transform:uppercase;text-align:center;width:calc(64px * var(--factor));aspect-ratio:1;overflow:hidden;box-shadow:2px 2px 3px #00000080;padding:79% 0 0;position:relative;cursor:pointer;transition:all .2s ease;font-family:inherit}
.fbCasino .casinoFilter>ul button:before{content:"";display:block;width:100%;aspect-ratio:1;background:var(--icon) top center/contain no-repeat;position:absolute;top:5%;left:0;filter:grayscale(100%);transition:all .2s ease}
.fbCasino .casinoFilter>ul button:hover{color:#d1d3d6}
.fbCasino .casinoFilter>ul button:hover:before{filter:grayscale(0%)}
.fbCasino .casinoFilter>ul button.active{color:#f9fbfe;box-shadow:inset 0 0 0 1px ${G},2px 2px 3px #00000080}
.fbCasino .casinoFilter>ul button.active:before{filter:drop-shadow(0 0 8px ${G})}
.fbCasino .casinoFilter>ul button:disabled{opacity:.5;pointer-events:none}
.fbCasino .casinoSearch{align-self:center;width:calc(230px * var(--factor));position:relative}
.fbCasino .casinoSearch input{width:100%;box-sizing:border-box;background:#3a3d46;border:0;border-radius:calc(4px * var(--factor));color:#e6e6e8;padding:calc(8px * var(--factor)) calc(32px * var(--factor)) calc(7px * var(--factor)) calc(10px * var(--factor));font-size:calc(12px * var(--factor));font-weight:700;outline:none}
.fbCasino .casinoSearch input::placeholder{color:#a3a4a8}
.fbCasino .casinoSearch button{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:#a3a4a8;cursor:pointer;font-size:14px}
.fbCasino .games{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:calc(20px * var(--factor));margin:calc(10px * var(--factor)) 0}
.fbCasino .games>button{background:#20222C;border:0;padding:0;border-radius:calc(6px * var(--factor));text-align:center;cursor:pointer;overflow:hidden;transition:all .2s ease;font-family:inherit;color:inherit}
.fbCasino .games>button>h4{display:block;height:calc(37px * var(--factor));line-height:calc(39px * var(--factor));background:#2E3139;color:#a3a4a8;text-transform:uppercase;font-size:calc(12px * var(--factor));font-weight:700;margin:0;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:inherit;position:relative;z-index:2}
.fbCasino .games>button>img{width:100%;display:block;aspect-ratio:400/239;object-fit:cover;transition:inherit;position:relative;z-index:1;margin:0;background:#16181f}
.fbCasino .games>button:hover>h4,.fbCasino .games>button:focus-visible>h4{background:${G};color:#fff}
.fbCasino .games>button:hover>img{transform:scale(1.05)}
.fbCasino .lastWinners{display:flex;align-items:center;justify-content:space-evenly;gap:calc(10px * var(--factor));background:#2E3139;border-radius:calc(6px * var(--factor));margin:calc(10px * var(--factor)) 0;padding:calc(5px * var(--factor))}
.fbCasino .lastWinners h3{font-size:calc(25px * var(--factor));color:#fff;font-weight:500;text-transform:uppercase;margin:0 calc(10px * var(--factor));white-space:nowrap}
.fbCasino .lastWinners .data{display:flex;gap:calc(10px * var(--factor));overflow:hidden;min-width:0}
.fbCasino .lastWinners .winner{display:flex;align-items:center;gap:calc(5px * var(--factor));padding:calc(5px * var(--factor)) calc(15px * var(--factor)) calc(5px * var(--factor)) calc(5px * var(--factor));border-radius:calc(6px * var(--factor));background:#171921;color:#fff;border:0;cursor:pointer;font-family:inherit;text-align:left;flex-shrink:0;transition:box-shadow .2s ease}
.fbCasino .lastWinners .winner:hover{box-shadow:inset 0 0 0 1px ${G}}
.fbCasino .lastWinners .winner:disabled{cursor:default;box-shadow:none}
.fbCasino .lastWinners img{height:calc(60px * var(--factor));aspect-ratio:400/239;object-fit:cover;border-radius:calc(6px * var(--factor));margin-right:calc(5px * var(--factor))}
.fbCasino .lastWinners .wd{display:flex;flex-direction:column;line-height:calc(18px * var(--factor));font-size:calc(12px * var(--factor));color:#c9cacf}
.fbCasino .lastWinners h4{font-size:calc(13px * var(--factor));margin:0;color:#fff;max-width:calc(150px * var(--factor));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fbCasino .lastWinners strong{color:${G};font-weight:800}
@media (max-width:1100px){.fbCasino .lastWinners h3{display:none}}
.fbCasino .empty{text-align:center;color:#a3a4a8;font-size:calc(18px * var(--factor));padding:calc(60px * var(--factor)) 0}
@media (max-width:1100px){.fbCasino .games{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:700px){.fbCasino .games{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fbCasino .casinoFilter{flex-direction:column}.fbCasino .casinoSearch{width:100%}}
.fbGameModal{position:fixed;inset:0;z-index:1000;background:rgba(10,11,15,.75);display:flex;align-items:center;justify-content:center;padding:20px}
.fbGameModal>.box{background:#171921;border-radius:8px;width:min(1456px,100%);height:min(960px,100%);display:flex;flex-direction:column;box-shadow:0 10px 40px #000a;overflow:hidden}
.fbGameModal .bar{display:flex;align-items:center;gap:12px;padding:0 10px 0 16px;height:50px;color:#e6e6e8;font-weight:700;text-transform:uppercase;font-size:14px;flex-shrink:0}
.fbGameModal .bar .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fbGameModal .bar .tag{font-size:11px;padding:3px 8px;border-radius:3px;background:#2E3139;color:#a3a4a8}
.fbGameModal .bar .tag.on{background:${G};color:#fff}
.fbGameModal .bar button,.fbGameModal .bar a{background:#2E3139;color:#e6e6e8;border:0;border-radius:4px;height:30px;padding:0 12px;font:inherit;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.fbGameModal .bar button:hover,.fbGameModal .bar a:hover{background:#3a3d46}
.fbGameModal .bar .close{background:none;color:${G};font-size:26px;padding:0 6px;line-height:1}
.fbGameModal .bar .close:hover{background:none;color:#fff}
.fbGameModal .stage{flex:1;margin:0 10px 10px;background:#0d1017;border-radius:4px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.fbGameModal iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
.fbGameModal .msg{max-width:420px;text-align:center;color:#c9cacf;font-size:14px;line-height:1.5;padding:20px}
.fbGameModal .msg h3{color:#fff;font-size:18px;margin:0 0 8px;text-transform:uppercase}
.fbGameModal .msg .btns{display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap}
.fbGameModal .msg .btns button{background:${G};color:#fff;border:0;border-radius:4px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer;text-transform:uppercase;font-size:12px}
.fbGameModal .msg .btns button.ghost{background:#2E3139;color:#e6e6e8}
.fbGameModal .spin{width:36px;height:36px;border-radius:50%;border:3px solid #2E3139;border-top-color:${G};animation:fbspin 1s linear infinite;margin:0 auto 12px}
@keyframes fbspin{to{transform:rotate(360deg)}}
`;

/** One jackpot counter that climbs like Fortebet's: from 60 s of growth below the real value up to it, then on to each new value. */
function JackpotCounter({ value, speed }: { value: number; speed: number }) {
  const anim = useRef<{ from: number; to: number; at: number } | null>(null);
  const [shown, setShown] = useState(() => jackpotStart(value, speed));
  useEffect(() => {
    const now = Date.now();
    const cur = anim.current ? jackpotCounter(anim.current.from, anim.current.to, now - anim.current.at) : jackpotStart(value, speed);
    anim.current = { from: Math.min(cur, value), to: value, at: now };
  }, [value, speed]);
  useEffect(() => {
    const t = setInterval(() => {
      const a = anim.current;
      if (a) setShown(jackpotCounter(a.from, a.to, Date.now() - a.at));
    }, 50);
    return () => clearInterval(t);
  }, []);
  return <div className="counter">{Math.floor(shown).toLocaleString("en-US")}&nbsp;UGX</div>;
}

function Jackpots() {
  const { data } = useQuery(jackpotsQuery);
  const list = data?.jackpots ?? [];
  if (!list.length) return null;
  const img: Record<string, string> = { gold: "jackpot-golden.png", silver: "jackpot-silver.png", bronze: "jackpot-bronze.png" };
  return (
    <div className="jackpots">
      {list.map((j) => (
        <div key={j.ident} className="jackpot" style={{ ["--jp" as string]: `url(${CASINO_ASSETS}${img[j.ident] ?? "jackpot-golden.png"})` }}>
          <h3>{j.ident} Jackpot</h3>
          <JackpotCounter value={j.value} speed={j.speed} />
        </div>
      ))}
    </div>
  );
}

/** "Last winners" strip from Fortebet's casino winners feed; a click opens the game that was won. */
function Winners({ games, onPlay }: { games: CasinoGame[]; onPlay: (g: CasinoGame) => void }) {
  const { data } = useQuery(winnersQuery);
  const list = data?.winners ?? [];
  if (!list.length) return null;
  const byImage = new Map(games.map((g) => [g.image, g]));
  return (
    <div className="lastWinners" aria-label="Last winners">
      <h3>Last winners</h3>
      <div className="data">
        {list.slice(0, 5).map((w, i) => {
          const g = byImage.get(w.image);
          return (
            <button type="button" key={i} className="winner" disabled={!g} onClick={() => g && onPlay(g)} title={w.game}>
              <img alt={w.game} src={CASINO_IMG + w.image} loading="lazy" />
              <span className="wd">
                <h4>{w.game}</h4>
                <span>{w.nickname}</span>
                <strong>{Math.floor(w.win).toLocaleString("en-US")}&nbsp;UGX</strong>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GameTile({ g, onPlay }: { g: CasinoGame; onPlay: (g: CasinoGame) => void }) {
  return (
    <button type="button" title={g.name} onClick={() => onPlay(g)}>
      <h4>{g.name}</h4>
      <img alt={g.name} src={CASINO_IMG + g.image} loading="lazy" />
    </button>
  );
}

export function CasinoLobby() {
  const nav = useNavigate();
  const q = useQuery(casinoGamesQuery);
  // Server-loaded games are not handed to the browser, so wait for hydration to keep both renders identical.
  const hydrated = useHydrated();
  const data = hydrated ? q.data : undefined;
  const isLoading = !hydrated || q.isLoading;
  const games = data?.games ?? [];
  const [f, setF] = useState<CasinoFilter>(DEFAULT_CASINO_FILTER);
  const popular = useMemo(() => popularGames(games), [games]);
  const list = useMemo(() => filterGames(games, f), [games, f]);
  const avail = useMemo(() => availableKeys(games, f), [games, f]);
  const play = (g: CasinoGame) => nav({ to: "/slots/game/$ident", params: { ident: g.ident }, resetScroll: false });

  return (
    <div className="fbCasino">
      <style>{CSS}</style>
      <Jackpots />
      <Winners games={games} onPlay={play} />
      {!isFiltered(f) && popular.length > 0 && (
        <>
          <div className="casinoHeader">Most popular games</div>
          <div className="games">{popular.map((g) => <GameTile key={g.id} g={g} onPlay={play} />)}</div>
        </>
      )}
      <div className="casinoFilter">
        <ul aria-label="Providers">
          {CASINO_PROVIDERS.map((p) => (
            <li key={p.key}>
              <button type="button" className={f.provider === p.key ? "active" : ""} disabled={!avail.providers.has(p.key)} style={{ ["--icon" as string]: `url(${CASINO_ASSETS}${p.icon}.webp)` }} onClick={() => setF((x) => ({ ...x, provider: p.key }))}>{p.label}</button>
            </li>
          ))}
        </ul>
        <div className="casinoSearch">
          <input type="text" placeholder="Search game" aria-label="Search game" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} />
          {f.q ? <button type="button" aria-label="Clear search" onClick={() => setF((x) => ({ ...x, q: "" }))}>✕</button> : <button type="button" aria-hidden tabIndex={-1}>⌕</button>}
        </div>
      </div>
      <div className="casinoFilter">
        <ul aria-label="Game types">
          {CASINO_CATEGORIES.map((c) => (
            <li key={c.key}>
              <button type="button" className={f.category === c.key ? "active" : ""} disabled={!avail.categories.has(c.key)} style={{ ["--icon" as string]: `url(${CASINO_ASSETS}${c.icon}.webp)` }} onClick={() => setF((x) => ({ ...x, category: c.key }))}>{c.label}</button>
            </li>
          ))}
        </ul>
      </div>
      {isLoading ? <div className="empty">Loading games…</div>
        : list.length ? <div className="games">{list.map((g) => <GameTile key={g.id} g={g} onPlay={play} />)}</div>
        : <div className="empty">No game found. Please check your selections.</div>}
    </div>
  );
}

type Launch = { state: "loading" } | { state: "ready"; url: string } | { state: "login" } | { state: "error" };

/** Floating game window, like Fortebet's /slots/game/{game}. Demo (fun) mode needs no account. */
export function GameModal({ ident, mode, onMode, onClose }: { ident: string; mode: "fun" | "real"; onMode: (m: "fun" | "real") => void; onClose: () => void }) {
  const { data } = useQuery(casinoGamesQuery);
  const game = data?.games.find((g) => g.ident === ident || g.ident.toLowerCase() === ident.toLowerCase());
  const start = useServerFn(playCasinoGame);
  const [launch, setLaunch] = useState<Launch>({ state: "loading" });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!game) return;
    let live = true;
    setLaunch({ state: "loading" });
    const backUrl = `${window.location.origin}/slots`;
    start({ data: { gameId: game.id, mode, backUrl } })
      .then((r) => { if (live) setLaunch(r.ok ? { state: "ready", url: r.url } : r.error === "LOGIN_REQUIRED" ? { state: "login" } : { state: "error" }); })
      .catch(() => { if (live) setLaunch({ state: "error" }); });
    return () => { live = false; };
  }, [game?.id, mode, tries]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const notFound = data && !game;
  return (
    <div className="fbGameModal" role="dialog" aria-modal="true" aria-label={game?.name ?? "Game"} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <style>{CSS}</style>
      <div className="box">
        <div className="bar">
          <span className="name">{game?.name ?? ident}</span>
          {game?.playFun && <button type="button" className={`tag ${mode === "fun" ? "on" : ""}`} onClick={() => onMode("fun")}>Play for fun</button>}
          {game?.playReal && <button type="button" className={`tag ${mode === "real" ? "on" : ""}`} onClick={() => onMode("real")}>Play for real</button>}
          {launch.state === "ready" && <a href={launch.url} target="_blank" rel="noopener noreferrer">Open in new window ↗</a>}
          <button type="button" className="close" aria-label="Close game" onClick={onClose}>×</button>
        </div>
        <div className="stage">
          {notFound ? (
            <div className="msg"><h3>Game not found</h3>This game is not available right now.<div className="btns"><button type="button" onClick={onClose}>Back to all games</button></div></div>
          ) : !game || launch.state === "loading" ? (
            <div className="msg"><div className="spin" />Starting {game?.name ?? "game"}…</div>
          ) : launch.state === "ready" ? (
            <iframe key={launch.url} src={launch.url} title={game.name} allow="autoplay; fullscreen; clipboard-write" allowFullScreen />
          ) : launch.state === "login" ? (
            <div className="msg">
              <h3>Login required</h3>
              Playing for real money needs a signed-in Fortebet account.{game.playFun ? " You can still try the game for free." : ""}
              <div className="btns">
                {game.playFun && <button type="button" onClick={() => onMode("fun")}>Play for fun</button>}
                <button type="button" className="ghost" onClick={onClose}>Back to all games</button>
              </div>
            </div>
          ) : (
            <div className="msg">
              <h3>Game unavailable</h3>
              {mode === "fun" && !game.playFun ? "This game has no free demo." : "The game could not be started. Please try again."}
              <div className="btns"><button type="button" onClick={() => setTries((t) => t + 1)}>Try again</button><button type="button" className="ghost" onClick={onClose}>Back to all games</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
