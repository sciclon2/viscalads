'use client';

import { useEffect, useState } from 'react';
import StatsDashboard from '@/components/stats-dashboard';
import { StatsDataProvider, type StatsData } from '@/lib/stats-context';

export const API = 'http://127.0.0.1:8765/api';

export default function SiteClient({ requestedCompetition, requestedView }: { requestedCompetition?:string; requestedView?:string }) {
  const [data,setData]=useState<StatsData|null>(null), [error,setError]=useState('');
  const refresh=async()=>{try{const response=await fetch(`${API}/stats`,{cache:'no-store'});if(!response.ok)throw new Error('La API local no respondió correctamente');setData(await response.json());setError('');}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo cargar la base local');}};
  useEffect(()=>{void refresh();},[]);
  if(error)return <main className="api-state"><strong>No se pudieron cargar los datos</strong><span>{error}</span><code>python3 scripts/serve_api.py</code><button onClick={()=>void refresh()}>Reintentar</button></main>;
  if(!data)return <main className="api-state"><span className="api-loader" />Consultando SQLite…</main>;
  const competition=data.competitions.some(item=>item.slug===requestedCompetition)?requestedCompetition:null;
  return <StatsDataProvider data={data}>{competition?<StatsDashboard initialCompetition={competition!} initialView={requestedView} data={data} onDataChanged={refresh}/>:<Welcome data={data}/>}</StatsDataProvider>;
}

function Welcome({data}:{data:StatsData}){return <main className="welcome-page"><div className="welcome-glow" aria-hidden="true"/><section className="welcome-shell"><div className="welcome-heading"><div className="welcome-ball" aria-hidden="true">⚽</div><p>Fútbol · amigos · estadísticas</p><h1>Bienvenido a <span>Viscalads</span></h1><p className="welcome-intro">Elegí dónde jugás y entrá al panel.</p></div><div className="competition-grid"><CompetitionCard name="Bogatell" schedule="Sábados" image="/competitions/bogatell.jpg" imagePosition="center 48%" games={data.competitionStats.bogatell.games.length} href="/?competition=bogatell&view=home"/><CompetitionCard name="Sarrià" schedule="Miércoles" image="/competitions/sarria.jpg" imagePosition="center 63%" games={data.competitionStats.sarria.games.length} href="/?competition=sarria&view=home"/></div></section></main>}
function CompetitionCard({name,schedule,image,imagePosition,games,href}:{name:string;schedule:string;image:string;imagePosition:string;games:number;href:string}){return <a href={href} className="competition-card" aria-label={`Entrar a ${name}, partidos de los ${schedule.toLowerCase()}`}><img src={image} alt={`Jugadores de ${name}`} style={{objectPosition:imagePosition}}/><span className="competition-shade" aria-hidden="true"/><span className="competition-copy"><span className="competition-day">▣ {schedule}</span><strong>{name}</strong><span className="competition-meta">{games} partidos registrados</span><span className="competition-action">Ver estadísticas →</span></span></a>}
