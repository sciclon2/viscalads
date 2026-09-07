export type Role = 'POR' | 'DEF' | 'MED' | 'DEL';

export type FormationPlayer = {
  name: string;
  primary: string;
  alternate?: string;
};

export type Formation = {
  roles: Record<string, Role>;
  counts: Record<Role, number>;
  valid: boolean;
  alternateUses: number;
};

export function positionRole(position: string): Role {
  const text = position.toLowerCase();
  if (text.includes('portero')) return 'POR';
  if (text.includes('defen')) return 'DEF';
  if (text.includes('medio')) return 'MED';
  return 'DEL';
}

export function bestFormation(team: FormationPlayer[]): Formation {
  let best: Formation | null = null;
  let bestPenalty = Infinity;
  const roles: Record<string, Role> = {};
  const walk = (index: number, alternateUses: number) => {
    if (index < team.length) {
      const player = team[index];
      if (!player.primary.trim()) {
        (['DEF', 'MED', 'DEL'] as Role[]).forEach((choice) => {
          roles[player.name] = choice;
          walk(index + 1, alternateUses);
        });
        return;
      }
      const primary = positionRole(player.primary);
      const options = [
        primary,
        ...(player.alternate ? [positionRole(player.alternate)] : []),
      ].filter((value, optionIndex, all) => all.indexOf(value) === optionIndex);
      options.forEach((choice) => {
        roles[player.name] = choice;
        walk(index + 1, alternateUses + (choice === primary ? 0 : 1));
      });
      return;
    }
    const counts = Object.values(roles).reduce(
      (result, value) => {
        result[value]++;
        return result;
      },
      { POR: 0, DEF: 0, MED: 0, DEL: 0 },
    );
    const valid =
      counts.POR <= 1 &&
      (team.length === 5
        ? counts.DEF >= 1 &&
          counts.DEF <= 2 &&
          counts.DEL >= 1 &&
          counts.DEL <= 2 &&
          counts.MED >= 1
        : team.length === 6
          ? counts.DEF === 2 &&
            counts.DEL >= 1 &&
            counts.DEL <= 2 &&
            counts.MED >= 2
          : team.length === 8
            ? counts.DEF === 3 &&
              counts.MED >= 3 &&
              counts.DEL >= 1 &&
              counts.DEL <= 2
            : true);
    const target = {
      DEF:
        team.length === 8
          ? 3
          : team.length >= 5
            ? 2
            : Math.max(1, Math.round(team.length * 0.3)),
      DEL:
        team.length === 8
          ? 1
          : Math.min(2, Math.max(1, Math.round(team.length * 0.25))),
    };
    const penalty =
      (valid ? 0 : 1000) +
      alternateUses * 0.2 +
      Math.abs(counts.DEF - target.DEF) +
      Math.abs(counts.DEL - target.DEL);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = { roles: { ...roles }, counts, valid, alternateUses };
    }
  };
  walk(0, 0);
  return best!;
}

export function pitchPosition(
  role: Role,
  index: number,
  count: number,
  side: 'a' | 'b',
) {
  const x =
    side === 'a'
      ? { POR: 7, DEF: 16, MED: 30, DEL: 43 }[role]
      : { POR: 93, DEF: 84, MED: 70, DEL: 57 }[role];
  const singletonY = { POR: 50, DEF: 35, MED: 65, DEL: 50 }[role];
  return { x, y: count === 1 ? singletonY : ((index + 1) / (count + 1)) * 100 };
}
