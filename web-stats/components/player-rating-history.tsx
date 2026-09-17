'use client';

import { useMemo, useState } from 'react';
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

export function PlayerRatingHistory({
  rating,
  points,
}: {
  rating: PlayerRating;
  points: PlayerRatingPoint[];
}) {
  const [windowOption, setWindowOption] = useState<RatingHistoryWindow>('20');
  const [scale, setScale] = useState<RatingHistoryScale>('personal');
  const visible = useMemo(
    () => ratingHistoryWindow(points, windowOption),
    [points, windowOption],
  );
  if (!visible.length) return null;

  const width = 720, height = 260, left = 45, right = 18, top = 20, bottom = 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const domain = ratingHistoryDomain(rating.min, rating.max, scale);
  const ticks = Array.from({ length: 5 }, (_, index) =>
    domain.min + ((domain.max - domain.min) * index) / 4,
  );
  const x = (index: number) => left + (visible.length === 1 ? plotWidth / 2 : index * plotWidth / (visible.length - 1));
  const y = (value: number) => top + ((domain.max - value) / (domain.max - domain.min)) * plotHeight;
  const plottedValue = (value: number) => ratingHistoryValue(value, rating.min, rating.max, scale);
  const path = visible.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(plottedValue(point.current))}`).join(' ');
  const change = visible.at(-1)!.current - visible[0].current;
  const trend = Math.abs(change) < 0.05 ? 'estable' : change > 0 ? 'subiendo' : 'bajando';

  return (
    <section className="player-rating-history">
      <header>
        <span>
          <strong>Evolución del nivel</strong>
          <small>{visible.length} fechas · tendencia {trend}</small>
        </span>
        <select
          aria-label="Período de evolución"
          value={windowOption}
          onChange={(event) => setWindowOption(event.target.value as RatingHistoryWindow)}
        >
          <option value="20">Últimas 20 fechas</option>
          <option value="year">Último año</option>
          <option value="all">Todo el historial</option>
        </select>
      </header>
      <div className="rating-history-scale" aria-label="Escala del gráfico">
        <button type="button" className={scale === 'personal' ? 'active' : ''} onClick={() => setScale('personal')}>
          Escala personal 0–10
        </button>
        <button type="button" className={scale === 'global' ? 'active' : ''} onClick={() => setScale('global')}>
          Escala 1–10
        </button>
      </div>
      <div className="player-rating-chart-scroll">
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
                <title>{`${dateLabel(point.date)} · ${point.tournament}\n${resultText} · ${score}\nNivel ${point.current.toFixed(2)} · Escala personal ${plottedValue(point.current).toFixed(1)}/10 · Momento ${Math.round(point.formScore * 100)}%\n${point.recentMatches}/10 partidos válidos${point.absencePenalty ? ` · penalización por ${point.missedMatches} ausencias` : ''}`}</title>
              </circle>
            );
          })}
          <text x={left} y={height - 14}>{dateLabel(visible[0].date)}</text>
          <text x={width - right} y={height - 14} textAnchor="end">{dateLabel(visible.at(-1)!.date)}</text>
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
}
