# NKOS Lab

Interfaz local para consultar el historial reconstruido de partidos.

Consultas incluidas: armador de equipos, forma actual, ranking por efectividad, tabla de puntos, porcentaje de derrotas, compañeros, rivales y némesis, duplas, ternas, rendimiento por torneo, prime por bloques, historial de partidos, récords, cobertura y palmarés.

## Abrir la web

```bash
cd web-stats
pnpm dev
```

Luego abrir `http://localhost:3000`.

## Actualizar los datos

SQLite (`data/sciclon2.sqlite3`) es la fuente operativa. Para regenerar el JSON después de un cambio validado:

```bash
make audit export
```

Los CSV históricos fueron retirados. No existe ningún flujo de reconstrucción que pueda sobrescribir SQLite.

## Agregar consultas

1. Registrar nombre, descripción y filtros en `lib/query-catalog.ts`.
2. Añadir el adaptador de datos en `app/page.tsx`.
3. Si hacen falta datos derivados nuevos, extender `scripts/build-data.py`.

El generador excluye el evento multiequipo de los cálculos de duplas y ternas, ya que sus participantes no forman dos equipos comparables.

## Datos del armador

- `data/sciclon2.sqlite3`: jugadores, alias, posiciones, partidos, alineaciones, torneos y evidencia.
- `lib/stats-data.json`: archivo generado desde SQLite que combina perfiles, partidos y estadísticas.
- `components/team-builder.tsx`: selección, drag & drop, balance y representación de la cancha.

El balanceador usa la efectividad de los últimos 10 partidos y compara la cobertura de defensa, mediocampo y delantera. La posición alternativa aporta flexibilidad con un peso menor que la principal.
