import {
  Activity,
  Crown,
  Goal,
  MapPin,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type QueryId =
  | 'venues'
  | 'players'
  | 'points'
  | 'losses'
  | 'form'
  | 'decisive'
  | 'jinx'
  | 'partners'
  | 'rivals'
  | 'pairs'
  | 'trios'
  | 'tournaments'
  | 'prime'
  | 'matches'
  | 'records'
  | 'coverage'
  | 'champions';
export type QueryDefinition = {
  id: QueryId;
  label: string;
  description: string;
  details: string;
  icon: LucideIcon;
  needsPlayer?: boolean;
  supportsMinimum?: boolean;
  supportsOrder?: boolean;
  supportsMetric?: boolean;
  supportsWindow?: boolean;
};

// Extensión futura: registrar aquí la consulta y añadir su adaptador en la página.
export const queryCatalog: QueryDefinition[] = [
  {
    id: 'venues',
    label: 'Canchas',
    description: 'Dónde jugamos y todo lo que conviene saber antes de ir.',
    details:
      'Reúne las sedes habituales y alternativas de cada grupo. Los horarios y contactos proceden de páginas públicas; las recomendaciones y anécdotas son aportes del grupo.',
    icon: MapPin,
  },
  {
    id: 'players',
    label: 'Ranking de momento actual',
    description: 'Jugadores ordenados por su nivel actual dentro de su rango.',
    details:
      'Ordena por el nivel actual de cada jugador. Ese valor se mueve dentro de su rango según hasta los últimos 10 partidos de esta competición en 90 días; todos pesan igual. Con menos de 5 partidos, queda en el punto medio del rango.',
    icon: Activity,
    supportsMinimum: true,
    supportsOrder: true,
  },
  {
    id: 'points',
    label: 'Tabla de puntos',
    description: 'Clasificación: 3 por victoria y 1 por empate.',
    details:
      'Suma todos los puntos de cada jugador: victorias × 3 más empates. Premia tanto el rendimiento como la cantidad jugada.',
    icon: Activity,
    supportsMinimum: true,
    supportsOrder: true,
  },
  {
    id: 'losses',
    label: '% de derrotas',
    description: 'Quién pierde proporcionalmente más o menos.',
    details:
      'Divide las derrotas por los partidos jugados. El filtro de PJ ayuda a evitar conclusiones por muestras pequeñas.',
    icon: Activity,
    supportsMinimum: true,
    supportsOrder: true,
  },
  {
    id: 'form',
    label: 'Nivel actual',
    description: 'El nivel dinámico que usamos para equilibrar los equipos.',
    details:
      'Usa como máximo los últimos 10 partidos jugados dentro de los últimos 90 días. Todos pesan igual: una victoria vale 1, un empate 0,5 y una derrota 0. Si hay entre 5 y 9 partidos, los lugares restantes son neutrales (0,5); con menos de 5, el jugador queda en el punto medio de su rango.',
    icon: Activity,
    supportsMinimum: true,
    supportsOrder: true,
  },
  {
    id: 'decisive',
    label: 'Jugador más decisivo',
    description:
      'Cuánto mejora el rendimiento de sus compañeros cuando juega con ellos.',
    details:
      'Compara la efectividad de sus compañeros cuando comparten equipo con él contra la efectividad de esos mismos compañeros cuando juegan sin él. La diferencia se muestra en puntos porcentuales.',
    icon: Sparkles,
    supportsMinimum: true,
    supportsOrder: true,
  },
  {
    id: 'jinx',
    label: 'Mufa colectiva',
    description: 'Quién hace rendir peor a sus compañeros.',
    details:
      'Para cada jugador calcula, compañero por compañero, la diferencia entre la efectividad jugando con él y jugando sin él; después promedia esas diferencias dando el mismo peso a cada compañero. Solo cuentan compañeros con al menos 5 partidos juntos y 5 sin él, y partidos con hasta 8 jugadores por equipo. Impacto negativo = mayor mufa. El filtro PJ se aplica al jugador analizado.',
    icon: Users,
    supportsMinimum: true,
  },
  {
    id: 'partners',
    label: 'Compañeros de un jugador',
    description: 'Quién potencia o hunde a quién.',
    details:
      'Agrupa los partidos en los que el jugador elegido compartió equipo con cada compañero y calcula el resultado de esa dupla.',
    icon: Users,
    needsPlayer: true,
    supportsMinimum: true,
    supportsOrder: true,
    supportsMetric: true,
  },
  {
    id: 'rivals',
    label: 'Rivales y némesis',
    description: 'Rendimiento cuando estuvieron enfrentados.',
    details:
      'Cuenta los resultados del jugador elegido en los partidos en los que cada persona estuvo en el equipo contrario.',
    icon: Users,
    needsPlayer: true,
    supportsMinimum: true,
    supportsOrder: true,
  },
  {
    id: 'pairs',
    label: 'Duplas',
    description: 'Las sociedades más eficaces.',
    details:
      'Agrupa cada pareja que compartió equipo y calcula sus partidos, victorias, empates, derrotas, puntos y efectividad conjunta.',
    icon: Sparkles,
    supportsMinimum: true,
    supportsOrder: true,
    supportsMetric: true,
  },
  {
    id: 'trios',
    label: 'Ternas',
    description: 'Tridentes con química comprobada.',
    details:
      'Hace el mismo cálculo que las duplas, pero para cada combinación de tres jugadores que compartió equipo.',
    icon: Goal,
    supportsMinimum: true,
    supportsOrder: true,
    supportsMetric: true,
  },
  {
    id: 'tournaments',
    label: 'Aporte por torneo',
    description: 'Dónde obtuvo sus puntos y en qué torneo rindió mejor.',
    details:
      'Muestra dos medidas distintas. Aporte al total = puntos obtenidos en ese torneo divididos por todos los puntos históricos del jugador dentro de esta competición. Efectividad del torneo = puntos obtenidos divididos por el máximo posible en los partidos que jugó allí. El aporte señala dónde acumuló sus puntos; la efectividad señala dónde rindió mejor, sin favorecer automáticamente al torneo más largo.',
    icon: Activity,
    needsPlayer: true,
    supportsOrder: true,
  },
  {
    id: 'prime',
    label: 'Prime de un jugador',
    description: 'Mejores bloques sostenidos de rendimiento.',
    details:
      'Busca las mejores ventanas consecutivas de 5, 8, 10 y 12 partidos del jugador, priorizando puntos y luego victorias.',
    icon: Sparkles,
    needsPlayer: true,
    supportsOrder: true,
  },
  {
    id: 'matches',
    label: 'Partidos de un jugador',
    description: 'Equipos, fechas y marcadores del historial.',
    details:
      'Muestra cronológicamente todos los partidos asociados al jugador, incluidos equipos, torneo, marcador y estado de verificación.',
    icon: Goal,
    needsPlayer: true,
  },
  {
    id: 'records',
    label: 'Récords y funny facts',
    description: 'Goleadas, festivales y marcadores repetidos.',
    details:
      'Usa solamente los partidos con marcador exacto para buscar goles totales, mayores diferencias y resultados frecuentes.',
    icon: Goal,
  },
  {
    id: 'coverage',
    label: 'Cobertura',
    description: 'Qué está confirmado y qué sigue pendiente.',
    details:
      'Resume cuántos partidos tienen equipos y ganador confirmados, cuántos conservan marcador exacto y cuántos siguen pendientes.',
    icon: Activity,
  },
  {
    id: 'champions',
    label: 'Palmarés',
    description: 'Campeones proclamados en el chat.',
    details:
      'Lista los ganadores de cada torneo según las proclamaciones reconstruidas del historial del grupo.',
    icon: Crown,
  },
];
