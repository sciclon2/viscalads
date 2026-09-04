'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import data from '@/lib/stats-data.json';
import { queryCatalog as queries, type QueryId } from '@/lib/query-catalog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamBuilder } from '@/components/team-builder';

type RecordRow = { name: string | string[]; played: number; wins: number; draws: number; losses: number };
type ImpactRow = RecordRow & { withRate: number; withoutRate: number; impact: number; teammates: number };
type FormRow = RecordRow & { totalPlayed: number; currentRate: number; trend: 'up' | 'neutral' | 'down'; sequence: ('W'|'D'|'L')[]; lastDate: string };
type Metric = 'effectiveness' | 'played' | 'wins' | 'losses' | 'points';
type Game = (typeof data.games)[number];
const playerNames = data.players.map((p) => p.name).sort();
const latestMatchDate = data.games.reduce((latest, game) => game.date > latest ? game.date : latest, '');
const metricLabels: Record<Metric, string> = { effectiveness: 'Efectividad', played: 'Partidos', wins: 'Victorias', losses: 'Derrotas', points: 'Puntos' };

function points(r: RecordRow) { return 3 * r.wins + r.draws; }
function efficiency(r: RecordRow) { return r.played ? points(r) / (3 * r.played) : 0; }
function lossRate(r: RecordRow) { return r.played ? r.losses / r.played : 0; }
function pct(value: number) { return new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 }).format(value); }
function daysBetween(earlier: string, later: string) { return Math.floor((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000); }
function labelOf(name: string | string[]) { return Array.isArray(name) ? name.join(' · ') : name; }
function valueFor(row: RecordRow, metric: Metric) { return metric === 'effectiveness' ? efficiency(row) : metric === 'points' ? points(row) : metric === 'played' ? row.played : metric === 'wins' ? row.wins : row.losses; }
function resultFor(game: Game, player: string) { const side = game.team1.includes(player) ? '1' : '2'; return game.outcome === 'D' ? 'D' : game.outcome === side ? 'W' : 'L'; }

export default function Home() {
  const [query, setQuery] = useState<QueryId>('players');
  const [player, setPlayer] = useState('Facu');
  const [minimum, setMinimum] = useState(20);
  const [maximum, setMaximum] = useState(999);
  const [direction, setDirection] = useState<'best' | 'worst'>('best');
  const [metric, setMetric] = useState<Metric>('effectiveness');
  const [recentWindow, setRecentWindow] = useState<5 | 10 | 20>(10);
  const [activityDays, setActivityDays] = useState<30 | 60 | 90 | 180 | 99999>(60);
  const selected = queries.find((item) => item.id === query)!;

  const rows = useMemo(() => {
    let source: RecordRow[] = [];
    if (query === 'players' || query === 'points' || query === 'losses') source = data.players;
    if (query === 'pairs') source = data.pairs;
    if (query === 'trios') source = data.trios;
    if (query === 'partners') source = data.pairs.filter((row) => row.name.includes(player)).map((row) => ({ ...row, name: row.name.find((name) => name !== player) ?? player }));
    if (query === 'rivals') source = rivalRows(player);
    if (query === 'tournaments') source = Object.entries(data.tournaments).flatMap(([tournament, list]) => { const row = list.find((item) => item.name === player); return row ? [{ ...row, name: tournament }] : []; });
    if (query === 'prime') source = primeRows(player);
    const activeMetric: Metric = query === 'points' ? 'points' : query === 'losses' ? 'losses' : metric;
    return source.filter((row) => ['tournaments', 'prime'].includes(query) || (row.played >= minimum && row.played <= maximum)).sort((a, b) => {
      const av = query === 'losses' ? lossRate(a) : valueFor(a, activeMetric);
      const bv = query === 'losses' ? lossRate(b) : valueFor(b, activeMetric);
      return (direction === 'best' ? bv - av : av - bv) || b.played - a.played;
    });
  }, [query, player, minimum, maximum, direction, metric]);

  const impactRows = useMemo(() => decisiveRows()
    .filter((row) => row.played >= minimum && row.played <= maximum)
    .sort((a, b) => (direction === 'best' ? b.impact - a.impact : a.impact - b.impact) || b.played - a.played),
  [minimum, maximum, direction]);
  const form = useMemo(() => formRows(recentWindow)
    .filter((row) => row.totalPlayed >= minimum && row.totalPlayed <= maximum && daysBetween(row.lastDate, latestMatchDate) <= activityDays)
    .sort((a,b) => (direction === 'best' ? b.currentRate-a.currentRate : a.currentRate-b.currentRate) || b.totalPlayed-a.totalPlayed),
  [recentWindow, activityDays, minimum, maximum, direction]);

  const verified = data.games.filter((g) => g.status === 'verified').length;
  const exact = data.games.filter((g) => g.quality === 'exact score').length;
  const displayMetric: Metric = query === 'points' ? 'points' : query === 'losses' ? 'losses' : metric;

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({ name: 'configure_stats_query', title: 'Configurar consulta estadística', description: 'Cambia la consulta y los filtros visibles en NKOS Lab.', inputSchema: { type: 'object', properties: { query: { type: 'string', enum: queries.map((q) => q.id) }, player: { type: 'string', enum: playerNames }, minimum: { type: 'integer', minimum: 0 }, maximum: { type: 'integer', minimum: 1 }, recentWindow: { type: 'integer', enum: [5,10,20] }, activityDays: { type: 'integer', enum: [30,60,90,180,99999] }, order: { type: 'string', enum: ['best', 'worst'] }, metric: { type: 'string', enum: Object.keys(metricLabels) } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const v = input as { query?: QueryId; player?: string; minimum?: number; maximum?: number; recentWindow?: 5|10|20; activityDays?: 30|60|90|180|99999; order?: 'best'|'worst'; metric?: Metric }; if (v.query && queries.some((q) => q.id === v.query)) setQuery(v.query); if (v.player && playerNames.includes(v.player)) setPlayer(v.player); if (Number.isInteger(v.minimum) && v.minimum! >= 0) setMinimum(v.minimum!); if (Number.isInteger(v.maximum) && v.maximum! > 0) setMaximum(v.maximum!); if (v.recentWindow && [5,10,20].includes(v.recentWindow)) setRecentWindow(v.recentWindow); if (v.activityDays && [30,60,90,180,99999].includes(v.activityDays)) setActivityDays(v.activityDays); if (v.order) setDirection(v.order); if (v.metric && metricLabels[v.metric]) setMetric(v.metric); return { ok: true }; } }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return <TooltipProvider><main className="min-h-screen bg-background text-foreground"><div className="pitch-lines" aria-hidden="true" />
    <header className="relative border-b border-white/10 bg-[#101b16]/95 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-full border-2 border-[#d8ff4f] bg-[#1f382b] text-xl">⚽</div><div><p className="font-display text-xl leading-none">NKOS LAB</p><p className="mt-1 text-xs uppercase tracking-[.2em] text-[#b8c8bf]">estadística de vestuario</p></div></div><Badge className="border-[#d8ff4f]/40 bg-[#d8ff4f]/10 text-[#d8ff4f]">LOCAL · 124 PARTIDOS</Badge></div></header>
    <section className="relative mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10"><div className="mb-7 grid gap-4 lg:grid-cols-[1.45fr_.55fr]"><div><p className="mb-2 text-sm font-bold uppercase tracking-[.2em] text-[#347a52]">La máquina de discutir</p><h1 className="font-display max-w-3xl text-4xl leading-[.95] sm:text-6xl">Preguntale al historial. <span className="text-[#e34f32]">Que decidan los datos.</span></h1></div><div className="grid grid-cols-3 gap-2 self-end">{[['OFICIALES', data.games.length], ['RECONSTRUIDOS', verified], ['MARCADOR', exact]].map(([label, value]) => <div key={label} className="score-tile"><strong>{value}</strong><span>{label}</span></div>)}</div></div>
      <Card className="border-0 bg-[#f7f4eb]/95 shadow-[0_24px_70px_rgba(20,40,28,.16)] ring-1 ring-[#173d2a]/15"><CardHeader className="border-b border-[#173d2a]/10 lg:grid-cols-[1fr_auto]"><div><div className="flex items-center gap-2"><CardTitle className="font-display text-2xl">{selected.label}</CardTitle><Tooltip><TooltipTrigger aria-label={`Cómo se calcula ${selected.label}`} className="grid size-7 place-items-center rounded-full border border-[#173d2a]/20 bg-white text-[#347a52] transition hover:border-[#347a52] hover:bg-[#e7f3e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347a52]"><Info className="size-4" /></TooltipTrigger><TooltipContent side="bottom" align="start" className="max-w-sm bg-[#173d2a] px-4 py-3 text-sm leading-relaxed text-white">{selected.details}</TooltipContent></Tooltip></div><CardDescription>{selected.description}</CardDescription></div><Select value={query} onValueChange={(value) => setQuery(value as QueryId)}><SelectTrigger className="mt-4 h-10 min-w-64 bg-white lg:mt-0"><SelectValue /></SelectTrigger><SelectContent>{queries.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></CardHeader>
        <CardContent className="pt-5"><div className="mb-5 flex flex-wrap items-end gap-3">{selected.needsPlayer && <Filter label="Jugador"><Select value={player} onValueChange={setPlayer}><SelectTrigger className="mt-1 h-10 min-w-48 bg-white"><SelectValue /></SelectTrigger><SelectContent>{playerNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></Filter>}{selected.supportsWindow && <><Filter label="Últimos partidos"><Select value={String(recentWindow)} onValueChange={(v)=>setRecentWindow(Number(v) as 5|10|20)}><SelectTrigger className="mt-1 h-10 min-w-40 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">Últimos 5</SelectItem><SelectItem value="10">Últimos 10</SelectItem><SelectItem value="20">Últimos 20</SelectItem></SelectContent></Select></Filter><Filter label="Actividad"><Select value={String(activityDays)} onValueChange={(v)=>setActivityDays(Number(v) as 30|60|90|180|99999)}><SelectTrigger className="mt-1 h-10 min-w-44 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">Jugó en 30 días</SelectItem><SelectItem value="60">Jugó en 60 días</SelectItem><SelectItem value="90">Jugó en 90 días</SelectItem><SelectItem value="180">Jugó en 180 días</SelectItem><SelectItem value="99999">Sin límite</SelectItem></SelectContent></Select></Filter></>}{selected.supportsMinimum && <><Filter label="PJ mínimo"><NumericFilterInput ariaLabel="Partidos jugados mínimos" value={minimum} min={0} onValueChange={setMinimum}/></Filter><Filter label="PJ máximo"><NumericFilterInput ariaLabel="Partidos jugados máximos" value={maximum} min={1} emptyValue={999} placeholder="Sin límite" onValueChange={setMaximum}/></Filter><span className="filter-count">{query === 'decisive' ? impactRows.length : query === 'form' ? form.length : rows.length} resultados</span></>}{selected.supportsMetric && <Filter label="Métrica"><Select value={metric} onValueChange={(v) => setMetric(v as Metric)}><SelectTrigger className="mt-1 h-10 min-w-44 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(metricLabels).map(([id,label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></Filter>}{selected.supportsOrder && <Filter label="Orden"><Select value={direction} onValueChange={(v) => setDirection(v as 'best'|'worst')}><SelectTrigger className="mt-1 h-10 min-w-40 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="best">Mayor a menor</SelectItem><SelectItem value="worst">Menor a mayor</SelectItem></SelectContent></Select></Filter>}</div>
          {query === 'builder' ? <TeamBuilder /> : query === 'champions' ? <Champions /> : query === 'records' ? <Records /> : query === 'coverage' ? <Coverage /> : query === 'matches' ? <Matches player={player} /> : query === 'decisive' ? <ImpactResults rows={impactRows} /> : query === 'form' ? <FormResults rows={form} window={recentWindow} /> : <Results rows={rows} metric={displayMetric} lossMetric={query === 'losses'} />}
        </CardContent></Card><p className="mt-4 text-center text-sm text-[#476052]">3 puntos por victoria · 1 por empate · amistosos y cancelados fuera · datos guardados solo en este laptop</p></section>
  </main></TooltipProvider>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) { return <label className="filter-label">{label}{children}</label>; }

function NumericFilterInput({ ariaLabel, value, min, emptyValue, placeholder, onValueChange }: { ariaLabel: string; value: number; min: number; emptyValue?: number; placeholder?: string; onValueChange: (value: number) => void }) {
  const shownValue = value === emptyValue ? '' : String(value);
  const [draft, setDraft] = useState(shownValue);
  useEffect(() => setDraft(shownValue), [shownValue]);
  const commit = (raw: string) => {
    if (raw === '') {
      if (emptyValue !== undefined) onValueChange(emptyValue);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) onValueChange(Math.max(min, parsed));
  };
  return <Input aria-label={ariaLabel} className="mt-1 h-10 w-32 bg-white" type="number" min={min} value={draft} placeholder={placeholder} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { const raw = event.target.value; setDraft(raw); commit(raw); }} onBlur={() => { commit(draft); setDraft(value === emptyValue ? '' : String(Math.max(min, Number.parseInt(draft || String(value), 10)))); }} />;
}

function Results({ rows, metric, lossMetric=false }: { rows: RecordRow[]; metric: Metric; lossMetric?: boolean }) {
  const metricTitle = lossMetric ? '% derrotas' : metricLabels[metric];
  return <div className="overflow-hidden rounded-xl border border-[#173d2a]/10 bg-white"><Table><TableHeader><TableRow className="bg-[#173d2a] hover:bg-[#173d2a]"><TableHead className="w-12 text-white">#</TableHead><TableHead className="text-white">Jugador / grupo</TableHead><TableHead className="text-right text-white">PJ</TableHead><TableHead className="text-right text-white">G</TableHead><TableHead className="text-right text-white">E</TableHead><TableHead className="text-right text-white">P</TableHead><TableHead className="text-right text-white">Pts</TableHead><TableHead className="text-right text-white">{metricTitle}</TableHead></TableRow></TableHeader><TableBody>{rows.slice(0, 60).map((row,index) => { const raw = lossMetric ? lossRate(row) : valueFor(row,metric); const shown = lossMetric || metric === 'effectiveness' ? pct(raw) : raw; return <TableRow key={`${labelOf(row.name)}-${index}`}><TableCell className="font-display text-lg text-[#7c8d82]">{index+1}</TableCell><TableCell className="font-semibold">{labelOf(row.name)}</TableCell><TableCell className="text-right">{row.played}</TableCell><TableCell className="text-right text-[#257347]">{row.wins}</TableCell><TableCell className="text-right">{row.draws}</TableCell><TableCell className="text-right text-[#c7472e]">{row.losses}</TableCell><TableCell className="text-right font-bold">{points(row)}</TableCell><TableCell className="text-right"><span className="eff-pill">{shown}</span></TableCell></TableRow>})}</TableBody></Table>{rows.length===0&&<div className="p-10 text-center text-muted-foreground">Nadie supera este filtro. Bajá el mínimo.</div>}</div>;
}

function ImpactResults({ rows }: { rows: ImpactRow[] }) {
  return <div className="overflow-hidden rounded-xl border border-[#173d2a]/10 bg-white"><Table><TableHeader><TableRow className="bg-[#173d2a] hover:bg-[#173d2a]"><TableHead className="w-12 text-white">#</TableHead><TableHead className="text-white">Jugador</TableHead><TableHead className="text-right text-white">PJ</TableHead><TableHead className="text-right text-white">Compañeros</TableHead><TableHead className="text-right text-white">Con él</TableHead><TableHead className="text-right text-white">Sin él</TableHead><TableHead className="text-right text-white">Impacto</TableHead></TableRow></TableHeader><TableBody>{rows.slice(0,60).map((row,index)=><TableRow key={String(row.name)}><TableCell className="font-display text-lg text-[#7c8d82]">{index+1}</TableCell><TableCell className="font-semibold">{row.name}</TableCell><TableCell className="text-right">{row.played}</TableCell><TableCell className="text-right">{row.teammates}</TableCell><TableCell className="text-right">{pct(row.withRate)}</TableCell><TableCell className="text-right">{pct(row.withoutRate)}</TableCell><TableCell className="text-right"><span className="eff-pill">{row.impact >= 0 ? '+' : ''}{(row.impact*100).toLocaleString('es-ES',{maximumFractionDigits:1})} pp</span></TableCell></TableRow>)}</TableBody></Table>{rows.length===0&&<div className="p-10 text-center text-muted-foreground">Nadie entra en este rango de partidos.</div>}<p className="border-t border-[#173d2a]/10 px-4 py-3 text-sm text-muted-foreground">Impacto = efectividad de sus compañeros cuando comparten equipo menos su efectividad cuando juegan sin él. “pp” son puntos porcentuales.</p></div>;
}

function FormResults({ rows, window }: { rows: FormRow[]; window: number }) {
  const TrendIcon=({trend}:{trend:FormRow['trend']})=>trend==='up'?<TrendingUp className="size-5"/>:trend==='down'?<TrendingDown className="size-5"/>:<Minus className="size-5"/>;
  return <div className="overflow-hidden rounded-xl border border-[#173d2a]/10 bg-white"><Table><TableHeader><TableRow className="bg-[#173d2a] hover:bg-[#173d2a]"><TableHead className="w-12 text-white">#</TableHead><TableHead className="text-white">Jugador</TableHead><TableHead className="text-white">Último → hacia atrás</TableHead><TableHead className="text-right text-white">Forma</TableHead><TableHead className="text-right text-white">Momento actual</TableHead></TableRow></TableHeader><TableBody>{rows.map((row,index)=><TableRow key={String(row.name)}><TableCell className="font-display text-lg text-[#7c8d82]">{index+1}</TableCell><TableCell><strong className="block">{row.name}</strong><span className="text-xs text-muted-foreground">último: {row.lastDate} · {row.totalPlayed} PJ</span></TableCell><TableCell><div className="form-sequence" aria-label={`Resultados recientes de ${row.name}, desde el último partido`}>{row.sequence.map((result,i)=><span key={i} className={`result-dot result-${result.toLowerCase()}`} title={result==='W'?'Ganó':result==='D'?'Empató':'Perdió'}>{result==='W'?'G':result==='D'?'E':'P'}</span>)}</div></TableCell><TableCell className="text-right"><strong>{pct(row.currentRate)}</strong><span className="block text-xs text-muted-foreground">{row.wins}G · {row.draws}E · {row.losses}P</span></TableCell><TableCell className="text-right"><span className={`trend-pill trend-${row.trend}`}><TrendIcon trend={row.trend}/>{row.trend==='up'?'Alto':row.trend==='down'?'Bajo':'Neutral'}</span></TableCell></TableRow>)}</TableBody></Table>{rows.length===0&&<div className="p-10 text-center text-muted-foreground">Nadie entra en este rango de partidos.</div>}<p className="border-t border-[#173d2a]/10 px-4 py-3 text-sm text-muted-foreground">La secuencia empieza por el último partido. Momento alto: 60% o más · neutral: 40% a 59,9% · bajo: menos de 40%.</p></div>;
}

function formRows(window:number):FormRow[]{
  const valid=[...data.games].filter((g)=>g.status==='verified').sort((a,b)=>a.date.localeCompare(b.date));
  return playerNames.flatMap((name)=>{
    const history=valid.filter((g)=>g.team1.includes(name)||g.team2.includes(name));
    if(!history.length)return[];
    const currentGames=history.slice(-window);
    const summarize=(games:Game[])=>{const row:RecordRow={name,played:games.length,wins:0,draws:0,losses:0};games.forEach((g)=>{const result=resultFor(g,name);if(result==='W')row.wins++;if(result==='D')row.draws++;if(result==='L')row.losses++});return row};
    const current=summarize(currentGames), currentRate=efficiency(current);
    const trend:FormRow['trend']=currentRate>=.6?'up':currentRate<.4?'down':'neutral';
    const sequence=currentGames.slice().reverse().map((g)=>resultFor(g,name));
    return [{...current,totalPlayed:history.length,currentRate,trend,sequence,lastDate:currentGames.at(-1)!.date}];
  });
}

function decisiveRows(): ImpactRow[] {
  const valid = data.games.filter((g) => g.status === 'verified' && Math.max(g.team1.length, g.team2.length) <= 8);
  return playerNames.flatMap((candidate) => {
    const candidateGames = valid.filter((g) => g.team1.includes(candidate) || g.team2.includes(candidate));
    const teammates = new Set(candidateGames.flatMap((g) => (g.team1.includes(candidate) ? g.team1 : g.team2).filter((p) => p !== candidate)));
    let withPoints = 0, withGames = 0, withoutPoints = 0, withoutGames = 0;
    for (const teammate of teammates) {
      for (const game of valid) {
        if (!game.team1.includes(teammate) && !game.team2.includes(teammate)) continue;
        const result = resultFor(game, teammate);
        const gamePoints = result === 'W' ? 3 : result === 'D' ? 1 : 0;
        const sameTeam = game.team1.includes(candidate) && game.team1.includes(teammate) || game.team2.includes(candidate) && game.team2.includes(teammate);
        if (sameTeam) { withPoints += gamePoints; withGames++; }
        else if (!game.team1.includes(candidate) && !game.team2.includes(candidate)) { withoutPoints += gamePoints; withoutGames++; }
      }
    }
    if (!withGames || !withoutGames) return [];
    const withRate = withPoints / (3 * withGames), withoutRate = withoutPoints / (3 * withoutGames);
    return [{ name: candidate, played: candidateGames.length, wins: 0, draws: 0, losses: 0, teammates: teammates.size, withRate, withoutRate, impact: withRate - withoutRate }];
  });
}

function rivalRows(player:string):RecordRow[]{ const map=new Map<string,RecordRow>(); for(const game of data.games){if(game.status!=='verified'||Math.max(game.team1.length,game.team2.length)>8)continue; const mine=game.team1.includes(player)?game.team1:game.team2.includes(player)?game.team2:null;if(!mine)continue;const rivals=mine===game.team1?game.team2:game.team1;const res=resultFor(game,player);for(const rival of rivals){const row=map.get(rival)??{name:rival,played:0,wins:0,draws:0,losses:0};row.played++;if(res==='W')row.wins++;if(res==='D')row.draws++;if(res==='L')row.losses++;map.set(rival,row)}}return [...map.values()]}
function primeRows(player:string):RecordRow[]{const games=data.games.filter((g)=>g.status==='verified'&&(g.team1.includes(player)||g.team2.includes(player)));return [5,8,10,12].flatMap((size)=>{if(games.length<size)return[];let best:RecordRow|null=null;let dates='';for(let i=0;i<=games.length-size;i++){const block=games.slice(i,i+size);const row:RecordRow={name:'',played:size,wins:0,draws:0,losses:0};block.forEach((g)=>{const r=resultFor(g,player);if(r==='W')row.wins++;if(r==='D')row.draws++;if(r==='L')row.losses++});if(!best||points(row)>points(best)||(points(row)===points(best)&&row.wins>best.wins)){best=row;dates=`${block[0].date} → ${block.at(-1)!.date}`}}return best?[{...best,name:`Mejor bloque de ${size} · ${dates}`}]:[]})}

function Matches({player}:{player:string}){const games=data.games.filter((g)=>g.team1.includes(player)||g.team2.includes(player)).reverse();return <div className="grid gap-3">{games.map((g)=><div className="match-card" key={`${g.date}-${g.tournament}`}><div><strong>{g.date}</strong><span>{g.tournament}</span></div><p>{g.team1.join(', ')||'Equipo pendiente'} <b>{g.score1??'–'} · {g.score2??'–'}</b> {g.team2.join(', ')||'Equipo pendiente'}</p><Badge variant="outline">{g.status==='verified'?'confirmado':'pendiente'}</Badge></div>)}</div>}
function Records(){const exact=data.games.filter((g):g is Game & {score1:number;score2:number}=>g.score1!==null&&g.score2!==null);const high=[...exact].sort((a,b)=>(b.score1+b.score2)-(a.score1+a.score2))[0];const blow=[...exact].sort((a,b)=>Math.abs(b.score1-b.score2)-Math.abs(a.score1-a.score2))[0];const scores=new Map<string,number>();exact.forEach((g)=>{const k=[g.score1,g.score2].sort((a,b)=>a-b).join('-');scores.set(k,(scores.get(k)??0)+1)});const common=[...scores].sort((a,b)=>b[1]-a[1])[0];const cards=[['Goles registrados',exact.reduce((n,g)=>n+g.score1+g.score2,0),`${exact.length} partidos con marcador`],['Mayor festival',`${high.score1+high.score2} goles`,`${high.date} · ${high.score1}-${high.score2}`],['Mayor goleada',`${Math.abs(blow.score1-blow.score2)} de diferencia`,`${blow.date} · ${blow.score1}-${blow.score2}`],['Marcador favorito',common[0],`${common[1]} veces`],['Finales por un gol',exact.filter((g)=>Math.abs(g.score1-g.score2)===1).length,'partidos'],['Porterías a cero',exact.filter((g)=>Math.min(g.score1,g.score2)===0).length,'partidos']];return <div className="stat-grid">{cards.map(([a,b,c])=><div className="record-card" key={a}><span>{a}</span><strong>{b}</strong><p>{c}</p></div>)}</div>}
function Coverage(){const cards=[['Partidos oficiales',data.games.length],['Resultado reconstruido',data.games.filter((g)=>g.status==='verified').length],['Marcador exacto',data.games.filter((g)=>g.quality==='exact score').length],['Solo G/E/P',data.games.filter((g)=>g.quality==='W-D-L outcome only').length],['Pendientes',data.games.filter((g)=>g.status==='pending').length],['Cobertura',pct(data.games.filter((g)=>g.status==='verified').length/data.games.length)]];return <div className="stat-grid">{cards.map(([a,b])=><div className="record-card" key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>}
function Champions(){
  const totals = new Map<string,string[]>();
  data.champions.forEach((item)=>item.winner.split('+').map((name)=>name.trim()).forEach((name)=>totals.set(name,[...(totals.get(name)??[]),item.tournament])));
  const ranking=[...totals].map(([name,tournaments])=>({name,tournaments,titles:tournaments.length})).sort((a,b)=>b.titles-a.titles||a.name.localeCompare(b.name));
  return <div className="grid gap-7"><section><div className="section-kicker"><Crown className="size-4"/>Tabla histórica</div><div className="overflow-hidden rounded-xl border border-[#173d2a]/10 bg-white"><Table><TableHeader><TableRow className="bg-[#173d2a] hover:bg-[#173d2a]"><TableHead className="w-12 text-white">#</TableHead><TableHead className="text-white">Campeón</TableHead><TableHead className="text-right text-white">Títulos</TableHead><TableHead className="hidden text-white md:table-cell">Torneos ganados</TableHead></TableRow></TableHeader><TableBody>{ranking.map((row,index)=><TableRow key={row.name}><TableCell className="font-display text-lg text-[#7c8d82]">{index+1}</TableCell><TableCell className="font-semibold">{row.name}</TableCell><TableCell className="text-right"><span className="title-pill">{row.titles}</span></TableCell><TableCell className="hidden text-sm text-muted-foreground md:table-cell">{row.tournaments.join(' · ')}</TableCell></TableRow>)}</TableBody></Table></div></section><section><div className="section-kicker">Edición por edición</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.champions.map((item,i)=><div key={item.tournament} className="champ-card"><span>{String(i+1).padStart(2,'0')}</span><div><p>{item.tournament}</p><strong>{item.winner}</strong></div><Crown className="ml-auto size-5 text-[#e3aa22]"/></div>)}</div></section></div>
}
