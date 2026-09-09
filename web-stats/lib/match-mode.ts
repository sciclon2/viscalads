export const FRIENDLY_MODE = '__friendly__';

export function isFriendlyMode(selection: string): boolean {
  return selection === FRIENDLY_MODE;
}

export function isBuilderSelectionAvailable(
  selection: string,
  openTournamentNames: string[],
): boolean {
  return isFriendlyMode(selection) || openTournamentNames.includes(selection);
}

export function persistsCompetitiveData(selection: string): boolean {
  return !isFriendlyMode(selection);
}
