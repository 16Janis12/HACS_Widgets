// Typed subset of the evcc `/api/state` payload. evcc adds fields over time,
// so every interface keeps an index signature — we type what the cards read
// and stay tolerant of the rest.

export type ChargeMode = 'off' | 'now' | 'minpv' | 'pv';
export type BatteryMode = 'unknown' | 'normal' | 'hold' | 'charge';

export interface EvccLoadpoint {
  title?: string;
  charging?: boolean;
  connected?: boolean;
  enabled?: boolean;
  mode?: ChargeMode;
  chargePower?: number;
  chargeCurrent?: number;
  chargeCurrents?: number[];
  phasesActive?: number;
  phasesConfigured?: number;
  chargedEnergy?: number;
  sessionEnergy?: number;
  chargeRemainingDuration?: number; // seconds
  vehicleName?: string;
  vehicleTitle?: string;
  vehicleSoc?: number;
  vehicleRange?: number;
  vehicleLimitSoc?: number;
  limitSoc?: number;
  limitEnergy?: number;
  minCurrent?: number;
  maxCurrent?: number;
  planActive?: boolean;
  planEnergy?: number;
  effectivePlanTime?: string | null;
  effectivePlanSoc?: number;
  smartCostLimit?: number | null;
  smartCostActive?: boolean;
  [key: string]: unknown;
}

export interface EvccVehicle {
  title?: string;
  minSoc?: number;
  limitSoc?: number;
  capacity?: number;
  [key: string]: unknown;
}

/**
 * Newer evcc nests meter readings under `battery`/`grid`/`pv` objects instead
 * of flat top-level keys. We keep reading the flat fields; the store flattens
 * these nested shapes back onto them (see `flattenMeters`).
 */
export interface EvccMeter {
  power?: number;
  energy?: number;
  soc?: number;
  capacity?: number;
  [key: string]: unknown;
}

export interface EvccState {
  siteTitle?: string;
  currency?: string;

  // Power flow (watts, evcc sign conventions: grid + = import, battery + = discharge)
  gridPower?: number;
  homePower?: number;
  pvPower?: number;
  batteryPower?: number;
  batterySoc?: number;
  batteryMode?: BatteryMode;
  batteryEnergy?: number;

  // Nested meter objects (newer evcc); flattened onto the fields above.
  battery?: EvccMeter;
  grid?: EvccMeter;
  pv?: EvccMeter;

  // Battery control
  bufferSoc?: number;
  bufferStartSoc?: number;
  prioritySoc?: number;
  batteryGridChargeLimit?: number | null;
  batteryDischargeControl?: boolean;

  // PV / energy
  pvEnergy?: number;
  greenShare?: number;
  greenShareHome?: number;
  greenShareLoadpoints?: number;

  // Tariffs / external control (§14a / §9)
  tariffGrid?: number;
  tariffFeedIn?: number;
  tariffCo2?: number;
  smartCostLimit?: number | null;
  smartFeedInPriorityLimit?: number | null;
  residualPower?: number;

  loadpoints?: EvccLoadpoint[];
  vehicles?: Record<string, EvccVehicle>;
  forecast?: EvccForecast;

  [key: string]: unknown;
}

/** One day's aggregate solar production forecast (energy in Wh). */
export interface SolarForecastDay {
  energy?: number;
  complete?: boolean;
}

/** A point on the solar production timeseries (`val` in watts). */
export interface SolarForecastPoint {
  ts: string;
  val: number;
}

export interface SolarForecast {
  scale?: number;
  today?: SolarForecastDay;
  tomorrow?: SolarForecastDay;
  dayAfterTomorrow?: SolarForecastDay;
  timeseries?: SolarForecastPoint[];
  [key: string]: unknown;
}

export interface EvccForecast {
  solar?: SolarForecast;
  [key: string]: unknown;
}

export interface TariffSlot {
  start: string;
  end: string;
  price?: number;
  value?: number;
}

export interface GridSession {
  created?: string;
  finished?: string | null;
  [key: string]: unknown;
}
