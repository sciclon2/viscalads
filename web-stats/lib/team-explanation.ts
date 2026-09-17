type NamedPlayer = { name: string };

function names(players: NamedPlayer[]): string {
  return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' })
    .format(players.map((player) => player.name));
}

function teamPlacement(a: NamedPlayer[], b: NamedPlayer[]): string {
  return [
    a.length ? `${names(a)} en Celeste` : '',
    b.length ? `${names(b)} en Rosa` : '',
  ].filter(Boolean).join('; ');
}

export function playerMomentExplanation(
  strongA: NamedPlayer[],
  strongB: NamedPlayer[],
  recoveringA: NamedPlayer[],
  recoveringB: NamedPlayer[],
): string {
  const strong = [...strongA, ...strongB];
  const recovering = [...recoveringA, ...recoveringB];
  const parts: string[] = [];
  if (strong.length === 1) {
    parts.push(`${strong[0].name} llega en uno de los mejores momentos de la convocatoria y quedó ${strongA.length ? 'en Celeste' : 'en Rosa'}.`);
  } else if (strong.length > 1) {
    parts.push(`${names(strong)} llegan en muy buen momento. Quedaron así: ${teamPlacement(strongA, strongB)}.`);
  }
  if (recovering.length === 1) {
    parts.push(`${recovering[0].name} viene recuperando ritmo y quedó ${recoveringA.length ? 'en Celeste' : 'en Rosa'}, acompañado por compañeros de momento más estable.`);
  } else if (recovering.length > 1) {
    parts.push(`${names(recovering)} vienen recuperando ritmo. Quedaron así: ${teamPlacement(recoveringA, recoveringB)}, acompañados por compañeros de momento más estable.`);
  }
  return parts.join(' ') || 'No hay grandes diferencias de momento reciente, por lo que pesaron más el nivel y las posiciones.';
}
