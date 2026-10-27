# Tournament operations

This guide describes the administrator workflow for creating and running a
tournament edition. Sarrià and Bogatell are separate competitions: always check
the competition selector before creating a tournament or saving a match.

## Before creating an edition

Decide these values first:

- start date;
- number of weekly matchdays;
- scoring rule for the whole edition.

The interface previews the closing date assuming one matchday every seven days.
The rule belongs to the tournament and is immutable after creation, so it must
be confirmed before saving.

## Create a tournament

1. Open the intended competition.
2. Enter **Torneos**.
3. Select **Crear torneo**.
4. Review the proposed name. Numbered names advance from the most recent edition,
   but the name can be edited before creation.
5. Enter the start date.
6. Enter the number of matchdays and verify the displayed closing date.
7. Choose the scoring rule from the dropdown.
8. Select **Crear torneo** and confirm that the new edition appears first.

Available rule presets:

- **Sin regla especial**: standard three points for a win and one for a draw.
- **−1 por derrota amplia**: losing by at least three goals subtracts one point.
- **Regla acumulativa cada 3 goles**: every complete three-goal band adds one
  point to the winners and subtracts one from the losers. For example, a six-goal
  difference produces `+2/−2`.

Rule adjustments apply only to that tournament table. They do not change global
historical points, current moment, head-to-head records or another edition.
Tournament totals are allowed to become negative.

## Build teams for a tournament match

1. Open **Armar equipos** and select the open tournament. Closed editions cannot
   be selected for a new proposal.
2. Paste the WhatsApp list or choose players manually.
3. In WhatsApp mode, only names with an explicit `IN` are treated as available.
4. Review unresolved names and the detected number of places before generating.
5. Review rotation changes, team balance and leader distribution.
6. Copy the final WhatsApp-ready list or generate the teams.

Consecutive appearances reset at the start of each tournament. Normally a
player becomes eligible to yield a place after two consecutive appearances.
On matchday two only, an opening-day player with one appearance may yield to a
confirmed reserve who has not yet played. Incoming reserves retain list order;
outgoing players with equal streaks are decided by a draw.

Leader distribution begins after 40% of the scheduled matchdays when the upper
group is detached by at least three points. Its weight increases toward the end
of the tournament and can eventually take priority over a marginal rating-balance
improvement. The full leading group is distributed by count and ranking weight;
the rule is not limited to the player in first place.

Choose **Amistoso** only for a non-competitive proposal. Friendly teams are
balanced, but the proposal does not generate tournament facts or save statistics.

## Save the result

1. Open **Guardar partido jugado**.
2. Load a recent generated formation if useful, or enter both teams manually.
3. Confirm that the intended tournament is selected. The current open edition
   is the default, but a historical edition can be chosen for a correction.
4. Set the real match date.
5. Record each regular, anonymous or own goal.
6. Review the derived score and save once.
7. Wait for the visible success confirmation, then verify the match in
   **Partidos**, **Tabla** or the tournament detail.

An own goal increases the opposing team's score and keeps its author only for
audit purposes; it does not increase that player's personal goal total. Goals
without an identified scorer still count toward the team score.

The API rejects a second match with the same tournament and date. If a result
was already saved, edit that match instead of creating a duplicate.

## Read the standings

The table shows matches played, wins, draws, losses, recorded goals, standard
points, bonus/penalty events and final tournament points.

Rows are displayed by:

1. final points;
2. wins;
3. participation state and number of matches;
4. goals scored;
5. player name.

This display order helps read ties but does not invent a champion tiebreaker.
When a tournament is closed, every player tied for the highest final-points
total is considered champion. An open tournament shows leaders only: it does
not award trophies or Champion achievements.

## Closing and historical behavior

The edition is considered closed after its stored closing date. There is no
separate manual champion field: champions are calculated from the verified
matches and the tournament's own immutable rule.

If historical data must be corrected:

1. create a database snapshot;
2. edit the existing match rather than creating a replacement;
3. preserve evidence and the audit reason;
4. run `make audit` and the automated tests;
5. recheck the standings and calculated champions.

Never change a past tournament's rule to force a desired table. Correct the
underlying match evidence instead.
