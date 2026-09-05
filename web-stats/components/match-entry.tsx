'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Save, Trash2, UserRoundPlus } from 'lucide-react';
import { API } from '@/components/site-client';
import { PlayerAvatar } from '@/components/player-avatar';
import type { Game, Profile } from '@/lib/stats-context';

type Member = { playerId?:number; name:string; guestName?:string };
type Preset = { id:number; createdAt:string; team1:{player_id:number;canonical_name:string}[]; team2:{player_id:number;canonical_name:string}[] };

export function MatchEntry({ mode, competition, profiles, games, onSaved }: { mode:'create'|'admin'; competition:string; profiles:Profile[]; games:Game[]; onSaved:()=>Promise<void> }) {
  const eligible=useMemo(()=>profiles.filter(profile=>profile.competitions.includes(competition)).sort((a,b)=>a.name.localeCompare(b.name)),[profiles,competition]);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [teams,setTeams]=useState<[Member[],Member[]]>([[],[]]);
  const [goals,setGoals]=useState<Record<string,number>>({});
  const [presets,setPresets]=useState<Preset[]>([]), [message,setMessage]=useState(''), [editing,setEditing]=useState<number|null>(null);

  useEffect(()=>{
    if(mode==='admin'){setPresets([]);return;}
    fetch(`${API}/lineups?competition=${competition}`).then(async r=>(await r.json()) as Preset[]).then(setPresets).catch(()=>setPresets([]));
  },[competition,mode]);
  const key=(team:number,member:Member)=>`${team}:${member.playerId??`g:${member.guestName}`}`;
  const score=(team:number)=>teams[team-1].reduce((sum,member)=>sum+(goals[key(team,member)]||0),0)+(goals[`${team}:unknown`]||0);
  const used=new Set(teams.flat().flatMap(member=>member.playerId?[member.playerId]:[]));
  const setTeam=(index:number,value:Member[])=>setTeams(current=>index===0?[value,current[1]]:[current[0],value]);
  const addPlayer=(index:number,value:string)=>{const profile=eligible.find(item=>item.id===Number(value));if(profile&&!used.has(profile.id))setTeam(index,[...teams[index],{playerId:profile.id,name:profile.name}]);};
  const addGuest=(index:number)=>{const count=teams.flat().filter(member=>member.guestName).length+1;const guestName=`Invitado ${count}`;setTeam(index,[...teams[index],{name:guestName,guestName}]);};
  const remove=(index:number,member:Member)=>{setTeam(index,teams[index].filter(item=>item!==member));setGoals(current=>{const copy={...current};delete copy[key(index+1,member)];return copy;});};
  function loadPreset(preset:Preset){setTeams([preset.team1.map(item=>({playerId:item.player_id,name:item.canonical_name})),preset.team2.map(item=>({playerId:item.player_id,name:item.canonical_name}))]);setGoals({});setEditing(null);setMessage('Formación cargada. Podés agregar, quitar o cambiar jugadores libremente.');}
  const payload=()=>({competition,playedOn:date,teams:teams.map(team=>team.map(member=>member.playerId?{playerId:member.playerId}:{guestName:member.guestName})),goals:[...teams.flatMap((team,index)=>team.map(member=>({teamNo:index+1,playerId:member.playerId,guestName:member.guestName,count:goals[key(index+1,member)]||0}))),...([1,2].map(team=>({teamNo:team,count:goals[`${team}:unknown`]||0})))].filter(goal=>goal.count>0)});
  const save=async()=>{setMessage('Guardando…');const response=await fetch(`${API}/matches${editing?`/${editing}`:''}`,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});const body=await response.json() as {error?:string};if(!response.ok){setMessage(body.error||'No se pudo guardar');return;}await onSaved();setEditing(null);setMessage(`Partido guardado: ${score(1)}–${score(2)}.`);};
  const edit=(game:Game)=>{const members=(names:string[],teamNo:number)=>[...names.map(name=>{const profile=profiles.find(item=>item.name===name);return {playerId:profile?.id,name};}),...(game.guests||[]).filter(g=>g.team_no===teamNo).map(g=>({name:g.guest_label,guestName:g.guest_label}))];setDate(game.date);setTeams([members(game.team1,1),members(game.team2,2)]);const next:Record<string,number>={};if(game.goals?.length){game.goals.forEach(goal=>{const member=goal.player_name?profiles.find(item=>item.name===goal.player_name):undefined;next[`${goal.team_no}:${member?.id??`g:${goal.guest_label}`}`]=goal.goal_count;});}else{next['1:unknown']=game.score1||0;next['2:unknown']=game.score2||0;}setGoals(next);setEditing(game.id);setMessage('Editando un partido existente.');window.scrollTo({top:0,behavior:'smooth'});};
  const voidGame=async(game:Game)=>{if(!window.confirm(`¿Anular el partido del ${game.date}? El historial de auditoría se conservará.`))return;const response=await fetch(`${API}/matches/${game.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'Corrección desde la interfaz'})});if(response.ok){await onSaved();setMessage('Partido anulado correctamente.');}};

  if(mode==='admin'&&editing===null)return <div className="match-entry-shell">
    {message&&<p className="admin-message">{message}</p>}
    <section className="recent-match-admin"><h3>Partidos existentes</h3><p>Elegí un partido para corregirlo o anularlo. Esta tarea está separada de la carga de partidos nuevos.</p>{[...games].sort((a,b)=>b.date.localeCompare(a.date)).map(game=><div key={game.id}><span>{new Date(`${game.date}T00:00:00`).toLocaleDateString('es-ES')}</span><strong>{game.score1}–{game.score2}</strong><button onClick={()=>edit(game)}>Editar</button><button className="danger" onClick={()=>void voidGame(game)}><Trash2/> Anular</button></div>)}</section>
  </div>;

  return <div className="match-entry-shell">
    <div className="match-entry-toolbar"><label><CalendarDays/> Fecha real del partido<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>{mode==='create'&&presets.length>0&&<label className="quick-load">Carga rápida: últimos equipos<select value="" onChange={event=>{const preset=presets.find(item=>item.id===Number(event.target.value));if(preset)loadPreset(preset);}}><option value="">Seleccionar formación…</option>{presets.map((preset,index)=><option key={preset.id} value={preset.id}>{index===0?'Última formación':`Formación #${index+1}`} · {new Date(preset.createdAt).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'})}</option>)}</select><small>La más reciente aparece primero.</small></label>}</div>
    <div className="match-pitch-entry"><TeamEditor index={0} title="Equipo Celeste" team={teams[0]} eligible={eligible} used={used} goals={goals} onGoal={(member,value)=>setGoals(current=>({...current,[key(1,member)]:value}))} unknown={goals['1:unknown']||0} onUnknown={value=>setGoals(current=>({...current,'1:unknown':value}))} onAdd={value=>addPlayer(0,value)} onGuest={()=>addGuest(0)} onRemove={member=>remove(0,member)}/><div className="match-score"><strong>{score(1)}<span>–</span>{score(2)}</strong><small>{score(1)===score(2)?'Empate':score(1)>score(2)?'Gana Celeste':'Gana Rosa'}</small></div><TeamEditor index={1} title="Equipo Rosa" team={teams[1]} eligible={eligible} used={used} goals={goals} onGoal={(member,value)=>setGoals(current=>({...current,[key(2,member)]:value}))} unknown={goals['2:unknown']||0} onUnknown={value=>setGoals(current=>({...current,'2:unknown':value}))} onAdd={value=>addPlayer(1,value)} onGuest={()=>addGuest(1)} onRemove={member=>remove(1,member)}/></div>
    <div className="match-save"><p>{message}</p>{mode==='admin'&&<button className="secondary" onClick={()=>{setEditing(null);setMessage('');}}>Cancelar edición</button>}<button onClick={()=>void save()} disabled={!date||!teams[0].length||!teams[1].length}><Save/>{editing?'Guardar corrección':'Cargar partido'}</button></div>
  </div>;
}

function TeamEditor({index,title,team,eligible,used,goals,onGoal,unknown,onUnknown,onAdd,onGuest,onRemove}:{index:number;title:string;team:Member[];eligible:Profile[];used:Set<number>;goals:Record<string,number>;onGoal:(member:Member,value:number)=>void;unknown:number;onUnknown:(value:number)=>void;onAdd:(value:string)=>void;onGuest:()=>void;onRemove:(member:Member)=>void}){return <section className={`match-half ${index?'pink':'sky'}`}><h3>{title}</h3><div className="match-add"><select value="" onChange={event=>onAdd(event.target.value)}><option value="">Agregar jugador…</option>{eligible.filter(item=>!used.has(item.id)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={onGuest}><UserRoundPlus/> Invitado</button></div><div className="match-members">{team.map(member=><div className="match-member" key={member.playerId??member.guestName}>{member.playerId?<PlayerAvatar name={member.name}/>:<span className="guest-avatar">I</span>}<span>{member.name}</span><label>Goles<input type="number" min="0" value={goals[`${index+1}:${member.playerId??`g:${member.guestName}`}`]||''} onChange={event=>onGoal(member,Math.max(0,Number(event.target.value)))}/></label><button aria-label={`Quitar ${member.name}`} onClick={()=>onRemove(member)}>×</button></div>)}</div><label className="unknown-goals"><Plus/> Goles sin autor<input type="number" min="0" value={unknown||''} onChange={event=>onUnknown(Math.max(0,Number(event.target.value)))}/></label></section>}
