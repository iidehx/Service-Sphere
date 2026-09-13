import type { AreaCoordinates, Job, JobFitFilters, SessionUser } from '../context/types.ts';

export type ScheduleFit = 'match' | 'mismatch' | 'unknown';

export type JobFitResult = {
  jobs: Job[];
  missingDistanceCount: number;
  unknownScheduleCount: number;
};

export function getProviderBrowseJobs(jobs: Job[], provider: SessionUser): Job[] {
  if (provider.role !== 'provider') return [];
  return jobs.filter(
    (job) =>
      job.status === 'open'
      && job.employerId !== provider.id
      && !provider.blockedUserIds.includes(job.employerId),
  );
}

export function isUsableCoordinates(value: AreaCoordinates | undefined): value is AreaCoordinates {
  return Boolean(
    value
      && Number.isInteger(value.latE2)
      && Number.isInteger(value.lngE2)
      && value.latE2 >= -9000
      && value.latE2 <= 9000
      && value.lngE2 >= -18000
      && value.lngE2 <= 18000,
  );
}

export function distanceMiles(a: AreaCoordinates, b: AreaCoordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians((b.latE2 - a.latE2) / 100);
  const lngDelta = toRadians((b.lngE2 - a.lngE2) / 100);
  const aLat = toRadians(a.latE2 / 100);
  const bLat = toRadians(b.latE2 / 100);
  const haversine =
    Math.sin(latDelta / 2) ** 2
    + Math.cos(aLat) * Math.cos(bLat) * Math.sin(lngDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function providerAllowsDay(availability: string, day: number): boolean | null {
  const text = availability.toLowerCase();
  if (/flexible|any(?:time|\s+day)?|open availability/.test(text)) return true;
  if (/weekends? only|weekends?/.test(text) && !/weekday/.test(text)) return day === 0 || day === 6;
  if (/weekdays?|m-f|mon(?:day)?\s*-\s*fri(?:day)?/.test(text)) return day >= 1 && day <= 5;

  const tokens: Array<[RegExp, number]> = [
    [/\b(?:sun|sunday)\b/, 0],
    [/\b(?:m|mon|monday)\b/, 1],
    [/\b(?:tu|tue|tues|tuesday)\b/, 2],
    [/\b(?:w|wed|wednesday)\b/, 3],
    [/\b(?:th|thu|thur|thurs|thursday)\b/, 4],
    [/\b(?:f|fri|friday)\b/, 5],
    [/\b(?:sa|sat|saturday)\b/, 6],
  ];
  const mentioned = tokens.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
  return mentioned.length > 0 ? mentioned.includes(day) : null;
}

function providerAllowsHour(availability: string, hour: number): boolean | null {
  const text = availability.toLowerCase();
  if (/flexible|anytime|open availability/.test(text)) return true;
  if (/\bmornings?\b/.test(text)) return hour >= 5 && hour < 12;
  if (/\bafternoons?\b/.test(text)) return hour >= 12 && hour < 17;
  if (/\bevenings?\b/.test(text)) return hour >= 17 || hour < 1;

  const range = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!range) return null;
  const to24Hour = (rawHour: string, meridiem: string | undefined) => {
    const parsed = Number(rawHour) % 12;
    return meridiem === 'pm' ? parsed + 12 : parsed;
  };
  const start = to24Hour(range[1], range[3] ?? range[6]);
  const end = to24Hour(range[4], range[6]);
  return start <= end ? hour >= start && hour <= end : hour >= start || hour <= end;
}

export function scheduleFit(job: Pick<Job, 'leaveTimeToEmployee' | 'scheduledAt'>, availability: string): ScheduleFit {
  if (job.leaveTimeToEmployee) return 'match';
  const date = new Date(job.scheduledAt);
  if (Number.isNaN(date.getTime()) || !availability.trim()) return 'unknown';
  const normalized = availability.toLowerCase();
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isEvening = date.getHours() >= 17 || date.getHours() < 1;
  // Natural-language profiles such as "Evenings and Weekends" are additive:
  // either window is available. "Weekends only" remains a strict restriction.
  if (/evenings?/.test(normalized) && /weekends?/.test(normalized) && !/\bonly\b/.test(normalized)) {
    return isEvening || isWeekend ? 'match' : 'mismatch';
  }
  const dayMatch = providerAllowsDay(availability, date.getDay());
  const hourMatch = providerAllowsHour(availability, date.getHours());
  if (dayMatch === false || hourMatch === false) return 'mismatch';
  if (dayMatch === true || hourMatch === true) return 'match';
  return 'unknown';
}

export function filterJobsByFit(jobs: Job[], provider: SessionUser, filters: JobFitFilters): JobFitResult {
  let missingDistanceCount = 0;
  let unknownScheduleCount = 0;
  const filtered = jobs.filter((job) => {
    if (filters.category && job.category !== filters.category) return false;

    if (filters.workTimeFit) {
      const fit = scheduleFit(job, provider.availability ?? '');
      if (fit === 'mismatch') return false;
      if (fit === 'unknown') unknownScheduleCount += 1;
    }

    if (filters.maxDistanceMiles !== null) {
      if (!isUsableCoordinates(provider.areaCoordinates) || !isUsableCoordinates(job.areaCoordinates)) {
        missingDistanceCount += 1;
        return false;
      }
      if (distanceMiles(provider.areaCoordinates, job.areaCoordinates) > filters.maxDistanceMiles) return false;
    }
    return true;
  });
  return { jobs: filtered, missingDistanceCount, unknownScheduleCount };
}