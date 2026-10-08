import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distanceMiles,
  filterJobsByFit,
  getProviderBrowseJobs,
  isUsableCoordinates,
  scheduleFit,
} from '../lib/jobFit.ts';

const EMPTY_JOB_FIT_FILTERS = {
  category: null,
  maxDistanceMiles: null,
  workTimeFit: false,
  criteria: {},
};

const provider = {
  id: 'provider',
  role: 'provider',
  availability: 'M-F 8am-6pm',
  areaCoordinates: { latE2: 3027, lngE2: -9774 },
  blockedUserIds: [],
};

const job = (overrides = {}) => ({
  id: 'job',
  title: 'Test job',
  category: 'Cleaning',
  details: '',
  specialRequirements: '',
  priceOffer: 100,
  employerId: 'employer',
  employerName: 'Employer',
  status: 'open',
  // Local time (no `Z`): scheduleFit compares device-local hours, so a UTC
  // timestamp would make results depend on the machine's timezone.
  scheduledAt: '2026-09-14T18:00:00',
  location: 'Austin',
  leaveTimeToEmployee: false,
  paymentStatus: 'pending',
  reviewedBy: [],
  createdAtMs: 1,
  areaCoordinates: { latE2: 3024, lngE2: -9777 },
  ...overrides,
});

test('distance uses valid coordinates and rejects invalid coordinate records', () => {
  assert.ok(distanceMiles(provider.areaCoordinates, job().areaCoordinates) < 5);
  assert.equal(isUsableCoordinates({ latE2: 9100, lngE2: 0 }), false);
  assert.equal(isUsableCoordinates(undefined), false);
});

test('schedule boundaries, flexible jobs, and legacy schedules are handled safely', () => {
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-14T13:00:00' }), provider.availability), 'match');
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-14T18:00:00' }), provider.availability), 'match');
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-14T19:00:00' }), provider.availability), 'mismatch');
  assert.equal(scheduleFit(job({ leaveTimeToEmployee: true }), provider.availability), 'match');
  assert.equal(scheduleFit(job({ scheduledAt: 'Tomorrow morning' }), provider.availability), 'unknown');
});

test('combined evenings and weekends availability is additive', () => {
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-14T19:00:00' }), 'Evenings and Weekends'), 'match');
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-19T11:00:00' }), 'Evenings and Weekends'), 'match');
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-14T11:00:00' }), 'Evenings and Weekends'), 'mismatch');
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-19T11:00:00' }), 'Weekends only'), 'match');
  assert.equal(scheduleFit(job({ scheduledAt: '2026-09-14T19:00:00' }), 'Weekends only'), 'mismatch');
});

test('multiple filters combine and clearing restores the role-scoped input', () => {
  const jobs = [
    job(),
    job({ id: 'far', areaCoordinates: { latE2: 3100, lngE2: -9700 }, category: 'Cleaning' }),
    job({ id: 'wrong-category', category: 'Painting' }),
  ];
  const result = filterJobsByFit(jobs, provider, {
    ...EMPTY_JOB_FIT_FILTERS,
    category: 'Cleaning',
    maxDistanceMiles: 10,
    workTimeFit: true,
  });
  assert.deepEqual(result.jobs.map((item) => item.id), ['job']);
  assert.equal(filterJobsByFit(jobs, provider, EMPTY_JOB_FIT_FILTERS).jobs.length, 3);
});

test('distance filter excludes missing coordinates without false precision', () => {
  const result = filterJobsByFit(
    [job({ areaCoordinates: undefined }), job({ id: 'located' })],
    provider,
    { ...EMPTY_JOB_FIT_FILTERS, maxDistanceMiles: 10 },
  );
  assert.deepEqual(result.jobs.map((item) => item.id), ['located']);
  assert.equal(result.missingDistanceCount, 1);
});

test('fit filters cannot widen role-scoped browse access', () => {
  const employer = { ...provider, id: 'employer', role: 'employer' };
  const loadedForEmployer = [job({ id: 'owned', employerId: employer.id })];
  assert.deepEqual(getProviderBrowseJobs(loadedForEmployer, employer), []);

  const providerWithBlock = { ...provider, blockedUserIds: ['blocked'] };
  const scoped = getProviderBrowseJobs(
    [
      job({ id: 'open' }),
      job({ id: 'accepted', status: 'accepted' }),
      job({ id: 'blocked', employerId: 'blocked' }),
    ],
    providerWithBlock,
  );
  assert.deepEqual(scoped.map((item) => item.id), ['open']);
  assert.deepEqual(
    filterJobsByFit(scoped, providerWithBlock, EMPTY_JOB_FIT_FILTERS).jobs.map((item) => item.id),
    ['open'],
  );
});