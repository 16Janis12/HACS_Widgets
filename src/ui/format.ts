// Presentation helpers. All return { value, unit } so cards can render the
// number large and the unit small/muted for an editorial numeric treatment.

export interface Measure {
  value: string;
  unit: string;
}

export function power(watts: number | undefined): Measure {
  const w = watts ?? 0;
  const abs = Math.abs(w);
  if (abs >= 1000) {
    const kw = w / 1000;
    return { value: kw.toFixed(kw >= 10 ? 1 : 2), unit: 'kW' };
  }
  return { value: Math.round(w).toString(), unit: 'W' };
}

export function energy(kWh: number | undefined): Measure {
  const v = kWh ?? 0;
  if (Math.abs(v) >= 1000) return { value: (v / 1000).toFixed(1), unit: 'MWh' };
  return { value: v.toFixed(v < 10 ? 2 : 1), unit: 'kWh' };
}

export function percent(v: number | undefined): string {
  return `${Math.round(v ?? 0)}`;
}

export function current(a: number | undefined): Measure {
  return { value: (a ?? 0).toFixed(a && a % 1 ? 1 : 0), unit: 'A' };
}

export function price(v: number | undefined, currency = 'EUR'): string {
  if (v == null) return '–';
  const symbol = currency === 'EUR' ? '¢' : currency;
  // evcc tariffs are in currency/kWh; show ct/kWh for readability.
  return `${(v * 100).toFixed(1)} ${symbol}`;
}

export function duration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
