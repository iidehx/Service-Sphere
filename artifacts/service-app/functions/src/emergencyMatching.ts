export type CoarseCoordinates = { latE2: number; lngE2: number };

export type EmergencyCandidate = {
  id: string;
  name: string;
  categories: string[];
  availableForWork: boolean;
  emergencyOptIn: boolean;
  availability: string;
  availabilityUpdatedAtMs: number;
  availabilityTimezoneOffsetMinutes?: number;
  areaCoordinates?: CoarseCoordinates;
};

export type BusyJob = {
  employeeId?: string;
  status?: string;
  scheduledAt?: string;
};

const ACTIVE_STATUSES = new Set(["negotiating", "accepted"]);
export const MAX_EMERGENCY_DISTANCE_MILES = 50;

export function usableCoordinates(value: unknown): value is CoarseCoordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as CoarseCoordinates;
  return Number.isInteger(point.latE2)
    && Number.isInteger(point.lngE2)
    && point.latE2 >= -9000 && point.latE2 <= 9000
    && point.lngE2 >= -18000 && point.lngE2 <= 18000;
}

export function distanceMiles(a: CoarseCoordinates, b: CoarseCoordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians((b.latE2 - a.latE2) / 100);
  const lngDelta = radians((b.lngE2 - a.lngE2) / 100);
  const aLat = radians(a.latE2 / 100);
  const bLat = radians(b.latE2 / 100);
  const h = Math.sin(latDelta / 2) ** 2
    + Math.cos(aLat) * Math.cos(bLat) * Math.sin(lngDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function scheduleAllows(availability: string, at: Date, timezoneOffsetMinutes?: number): boolean {
  const text = availability.trim().toLowerCase();
  if (!text || Number.isNaN(at.getTime()) || !Number.isInteger(timezoneOffsetMinutes)) return false;
  const local = new Date(at.getTime() - timezoneOffsetMinutes! * 60_000);
  const day = local.getUTCDay();
  const hour = local.getUTCHours();
  if (/flexible|anytime|open availability/.test(text)) return true;
  const weekend = day === 0 || day === 6;
  if (/weekends? only/.test(text)) return weekend;
  if (/weekdays?|m-f|mon(?:day)?\s*-\s*fri(?:day)?/.test(text) && weekend) return false;
  if (/\bmornings?\b/.test(text) && !(hour >= 5 && hour < 12)) return false;
  if (/\bafternoons?\b/.test(text) && !(hour >= 12 && hour < 17)) return false;
  if (/\bevenings?\b/.test(text) && !(hour >= 17 || hour < 1)) return false;
  const range = text.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)?\s*-\s*(\d{1,2})(?::\d{2})?\s*(am|pm)/);
  if (range) {
    const to24 = (raw: string, meridiem: string | undefined) => {
      const value = Number(raw) % 12;
      return meridiem === "pm" ? value + 12 : value;
    };
    const start = to24(range[1], range[2] ?? range[4]);
    const end = to24(range[3], range[4]);
    if (!(start <= end ? hour >= start && hour <= end : hour >= start || hour <= end)) return false;
  }
  return /week|mon|tue|wed|thu|fri|sat|sun|morning|afternoon|evening|\d/.test(text);
}

export function hasScheduleConflict(providerId: string, requestedAtMs: number, jobs: BusyJob[]): boolean {
  return jobs.some((job) => {
    if (job.employeeId !== providerId || !ACTIVE_STATUSES.has(job.status ?? "")) return false;
    const existingAtMs = new Date(job.scheduledAt ?? "").getTime();
    return Number.isFinite(existingAtMs) && Math.abs(existingAtMs - requestedAtMs) < 2 * 60 * 60_000;
  });
}

export function rankEmergencyCandidates(input: {
  candidates: EmergencyCandidate[];
  jobs: BusyJob[];
  category: string;
  location: CoarseCoordinates;
  requestedAtMs: number;
  nowMs: number;
}): EmergencyCandidate[] {
  const freshnessCutoff = input.nowMs - 24 * 60 * 60_000;
  return input.candidates
    .filter((candidate) =>
      candidate.availableForWork
      && candidate.emergencyOptIn
      && candidate.availabilityUpdatedAtMs >= freshnessCutoff
      && candidate.categories.includes(input.category)
      && usableCoordinates(candidate.areaCoordinates)
      && distanceMiles(candidate.areaCoordinates, input.location) <= MAX_EMERGENCY_DISTANCE_MILES
      && scheduleAllows(candidate.availability, new Date(input.requestedAtMs), candidate.availabilityTimezoneOffsetMinutes)
      && !hasScheduleConflict(candidate.id, input.requestedAtMs, input.jobs))
    .sort((a, b) =>
      distanceMiles(a.areaCoordinates!, input.location) - distanceMiles(b.areaCoordinates!, input.location)
      || a.id.localeCompare(b.id));
}