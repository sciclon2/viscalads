# NKOS Lab

Interfaz local para consultar el historial reconstruido de partidos de Sarrià y Bogatell sin mezclar sus estadísticas. La portada permite elegir la competición antes de entrar al dashboard.

Consultas incluidas: armador de equipos, forma actual, ranking por efectividad, tabla de puntos, porcentaje de derrotas, compañeros, rivales y némesis, duplas, ternas, rendimiento por torneo, prime por bloques, historial de partidos, récords, cobertura y palmarés. La sección **Torneos** muestra las ediciones de la competencia desde la más reciente, permite abrir sus partidos y crear la siguiente edición indicando fecha inicial y cantidad de fechas.

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
2. Añadir el adaptador de datos en `components/stats-dashboard.tsx`.
3. Si hacen falta datos derivados nuevos, extender `scripts/build-data.py`.

`app/page.tsx` es la entrada y portada: valida la competición solicitada y monta el dashboard correspondiente. La lógica interactiva de estadísticas vive en `components/stats-dashboard.tsx`.

El generador excluye el evento multiequipo de los cálculos de duplas y ternas, ya que sus participantes no forman dos equipos comparables.

## Datos del armador

- `data/sciclon2.sqlite3`: jugadores, alias, posiciones, partidos, alineaciones, torneos y evidencia.
- `lib/stats-data.json`: archivo generado desde SQLite que combina perfiles, partidos y estadísticas.
- `lib/team-balancer.ts`: algoritmo puro y testeable de nivel, formación, porteros y química.
- `components/team-builder.tsx`: selección, drag & drop, representación de la cancha y explicación humana del resultado.

El balanceador no persiste cálculos paralelos: recibe los niveles específicos de la competición derivados de SQLite, las posiciones del perfil y los partidos verificados. Prioriza la diferencia de nivel actual, exige formaciones válidas cuando la convocatoria lo permite y penaliza el uso innecesario de posiciones alternativas.

Si hay dos o más porteros, el algoritmo exige que ambos equipos reciban al menos uno y no aplica bonus. Si solo hay uno, añade al total de su equipo un 10% del nivel de ese portero y compensa la ventaja al buscar la división. La química se calcula dinámicamente con los mismos partidos verificados: una dupla necesita al menos cinco partidos compartidos, su influencia se reduce cuando la muestra es pequeña y queda limitada para que nunca domine al nivel o a la formación.

Las pruebas del balanceador se ejecutan con `pnpm test` y cubren reparto de porteros, bonus único, muestra mínima de química y convocatorias inválidas.

Los invitados del armador son temporales: requieren un nivel manual entre 1 y 10 y admiten una posición opcional. Sin posición se consideran flexibles. Participan del mismo cálculo de balance, pero no se insertan como jugadores ni acumulan estadísticas. La alineación sí se conserva entre los últimos cinco accesos rápidos, incluyendo el nombre temporal, nivel y posición del invitado.

En la carga de partidos, los goles de un invitado se asignan a su participante temporal mediante `match_goals.guest_id`. Suman al marcador y a las estadísticas generales de goles del partido, pero nunca a un jugador. Los goles sin autor no se ofrecen para partidos nuevos; solo se conservan al editar registros históricos que ya carecen de goleadores identificados.
