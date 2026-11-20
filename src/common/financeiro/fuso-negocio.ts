/** Fuso de negócio padrão (Lexius — Manaus) quando a empresa não define outro. */
export const FUSO_NEGOCIO_PADRAO = 'America/Manaus';

/** Início do dia civil (00:00:00) na zona informada, como ISO UTC. */
export function inicioDiaCivilIso(dataYmd: string, timeZone: string): string {
  const [y, m, d] = dataYmd.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(utcGuess);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = tz.match(/GMT([+-]\d+)/);
  const offsetHours = match ? Number(match[1]) : -4;
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetHours * 3600_000;
  return new Date(ms).toISOString();
}

/** Interpreta string de vigência: ISO completo ou data (início do dia no fuso). */
export function parseVigenciaInstante(input: string, timeZone: string): string {
  if (input.includes('T')) return new Date(input).toISOString();
  return inicioDiaCivilIso(input.slice(0, 10), timeZone);
}

/** Data de competência YYYY-MM-DD → instante de reconhecimento (início do dia no fuso). */
export function competenciaParaInstante(dataCompetencia: string, timeZone: string): string {
  return inicioDiaCivilIso(dataCompetencia.slice(0, 10), timeZone);
}