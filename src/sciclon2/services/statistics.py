from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations


def _record(name, stat: Counter) -> dict:
    return {"name": name, "played": stat["played"], "wins": stat["W"], "draws": stat["D"], "losses": stat["L"]}


def build_statistics(games: list[dict]) -> dict:
    players = defaultdict(Counter)
    tournaments = defaultdict(lambda: defaultdict(Counter))
    groups = {2: defaultdict(Counter), 3: defaultdict(Counter)}
    for game in games:
        if game["coverage_status"] != "verified":
            continue
        for side, team in (("1", game["team1"]), ("2", game["team2"])):
            result = "D" if game["outcome"] == "D" else ("W" if game["outcome"] == side else "L")
            for player in team:
                players[player]["played"] += 1
                players[player][result] += 1
                tournaments[game["tournament"]][player]["played"] += 1
                tournaments[game["tournament"]][player][result] += 1
            if len(team) <= 8 and max(len(game["team1"]), len(game["team2"])) <= 8:
                for size in (2, 3):
                    for group in combinations(sorted(team), size):
                        groups[size][group]["played"] += 1
                        groups[size][group][result] += 1
    return {
        "players": [_record(name, stat) for name, stat in sorted(players.items())],
        "tournaments": {
            tournament: [_record(name, stat) for name, stat in sorted(items.items())]
            for tournament, items in tournaments.items()
        },
        "pairs": [_record(list(group), stat) for group, stat in groups[2].items()],
        "trios": [_record(list(group), stat) for group, stat in groups[3].items()],
    }

