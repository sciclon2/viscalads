import data from '@/lib/stats-data.json';
import StatsDashboard from '@/components/stats-dashboard';

type CompetitionId = keyof typeof data.competitionStats;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const requested = (await searchParams).competition;
  const competition = data.competitions.some((item) => item.slug === requested)
    ? (requested as CompetitionId)
    : null;

  if (competition) {
    return <StatsDashboard initialCompetition={competition} />;
  }

  return (
    <main className="welcome-page">
      <div className="welcome-glow" aria-hidden="true" />
      <section className="welcome-shell">
        <div className="welcome-heading">
          <div className="welcome-ball" aria-hidden="true">⚽</div>
          <p>Fútbol · amigos · estadísticas</p>
          <h1>Bienvenido a <span>Viscalads</span></h1>
          <p className="welcome-intro">Elegí dónde jugás y entrá al historial.</p>
        </div>

        <div className="competition-grid">
          <CompetitionCard
            name="Bogatell"
            schedule="Sábados"
            image="/competitions/bogatell.jpg"
            imagePosition="center 48%"
            games={data.competitionStats.bogatell.games.length}
            href="/?competition=bogatell"
          />
          <CompetitionCard
            name="Sarrià"
            schedule="Miércoles"
            image="/competitions/sarria.jpg"
            imagePosition="center 63%"
            games={data.competitionStats.sarria.games.length}
            href="/?competition=sarria"
          />
        </div>
      </section>
    </main>
  );
}

function CompetitionCard({
  name,
  schedule,
  image,
  imagePosition,
  games,
  href,
}: {
  name: string;
  schedule: string;
  image: string;
  imagePosition: string;
  games: number;
  href: string;
}) {
  return (
    <a
      href={href}
      className="competition-card"
      aria-label={`Entrar a ${name}, partidos de los ${schedule.toLowerCase()}`}
    >
      <img src={image} alt={`Jugadores de ${name}`} style={{ objectPosition: imagePosition }} />
      <span className="competition-shade" aria-hidden="true" />
      <span className="competition-copy">
        <span className="competition-day">▣ {schedule}</span>
        <strong>{name}</strong>
        <span className="competition-meta">{games} partidos registrados</span>
        <span className="competition-action">Ver estadísticas →</span>
      </span>
    </a>
  );
}
