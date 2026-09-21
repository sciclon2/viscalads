'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { PlayerRating, PlayerRatingPoint } from '@/lib/stats-context';
import {
  ratingHistoryDomain,
  ratingHistoryValue,
  ratingHistoryWindow,
  type RatingHistoryScale,
  type RatingHistoryWindow,
} from '@/lib/rating-history';

const RESULT_LABEL = { W: 'Victoria', D: 'Empate', L: 'Derrota' } as const;
const RESULT_COLOR = { W: '#168447', D: '#d18b00', L: '#c62828' } as const;

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function shortDateLabel(value: string) {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

function shortTournamentLabel(value: string) {
  const match = value.match(/^T\d+/i);
  return match?.[0] ?? value.replace(/^SARRIA-/i, 'T');
}

export function PlayerRatingHistory({
  rating,
  points,
}: {
  rating: PlayerRating;
  points: PlayerRatingPoint[];
}) {
  const [windowOption, setWindowOption] = useState<RatingHistoryWindow>('20');
  const [scale, setScale] = useState<RatingHistoryScale>('personal');
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(
    () => ratingHistoryWindow(points, windowOption),
    [points, windowOption],
  );
  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
    };
    document.addEventListener('keydown', closeOnEscape, true);
    document.body.classList.add('rating-history-open');
    return () => {
      document.removeEventListener('keydown', closeOnEscape, true);
      document.body.classList.remove('rating-history-open');
    };
  }, [expanded]);

  if (!visible.length) return null;

  const width = 720, height = 260, left = 45, right = 18, top = 20, bottom = expanded ? 62 : 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const domain = ratingHistoryDomain(rating.min, rating.max, scale);
  const ticks = Array.from({ length: 5 }, (_, index) =>
    domain.min + ((domain.max - domain.min) * index) / 4,
  );
  const x = (index: number) => left + (visible.length === 1 ? plotWidth / 2 : index * plotWidth / (visible.length - 1));
  const y = (value: number) => top + ((domain.max - value) / (domain.max - domain.min)) * plotHeight;
  const plottedValue = (value: number) => ratingHistoryValue(value, rating.min, rating.max, scale);
  const path = visible.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(plottedValue(point.current))}`).join(' ');
  const labelStep = Math.max(1, Math.ceil((visible.length - 1) / 8));
  const labeledIndexes = new Set([
    ...visible.map((_, index) => index).filter((index) => index % labelStep === 0),
    visible.length - 1,
  ]);
  const change = visible.at(-1)!.current - visible[0].current;
  const trend = Math.abs(change) < 0.05 ? 'estable' : change > 0 ? 'subiendo' : 'bajando';

  const chart = (
    <section className={`player-rating-history${expanded ? ' is-expanded' : ''}`}>
      <header>
        <span>
          <strong>Evolución del nivel</strong>
          <small>{visible.length} fechas · tendencia {trend}</small>
        </span>
        <div className="rating-history-actions">
          <select
            aria-label="Período de evolución"
            value={windowOption}
            onChange={(event) => setWindowOption(event.target.value as RatingHistoryWindow)}
          >
            <option value="20">Últimas 20 fechas</option>
            <option value="year">Último año</option>
            <option value="all">Todo el historial</option>
          </select>
          <button type="button" className="rating-history-expand" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Reducir gráfico' : 'Ampliar gráfico'} title={expanded ? 'Reducir gráfico' : 'Ver gráfico grande'}>
            {expanded ? <Minimize2 /> : <Maximize2 />}
            <span>{expanded ? 'Reducir' : 'Ampliar'}</span>
          </button>
        </div>
      </header>
      <div className="rating-history-scale" aria-label="Escala del gráfico">
        <button type="button" className={scale === 'personal' ? 'active' : ''} onClick={() => setScale('personal')}>
          Escala personal 0–10
        </button>
        <button type="button" className={scale === 'global' ? 'active' : ''} onClick={() => setScale('global')}>
          Escala 1–10
        </button>
      </div>
      <div className="player-rating-chart-scroll" onDoubleClick={() => setExpanded(true)} title={expanded ? undefined : 'Doble clic para ampliar'}>
        <svg viewBox={`0 0 ${width} ${height}`} aria-label="Evolución histórica del nivel actual">
          <rect
            x={left}
            y={scale === 'personal' ? y(10) : y(rating.max)}
            width={plotWidth}
            height={scale === 'personal' ? y(0) - y(10) : y(rating.min) - y(rating.max)}
            className="rating-history-band"
          />
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="rating-history-grid" />
              <text x={left - 10} y={y(tick) + 4} textAnchor="end">{tick.toFixed(tick % 1 ? 1 : 0)}</text>
            </g>
          ))}
          {visible.map((point, index) => index > 0 && point.tournament !== visible[index - 1].tournament ? (
            <line key={`${point.date}-tournament`} x1={x(index)} x2={x(index)} y1={top} y2={height - bottom} className="rating-history-tournament" />
          ) : null)}
          <path d={path} className="rating-history-line" />
          {visible.map((point, index) => {
            const resultText = point.result ? RESULT_LABEL[point.result] : 'No participó';
            const score = point.score1 === null || point.score2 === null ? 'sin marcador' : `${point.score1}–${point.score2}`;
            return (
              <circle
                key={`${point.date}-${index}`}
                cx={x(index)} cy={y(plottedValue(point.current))} r={point.participated ? 5 : 3.5}
                fill={point.result ? RESULT_COLOR[point.result] : '#fff'}
                stroke={point.result ? RESULT_COLOR[point.result] : '#89978f'} strokeWidth="2"
              >
                <title>{`${dateLabel(point.date)} · ${point.tournament}\n${resultText} · ${score}\n${point.stale ? 'Momento sin vigencia por inactividad' : `Nivel ${point.current.toFixed(2)} · Escala personal ${plottedValue(point.current).toFixed(1)}/10 · Momento ${Math.round(point.formScore * 100)}%`}\n${point.recentMatches}/10 partidos válidos${point.absencePenalty ? ` · penalización por ${point.missedMatches} ausencias` : ''}`}</title>
              </circle>
            );
          })}
          {expanded ? visible.map((point, index) => labeledIndexes.has(index) ? (
            <text key={`${point.date}-label`} x={x(index)} y={height - 32} textAnchor={index === 0 ? 'start' : index === visible.length - 1 ? 'end' : 'middle'} className="rating-history-x-label">
              <tspan x={x(index)} dy="0">{shortDateLabel(point.date)}</tspan>
              <tspan x={x(index)} dy="13">{shortTournamentLabel(point.tournament)}</tspan>
            </text>
          ) : null) : (
            <>
              <text x={left} y={height - 14}>{dateLabel(visible[0].date)}</text>
              <text x={width - right} y={height - 14} textAnchor="end">{dateLabel(visible.at(-1)!.date)}</text>
            </>
          )}
        </svg>
      </div>
      <footer>
        <span><i className="history-win" />Victoria</span>
        <span><i className="history-draw" />Empate</span>
        <span><i className="history-loss" />Derrota</span>
        <span><i className="history-absence" />Ausencia</span>
      </footer>
    </section>
  );
  return expanded
    ? createPortal(
        <>
          <button type="button" className="rating-history-backdrop" aria-label="Cerrar gráfico ampliado" onClick={() => setExpanded(false)} />
          {chart}
        </>,
        document.body,
      )
    : chart;
}
