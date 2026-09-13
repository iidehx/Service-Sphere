import { readFileSync } from 'node:fs';
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'service-app-rules';
const now = 1_725_000_000_000;
let testEnv;

const privateUser = (role, name, extra = {}) => ({
  name,
  email: `${role}-${name.toLowerCase().replaceAll(' ', '-')}@example.test`,
  role,
  workArea: 'Austin, TX',
  categories: role === 'provider' ? ['Cleaning'] : [],
  priceRange: role === 'provider' ? '$40-$60' : '',
  companyInfo: '',
  bio: 'A simple bio.',
  avatarUrl: '',
  ratingAvg: 0,
  ratingCount: 0,
  recentReviews: [],
  savedJobIds: [],
  savedProviderIds: [],
  blockedUserIds: [],
  notifyQuotes: true,
  verified: false,
  availableForWork: true,
  availability: 'Weekdays 9-5',
  createdAtMs: now,
  ...extra,
});

const publicProfile = (role, name, extra = {}) => ({
  name,
  role,
  workArea: 'Austin, TX',
  categories: role === 'provider' ? ['Cleaning'] : [],
  priceRange: role === 'provider' ? '$40-$60' : '',
  companyInfo: '',
  bio: 'A simple bio.',
  avatarUrl: '',
  ratingAvg: 0,
  ratingCount: 0,
  recentReviews: [],
  verified: false,
  availableForWork: true,
  availability: 'Weekdays 9-5',
  createdAtMs: now,
  ...extra,
});

const job = (overrides = {}) => ({
  title: 'Deep clean a two-bedroom apartment',
  category: 'Cleaning',
  details: 'Clean the kitchen, bathrooms, floors, and inside the cabinets.',
  specialRequirements: '',
  priceOffer: 180,
  scheduledAt: '2026-09-01T10:00:00.000Z',
  location: 'North Austin',
  leaveTimeToEmployee: false,
  emergency: false,
  employerId: 'employer',
  employerName: 'Emma Employer',
  status: 'open',
  paymentStatus: 'pending',
  employerQuoteAccepted: false,
  employeeQuoteAccepted: false,
  reviewedBy: [],
  createdAtMs: now,
  ...overrides,
});

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/employer'), privateUser('employer', 'Emma Employer')),
      setDoc(doc(db, 'users/provider'), privateUser('provider', 'Pat Provider')),
      setDoc(doc(db, 'users/other'), privateUser('provider', 'Other Provider')),
      setDoc(doc(db, 'users/disabled'), privateUser('employer', 'Disabled Employer', { disabled: true })),
      setDoc(doc(db, 'users/admin'), privateUser('employer', 'Ada Admin')),
      setDoc(doc(db, 'users/other-employer'), privateUser('employer', 'Owen OtherEmployer')),
      setDoc(doc(db, 'publicProfiles/employer'), publicProfile('employer', 'Emma Employer')),
      setDoc(doc(db, 'publicProfiles/provider'), publicProfile('provider', 'Pat Provider')),
      setDoc(doc(db, 'publicProfiles/other'), publicProfile('provider', 'Other Provider')),
      setDoc(doc(db, 'publicProfiles/disabled'), publicProfile('employer', 'Disabled Employer')),
      setDoc(doc(db, 'publicProfiles/other-employer'), publicProfile('employer', 'Owen OtherEmployer')),
      setDoc(doc(db, 'admins/admin'), { enabled: true }),
      setDoc(doc(db, 'jobs/open-job'), job()),
      // A second employer's own open and non-open jobs, used to prove the
      // `employer` user above can never read another employer's jobs, and
      // that a provider may still browse this employer's open listing while
      // being denied their non-open one once it's claimed by someone else.
      setDoc(
        doc(db, 'jobs/other-employer-open-job'),
        job({ employerId: 'other-employer', employerName: 'Owen OtherEmployer' }),
      ),
      setDoc(
        doc(db, 'jobs/other-employer-accepted-job'),
        job({
          employerId: 'other-employer',
          employerName: 'Owen OtherEmployer',
          employeeId: 'other',
          employeeName: 'Other Provider',
          status: 'accepted',
          proposedPrice: 150,
          quoteBreakdown: { labor: 130, materials: 10, expectedHours: 2, extraFees: 10 },
          quoteBy: 'other',
          employerQuoteAccepted: true,
          employeeQuoteAccepted: true,
          agreedPrice: 150,
          platformFee: 7.5,
        }),
      ),
      setDoc(
        doc(db, 'jobs/accepted-job'),
        job({
          employeeId: 'provider',
          employeeName: 'Pat Provider',
          status: 'accepted',
          proposedPrice: 200,
          quoteBreakdown: { labor: 180, materials: 20, expectedHours: 2, extraFees: 0 },
          quoteBy: 'provider',
          employerQuoteAccepted: true,
          employeeQuoteAccepted: true,
          agreedPrice: 200,
          platformFee: 10,
        }),
      ),
      setDoc(
        doc(db, 'jobs/quote-job'),
        job({
          employeeId: 'provider',
          employeeName: 'Pat Provider',
          status: 'negotiating',
        }),
      ),
      setDoc(
        doc(db, 'jobs/completed-job'),
        job({
          employeeId: 'provider',
          employeeName: 'Pat Provider',
          status: 'completed',
          proposedPrice: 200,
          quoteBreakdown: { labor: 180, materials: 20, expectedHours: 2, extraFees: 0 },
          quoteBy: 'provider',
          employerQuoteAccepted: true,
          employeeQuoteAccepted: true,
          agreedPrice: 200,
          platformFee: 10,
        }),
      ),
      setDoc(doc(db, 'chats/chat-open-job'), {
        jobId: 'open-job',
        jobTitle: 'Deep clean a two-bedroom apartment',
        participants: ['employer', 'provider'],
        participantNames: { employer: 'Emma Employer', provider: 'Pat Provider' },
        lastMessage: '',
        lastMessageAtMs: now,
        lastReadAt: {},
        createdAtMs: now,
      }),
      setDoc(doc(db, 'notifications/provider-note'), {
        userId: 'provider',
        kind: 'job',
        title: 'Job accepted',
        body: 'Your job was accepted.',
        jobId: 'accepted-job',
        read: false,
        createdAtMs: now,
      }),
    ]);
  });
}

const dbFor = (uid, claims = { email_verified: true }) => testEnv.authenticatedContext(uid, claims).firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

test('anonymous users cannot read marketplace data', async () => {
  await seed();
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'jobs/open-job')));
  await assertFails(getDoc(doc(anon, 'publicProfiles/provider')));
});

test('private profiles are owner-only while public profiles are discoverable', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider');
  await assertSucceeds(getDoc(doc(employer, 'users/employer')));
  await assertFails(getDoc(doc(provider, 'users/employer')));
  await assertSucceeds(getDoc(doc(provider, 'publicProfiles/employer')));
  await assertSucceeds(updateDoc(doc(employer, 'users/employer'), { blockedUserIds: ['other'] }));
  await assertFails(updateDoc(doc(employer, 'users/employer'), { ratingAvg: 5 }));
  await assertFails(updateDoc(doc(employer, 'publicProfiles/employer'), { ratingCount: 1 }));
  await assertFails(updateDoc(doc(provider, 'users/employer'), { blockedUserIds: ['other'] }));
  await assertFails(deleteDoc(doc(employer, 'publicProfiles/employer')));
  await assertFails(deleteDoc(doc(employer, 'users/employer')));
  await assertFails(deleteDoc(doc(provider, 'publicProfiles/employer')));
  await assertFails(deleteDoc(doc(provider, 'users/employer')));
});

test('providers can atomically opt into emergency matching with mirrored availability metadata', async () => {
  await seed();
  const provider = dbFor('provider');
  const updatedAtMs = Date.now();
  const batch = writeBatch(provider);
  batch.update(doc(provider, 'users/provider'), {
    emergencyOptIn: true,
    availabilityUpdatedAtMs: updatedAtMs,
    availabilityTimezoneOffsetMinutes: 300,
  });
  batch.update(doc(provider, 'publicProfiles/provider'), {
    emergencyOptIn: true,
    availabilityUpdatedAtMs: updatedAtMs,
    availabilityTimezoneOffsetMinutes: 300,
  });
  await assertSucceeds(batch.commit());
});

test('unverified accounts can use marketplace data while email verification is disabled', async () => {
  await seed();
  const unverified = dbFor('unverified', { email_verified: false });
  const accountSetup = writeBatch(unverified);
  accountSetup.set(doc(unverified, 'users/unverified'), privateUser('employer', 'Unverified Employer'));
  accountSetup.set(doc(unverified, 'publicProfiles/unverified'), publicProfile('employer', 'Unverified Employer'));
  await assertSucceeds(accountSetup.commit());

  await assertSucceeds(setDoc(doc(unverified, 'jobs/unverified-job'), job({
    employerId: 'unverified',
    employerName: 'Unverified Employer',
  })));
  await assertSucceeds(updateDoc(doc(unverified, 'users/unverified'), { blockedUserIds: ['provider'] }));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'chats/unverified-chat'), {
      participants: ['unverified', 'provider'],
      participantNames: { unverified: 'Unverified Employer', provider: 'Provider' },
      jobId: 'unverified-job',
      jobTitle: 'Unverified work',
      lastMessageText: 'Hello',
      lastMessageAtMs: 1,
      lastReadAt: {},
      createdAtMs: 1,
    });
    await setDoc(doc(db, 'chats/unverified-chat/messages/message-1'), {
      senderId: 'provider',
      senderName: 'Provider',
      text: 'Hello',
      kind: 'text',
      createdAtMs: 1,
    });
    await setDoc(doc(db, 'notifications/unverified-note'), {
      userId: 'unverified',
      kind: 'job',
      title: 'New job',
      body: 'Verification required',
      read: false,
      createdAtMs: 1,
    });
  });

  await assertSucceeds(getDocs(query(collection(unverified, 'jobs'), where('employerId', '==', 'unverified'))));
  await assertSucceeds(getDoc(doc(unverified, 'publicProfiles/provider')));
  await assertSucceeds(getDoc(doc(unverified, 'chats/unverified-chat')));
  await assertSucceeds(getDocs(collection(unverified, 'chats/unverified-chat/messages')));
  await assertSucceeds(updateDoc(doc(unverified, 'notifications/unverified-note'), { read: true }));
  await assertSucceeds(deleteDoc(doc(unverified, 'notifications/unverified-note')));
});

test('a pending deletion prevents every session from restoring an account profile', async () => {
  await seed();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await deleteDoc(doc(db, 'users/employer'));
    await deleteDoc(doc(db, 'publicProfiles/employer'));
    await setDoc(doc(db, 'accountTombstones/employer'), { requestedAtMs: 1 });
  });

  const employer = dbFor('employer');
  await assertFails(setDoc(doc(employer, 'jobs/deleted-account-job'), job({
    employerId: 'employer',
    employerName: 'Employer',
  })));
  const restoreProfile = writeBatch(employer);
  restoreProfile.set(doc(employer, 'users/employer'), privateUser('employer', 'Employer'));
  restoreProfile.set(doc(employer, 'publicProfiles/employer'), publicProfile('employer', 'Employer'));
  await assertFails(restoreProfile.commit());
});

test('new accounts must start with an empty server-managed rating summary', async () => {
  await seed();
  const newUser = dbFor('new-user');
  const legitimateSignup = writeBatch(newUser);
  legitimateSignup.set(doc(newUser, 'users/new-user'), privateUser('employer', 'New Employer'));
  legitimateSignup.set(doc(newUser, 'publicProfiles/new-user'), publicProfile('employer', 'New Employer'));
  await assertSucceeds(legitimateSignup.commit());

  const forgedRatings = writeBatch(newUser);
  const fakeSummary = {
    ratingAvg: 5,
    ratingCount: 999,
    recentReviews: [],
  };
  forgedRatings.set(doc(newUser, 'users/forged-user'), privateUser('employer', 'Forged Employer', fakeSummary));
  forgedRatings.set(doc(newUser, 'publicProfiles/forged-user'), publicProfile('employer', 'Forged Employer', fakeSummary));
  await assertFails(forgedRatings.commit());

  const forgedReviewList = writeBatch(newUser);
  const fakeRecentReview = {
    ratingAvg: 0,
    ratingCount: 0,
    recentReviews: [{ fake: true }],
  };
  forgedReviewList.set(doc(newUser, 'users/forged-review-user'), privateUser('employer', 'Forged Review Employer', fakeRecentReview));
  forgedReviewList.set(
    doc(newUser, 'publicProfiles/forged-review-user'),
    publicProfile('employer', 'Forged Review Employer', fakeRecentReview),
  );
  await assertFails(forgedReviewList.commit());
});

test('only employers can create jobs and disabled users cannot write', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider');
  const disabled = dbFor('disabled');
  await assertSucceeds(setDoc(doc(employer, 'jobs/new-job'), job({ createdAtMs: now + 1 })));
  await assertSucceeds(
    setDoc(
      doc(employer, 'jobs/legacy-schedule-job'),
      job({ scheduledAt: 'Saturday, 10:00 AM', createdAtMs: now + 2 }),
    ),
  );
  await assertFails(setDoc(doc(provider, 'jobs/provider-job'), job({ employerId: 'provider', employerName: 'Pat Provider' })));
  await assertFails(setDoc(doc(disabled, 'jobs/disabled-job'), job({ employerId: 'disabled', employerName: 'Disabled Employer' })));
});

test('job requirements are length-limited and editable only by the owner while open', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider');
  const other = dbFor('other');

  await assertSucceeds(setDoc(doc(employer, 'jobs/requirements-job'), job({
    specialRequirements: 'Check in with security and use the loading dock.',
    createdAtMs: now + 1,
  })));
  await assertFails(setDoc(doc(employer, 'jobs/oversized-requirements-job'), job({
    specialRequirements: 'A'.repeat(1001),
    createdAtMs: now + 2,
  })));
  const { specialRequirements, ...missingRequirements } = job({ createdAtMs: now + 3 });
  await assertFails(setDoc(doc(employer, 'jobs/missing-requirements-job'), missingRequirements));

  await assertSucceeds(updateDoc(doc(employer, 'jobs/open-job'), {
    specialRequirements: 'A parking permit is required.',
  }));
  await assertFails(updateDoc(doc(provider, 'jobs/open-job'), { specialRequirements: 'Provider edit' }));
  await assertFails(updateDoc(doc(other, 'jobs/open-job'), { specialRequirements: 'Other provider edit' }));
  await assertFails(updateDoc(doc(employer, 'jobs/accepted-job'), { specialRequirements: 'Too late' }));
  await assertFails(updateDoc(doc(employer, 'jobs/open-job'), { specialRequirements: 'A'.repeat(1001) }));
});

test('legacy jobs without requirements remain readable and can add them while open', async () => {
  await seed();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const { specialRequirements, ...legacyJob } = job();
    await setDoc(doc(db, 'jobs/legacy-no-requirements'), legacyJob);
  });
  const employer = dbFor('employer');
  const provider = dbFor('provider');
  await assertSucceeds(getDoc(doc(provider, 'jobs/legacy-no-requirements')));
  await assertSucceeds(updateDoc(doc(employer, 'jobs/legacy-no-requirements'), { priceOffer: 190 }));
  await assertSucceeds(updateDoc(doc(employer, 'jobs/legacy-no-requirements'), {
    specialRequirements: 'Use visitor parking.',
  }));
});

test('job creation requires a well-formed coarse location and rejects oversized, missing, or address-like values', async () => {
  await seed();
  const employer = dbFor('employer');
  await assertSucceeds(setDoc(doc(employer, 'jobs/located-job'), job({ createdAtMs: now + 1 })));
  await assertSucceeds(setDoc(doc(employer, 'jobs/zip-job'), job({ location: '78704', createdAtMs: now + 2 })));
  await assertFails(
    setDoc(doc(employer, 'jobs/too-short-location'), job({ location: 'NW', createdAtMs: now + 3 })),
  );
  await assertFails(
    setDoc(doc(employer, 'jobs/too-long-location'), job({ location: 'A'.repeat(121), createdAtMs: now + 4 })),
  );
  // A full street address is not a valid public, coarse location — the
  // marketplace-readable job document must never carry one.
  await assertFails(
    setDoc(doc(employer, 'jobs/address-location'), job({ location: '1200 Elm St, Austin, TX', createdAtMs: now + 5 })),
  );
  await assertFails(
    setDoc(doc(employer, 'jobs/digits-location'), job({ location: '123 Main', createdAtMs: now + 6 })),
  );
  const { location, ...withoutLocation } = job({ createdAtMs: now + 7 });
  await assertFails(setDoc(doc(employer, 'jobs/missing-location'), withoutLocation));
});

test('providers and jobs can save rounded coarse centroids but not precise coordinates', async () => {
  await seed();
  const provider = dbFor('provider');
  const employer = dbFor('employer');
  const rounded = { latE2: 3027, lngE2: -9774 };

  const profileBatch = writeBatch(provider);
  profileBatch.update(doc(provider, 'users/provider'), { areaCoordinates: rounded });
  profileBatch.update(doc(provider, 'publicProfiles/provider'), { areaCoordinates: rounded });
  await assertSucceeds(profileBatch.commit());
  await assertFails(updateDoc(doc(provider, 'users/provider'), {
    areaCoordinates: { latE2: 3027.2, lngE2: -9774.31 },
  }));

  await assertSucceeds(setDoc(doc(employer, 'jobs/rounded-area-job'), job({
    areaCoordinates: rounded,
    createdAtMs: now + 20,
  })));
  await assertFails(setDoc(doc(employer, 'jobs/precise-area-job'), job({
    areaCoordinates: { latE2: 3027.2, lngE2: -9774.31 },
    createdAtMs: now + 21,
  })));
});

test('the public job document rejects locationPlace entirely — normalized place metadata only lives in the private subdocument', async () => {
  await seed();
  const employer = dbFor('employer');
  await assertFails(
    setDoc(
      doc(employer, 'jobs/place-job'),
      job({
        createdAtMs: now + 1,
        locationPlace: { label: 'North Austin', lat: 30.27, lng: -97.74 },
      }),
    ),
  );
});

test('the private location subdocument accepts an optional, well-formed place alongside or instead of an address', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider');

  await assertSucceeds(
    setDoc(doc(employer, 'jobs/accepted-job/private/location'), {
      place: { label: '1200 Elm St, Austin, TX', lat: 30.27, lng: -97.74 },
    }),
  );
  await assertSucceeds(getDoc(doc(provider, 'jobs/accepted-job/private/location')));
  await assertFails(
    setDoc(doc(employer, 'jobs/accepted-job/private/location'), {
      place: { label: 'Somewhere', lat: 999, lng: -97.74 },
    }),
  );
  await assertFails(
    setDoc(doc(employer, 'jobs/accepted-job/private/location'), {
      place: { label: 'Somewhere' },
    }),
  );
});

test('a precise address is readable only by the employer and the assigned provider, never by other users', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider'); // assigned provider on jobs/accepted-job
  const other = dbFor('other'); // not a participant on any of these jobs
  const anon = testEnv.unauthenticatedContext().firestore();

  // The owning employer can write the precise address on their own job...
  await assertSucceeds(setDoc(doc(employer, 'jobs/accepted-job/private/location'), { address: '1200 Elm St, Austin, TX' }));
  // ...and both the employer and the assigned provider can read it back.
  await assertSucceeds(getDoc(doc(employer, 'jobs/accepted-job/private/location')));
  await assertSucceeds(getDoc(doc(provider, 'jobs/accepted-job/private/location')));
  // A signed-in user who is not a participant on this job cannot read it.
  await assertFails(getDoc(doc(other, 'jobs/accepted-job/private/location')));
  await assertFails(getDoc(doc(anon, 'jobs/accepted-job/private/location')));
  // A provider cannot write the employer's precise address.
  await assertFails(setDoc(doc(provider, 'jobs/accepted-job/private/location'), { address: '999 Fake St' }));

  // A provider who has merely claimed/is negotiating an open job (employeeId
  // is set, but the employer has not yet accepted them — status stays
  // 'negotiating') must NOT be able to read the precise address yet: only
  // acceptance ('accepted'/'completed') unlocks it.
  await assertSucceeds(setDoc(doc(employer, 'jobs/quote-job/private/location'), { address: '55 Negotiating Ln, Austin, TX' }));
  await assertFails(getDoc(doc(provider, 'jobs/quote-job/private/location')));
  // Once the same job is accepted, the assigned provider gains read access.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'jobs/quote-job'), { status: 'accepted' }, { merge: true });
  });
  await assertSucceeds(getDoc(doc(provider, 'jobs/quote-job/private/location')));

  // Before a provider is assigned (open-job has no employeeId), only the
  // employer can read or write the precise address — no one else qualifies
  // as a participant yet.
  await assertSucceeds(setDoc(doc(employer, 'jobs/open-job/private/location'), { address: '742 Evergreen Terrace, Austin, TX' }));
  await assertFails(getDoc(doc(provider, 'jobs/open-job/private/location')));
  await assertFails(getDoc(doc(other, 'jobs/open-job/private/location')));

  // Oversized or malformed values are rejected.
  await assertFails(setDoc(doc(employer, 'jobs/open-job/private/location'), { address: 'A'.repeat(201) }));
  await assertFails(setDoc(doc(employer, 'jobs/open-job/private/location'), { address: 'AB' }));
  await assertFails(setDoc(doc(employer, 'jobs/open-job/private/location'), { address: '123 Main St', extra: 'nope' }));
});

test('the owning employer can clear a saved precise address, and it stops being readable afterward', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider'); // assigned provider on jobs/accepted-job

  await assertSucceeds(setDoc(doc(employer, 'jobs/accepted-job/private/location'), { address: '1200 Elm St, Austin, TX' }));
  const before = await getDoc(doc(provider, 'jobs/accepted-job/private/location'));
  assert.equal(before.data()?.address, '1200 Elm St, Austin, TX');

  // Clearing merges a field-delete for `address`, mirroring what the app
  // does when an employer blanks out the exact-address editor.
  await assertSucceeds(setDoc(doc(employer, 'jobs/accepted-job/private/location'), { address: deleteField() }, { merge: true }));
  const after = await getDoc(doc(provider, 'jobs/accepted-job/private/location'));
  assert.equal(after.data()?.address, undefined);
});

test('before/after job photos are visible to any current job participant, but writable only by the matching side', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider'); // assigned provider on jobs/accepted-job and jobs/quote-job
  const other = dbFor('other'); // not a participant on any of these jobs
  const anon = testEnv.unauthenticatedContext().firestore();

  // The employer can attach "before" photos to their own job...
  await assertSucceeds(
    setDoc(doc(employer, 'jobs/accepted-job/private/photos'), { beforePhotoUrls: ['https://example.test/before-1.jpg'] }),
  );
  // ...and both the employer and the assigned (accepted) provider can read them.
  await assertSucceeds(getDoc(doc(employer, 'jobs/accepted-job/private/photos')));
  await assertSucceeds(getDoc(doc(provider, 'jobs/accepted-job/private/photos')));
  // A non-participant, and an anonymous caller, cannot.
  await assertFails(getDoc(doc(other, 'jobs/accepted-job/private/photos')));
  await assertFails(getDoc(doc(anon, 'jobs/accepted-job/private/photos')));

  // Unlike the precise address, photos are visible to a provider who has
  // merely claimed/is negotiating an open job (employeeId set, status still
  // 'negotiating') — no acceptance is required to view them.
  await assertSucceeds(
    setDoc(doc(employer, 'jobs/quote-job/private/photos'), { beforePhotoUrls: ['https://example.test/before-2.jpg'] }),
  );
  await assertSucceeds(getDoc(doc(provider, 'jobs/quote-job/private/photos')));

  // The assigned provider may add "after" photos once accepted...
  await assertSucceeds(
    setDoc(doc(provider, 'jobs/accepted-job/private/photos'), { afterPhotoUrls: ['https://example.test/after-1.jpg'] }, { merge: true }),
  );
  const merged = await getDoc(doc(employer, 'jobs/accepted-job/private/photos'));
  assert.deepEqual(merged.data()?.beforePhotoUrls, ['https://example.test/before-1.jpg']);
  assert.deepEqual(merged.data()?.afterPhotoUrls, ['https://example.test/after-1.jpg']);

  // ...but not before being accepted — merely negotiating isn't enough.
  await assertFails(
    setDoc(doc(provider, 'jobs/quote-job/private/photos'), { afterPhotoUrls: ['https://example.test/after-2.jpg'] }, { merge: true }),
  );

  // Neither side can write into the other's field.
  await assertFails(
    setDoc(doc(employer, 'jobs/accepted-job/private/photos'), { afterPhotoUrls: ['https://example.test/sneaky.jpg'] }, { merge: true }),
  );
  await assertFails(
    setDoc(doc(provider, 'jobs/accepted-job/private/photos'), { beforePhotoUrls: ['https://example.test/sneaky.jpg'] }, { merge: true }),
  );
  // A non-participant cannot write either field.
  await assertFails(
    setDoc(doc(other, 'jobs/accepted-job/private/photos'), { beforePhotoUrls: ['https://example.test/sneaky.jpg'] }, { merge: true }),
  );

  // The list is capped and must actually be a list of values.
  await assertFails(
    setDoc(doc(employer, 'jobs/open-job/private/photos'), {
      beforePhotoUrls: Array.from({ length: 7 }, (_, i) => `https://example.test/${i}.jpg`),
    }),
  );
  await assertFails(setDoc(doc(employer, 'jobs/open-job/private/photos'), { beforePhotoUrls: 'not-a-list' }));
  await assertFails(
    setDoc(doc(employer, 'jobs/open-job/private/photos'), { beforePhotoUrls: [], extra: 'nope' }),
  );
});

test('legacy jobs without a location keep rendering and editing safely until one is set', async () => {
  await seed();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const { location, ...legacyJob } = job({ employerId: 'employer', employerName: 'Emma Employer' });
    await setDoc(doc(db, 'jobs/legacy-no-location'), legacyJob);
  });
  const employer = dbFor('employer');
  const provider = dbFor('provider');
  await assertSucceeds(getDoc(doc(provider, 'jobs/legacy-no-location')));
  // Editing an unrelated field without touching location is still allowed.
  await assertSucceeds(updateDoc(doc(employer, 'jobs/legacy-no-location'), { priceOffer: 190 }));
  // Setting an invalid location on that same legacy job is rejected...
  await assertFails(updateDoc(doc(employer, 'jobs/legacy-no-location'), { location: 'NW' }));
  await assertFails(updateDoc(doc(employer, 'jobs/legacy-no-location'), { location: '900 Congress Ave, Austin, TX' }));
  // ...while a well-formed coarse one is accepted.
  await assertSucceeds(updateDoc(doc(employer, 'jobs/legacy-no-location'), { location: 'Downtown Austin' }));
});

test('only the owning employer can edit a job location, and only while it is still open', async () => {
  await seed();
  const employer = dbFor('employer');
  const other = dbFor('other');
  await assertFails(updateDoc(doc(other, 'jobs/open-job'), { location: 'Downtown Austin' }));
  await assertFails(updateDoc(doc(employer, 'jobs/accepted-job'), { location: 'Downtown Austin' }));
  await assertSucceeds(updateDoc(doc(employer, 'jobs/open-job'), { location: 'Downtown Austin' }));
});

test('a newly registered employer can publish a scheduled job for providers to browse and claim', async () => {
  const employer = dbFor('new-employer');
  const provider = dbFor('new-provider');
  const employerSignup = writeBatch(employer);
  employerSignup.set(doc(employer, 'users/new-employer'), privateUser('employer', 'New Employer'));
  employerSignup.set(doc(employer, 'publicProfiles/new-employer'), publicProfile('employer', 'New Employer'));
  await assertSucceeds(employerSignup.commit());

  const providerSignup = writeBatch(provider);
  providerSignup.set(doc(provider, 'users/new-provider'), privateUser('provider', 'New Provider'));
  providerSignup.set(doc(provider, 'publicProfiles/new-provider'), publicProfile('provider', 'New Provider'));
  await assertSucceeds(providerSignup.commit());

  const liveJob = doc(employer, 'jobs/new-calendar-job');
  await assertSucceeds(
    setDoc(
      liveJob,
      job({
        employerId: 'new-employer',
        employerName: 'New Employer',
        scheduledAt: '2026-09-15T14:00:00.000Z',
      }),
    ),
  );

  const browseResults = await getDocs(query(collection(provider, 'jobs'), where('status', '==', 'open'), limit(200)));
  assert.ok(browseResults.docs.some((result) => result.id === 'new-calendar-job'));
  await assertSucceeds(
    updateDoc(doc(provider, 'jobs/new-calendar-job'), {
      employeeId: 'new-provider',
      employeeName: 'New Provider',
      status: 'negotiating',
    }),
  );
});

test('an employer can read only jobs they own — never another employer\'s, by get, query, or a direct job-detail lookup', async () => {
  await seed();
  const employer = dbFor('employer');

  // Direct document reads mirror what the job-detail route does when a
  // user navigates (or deep-links) straight to a job id.
  await assertSucceeds(getDoc(doc(employer, 'jobs/open-job')));
  await assertFails(getDoc(doc(employer, 'jobs/other-employer-open-job')));
  await assertFails(getDoc(doc(employer, 'jobs/other-employer-accepted-job')));

  // An owner-scoped query returns only this employer's jobs...
  const owned = await getDocs(query(collection(employer, 'jobs'), where('employerId', '==', 'employer')));
  assert.ok(owned.docs.every((result) => result.data().employerId === 'employer'));
  assert.ok(owned.docs.some((result) => result.id === 'open-job'));
  assert.ok(!owned.docs.some((result) => result.id.startsWith('other-employer')));

  // ...while an unconstrained collection query, or one scoped to another
  // employer's jobs, is rejected outright — the rule cannot prove every
  // possible result belongs to this employer.
  await assertFails(getDocs(collection(employer, 'jobs')));
  await assertFails(getDocs(query(collection(employer, 'jobs'), where('employerId', '==', 'other-employer'))));
  // Employers do not browse the open marketplace — that access path is
  // reserved for providers.
  await assertFails(getDocs(query(collection(employer, 'jobs'), where('status', '==', 'open'))));
});

test('incomplete accounts cannot access marketplace', async () => {
  await seed();
  const incompleteDb = dbFor('incomplete');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/incomplete'), privateUser('provider', 'Inc', { availability: '' }));
  });

  await assertFails(getDocs(query(collection(incompleteDb, 'jobs'), where('status', '==', 'open'))));
  await assertFails(getDoc(doc(incompleteDb, 'publicProfiles/employer')));
  await assertSucceeds(getDoc(doc(incompleteDb, 'users/incomplete')));
});

test('a legacy incomplete account can complete onboarding and enter the marketplace', async () => {
  const legacyPrivate = privateUser('provider', 'Legacy Provider');
  const legacyPublic = publicProfile('provider', 'Legacy Provider');
  delete legacyPrivate.availability;
  delete legacyPublic.availability;

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/legacy-provider'), legacyPrivate);
    await setDoc(doc(db, 'publicProfiles/legacy-provider'), legacyPublic);
    await setDoc(doc(db, 'jobs/legacy-visible-job'), job());
  });

  const legacyDb = dbFor('legacy-provider');
  await assertFails(getDocs(query(collection(legacyDb, 'jobs'), where('status', '==', 'open'))));

  const completedPrivate = { ...legacyPrivate, availability: 'Weekdays 9-5' };
  const completedPublic = { ...legacyPublic, availability: 'Weekdays 9-5' };
  const onboarding = writeBatch(legacyDb);
  onboarding.update(doc(legacyDb, 'users/legacy-provider'), { availability: completedPrivate.availability });
  onboarding.set(doc(legacyDb, 'publicProfiles/legacy-provider'), completedPublic, { merge: true });
  await assertSucceeds(onboarding.commit());

  const browseResults = await getDocs(query(collection(legacyDb, 'jobs'), where('status', '==', 'open')));
  assert.ok(browseResults.docs.some((result) => result.id === 'legacy-visible-job'));
});

test('providers can browse any employer\'s open jobs and keep access to jobs they participate in, but not other non-open jobs', async () => {
  await seed();
  const provider = dbFor('provider'); // employeeId on accepted-job, quote-job, completed-job

  // Open jobs are readable regardless of which employer posted them.
  await assertSucceeds(getDoc(doc(provider, 'jobs/open-job')));
  await assertSucceeds(getDoc(doc(provider, 'jobs/other-employer-open-job')));

  // Jobs this provider is a participant in stay readable at every stage.
  await assertSucceeds(getDoc(doc(provider, 'jobs/quote-job'))); // negotiating
  await assertSucceeds(getDoc(doc(provider, 'jobs/accepted-job'))); // accepted
  await assertSucceeds(getDoc(doc(provider, 'jobs/completed-job'))); // completed

  // A non-open job assigned to a different provider is off-limits — this is
  // exactly the "unauthorized deep-link read" case: the job exists, but this
  // provider is neither its employer nor its assigned provider.
  await assertFails(getDoc(doc(provider, 'jobs/other-employer-accepted-job')));

  // The marketplace browse query returns open jobs across every employer...
  const browse = await getDocs(query(collection(provider, 'jobs'), where('status', '==', 'open')));
  assert.ok(browse.docs.some((result) => result.id === 'open-job'));
  assert.ok(browse.docs.some((result) => result.id === 'other-employer-open-job'));
  assert.ok(!browse.docs.some((result) => result.id === 'other-employer-accepted-job'));

  // ...and the "my work" query returns only jobs this provider is assigned to.
  const mine = await getDocs(query(collection(provider, 'jobs'), where('employeeId', '==', 'provider')));
  assert.ok(mine.docs.every((result) => result.data().employeeId === 'provider'));
  assert.ok(!mine.docs.some((result) => result.id === 'other-employer-accepted-job'));

  // An unconstrained collection query is still rejected — it could return
  // another employer's non-open job that this provider has no claim to.
  await assertFails(getDocs(collection(provider, 'jobs')));
});

test('providers can claim open work but cannot alter ownership or unrelated job fields', async () => {
  await seed();
  const provider = dbFor('provider');
  const other = dbFor('other');
  await assertSucceeds(
    updateDoc(doc(provider, 'jobs/open-job'), {
      employeeId: 'provider',
      employeeName: 'Pat Provider',
      status: 'negotiating',
    }),
  );
  await assertFails(updateDoc(doc(other, 'jobs/open-job'), { title: 'Stolen job title' }));
  await assertFails(updateDoc(doc(provider, 'jobs/accepted-job'), { employerId: 'provider' }));
  await assertFails(updateDoc(doc(provider, 'jobs/accepted-job'), { paymentStatus: 'paid' }));
});

test('emergency jobs are hidden from other providers and cannot be claimed through the normal path', async () => {
  await seed();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'jobs/emergency-job'), job({
      emergency: true,
      status: 'emergency_pending',
      areaCoordinates: { latE2: 3027, lngE2: -9774 },
      emergencyRequestedProviderId: 'provider',
      emergencyRequestStatus: 'pending',
      emergencyRequestExpiresAtMs: Date.now() + 60_000,
    }));
  });
  const selected = dbFor('provider');
  const other = dbFor('other');
  await assertSucceeds(getDoc(doc(selected, 'jobs/emergency-job')));
  const selectedQuery = query(
    collection(selected, 'jobs'),
    where('emergencyRequestedProviderId', '==', 'provider'),
    where('emergencyRequestStatus', '==', 'pending'),
  );
  const selectedResults = await assertSucceeds(getDocs(selectedQuery));
  assert.equal(selectedResults.size, 1);
  await assertFails(getDoc(doc(other, 'jobs/emergency-job')));
  await assertFails(updateDoc(doc(selected, 'jobs/emergency-job'), {
    employeeId: 'provider',
    employeeName: 'Pat Provider',
    status: 'negotiating',
  }));
});

test('employers can update payment and complete an accepted assigned job', async () => {
  await seed();
  const employer = dbFor('employer');
  await assertSucceeds(updateDoc(doc(employer, 'jobs/accepted-job'), { paymentStatus: 'paid' }));
  await assertSucceeds(updateDoc(doc(employer, 'jobs/accepted-job'), { status: 'completed' }));
});

test('one participant cannot forge mutual quote acceptance', async () => {
  await seed();
  const provider = dbFor('provider');
  await assertFails(
    updateDoc(doc(provider, 'jobs/accepted-job'), {
      status: 'accepted',
      employerQuoteAccepted: true,
      employeeQuoteAccepted: true,
      agreedPrice: 200,
      platformFee: 10,
    }),
  );
});

test('a quote requires both participants to accept before the job is accepted', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider');
  const quoteRef = doc(provider, 'jobs/quote-job');
  await assertSucceeds(
    updateDoc(quoteRef, {
      status: 'negotiating',
      proposedPrice: 200,
      quoteBreakdown: { labor: 180, materials: 20, expectedHours: 2, extraFees: 0 },
      quoteBy: 'provider',
      employerQuoteAccepted: false,
      employeeQuoteAccepted: false,
    }),
  );
  await assertSucceeds(updateDoc(doc(employer, 'jobs/quote-job'), { employerQuoteAccepted: true }));
  await assertSucceeds(
    updateDoc(quoteRef, {
      employeeQuoteAccepted: true,
      status: 'accepted',
      agreedPrice: 200,
      platformFee: 10,
    }),
  );
});

test('chat and message access is limited to participants and message identity is enforced', async () => {
  await seed();
  const employer = dbFor('employer');
  const other = dbFor('other');
  await assertSucceeds(getDoc(doc(employer, 'chats/chat-open-job')));
  await assertFails(getDoc(doc(other, 'chats/chat-open-job')));
  await assertSucceeds(
    addDoc(collection(employer, 'chats/chat-open-job/messages'), {
      senderId: 'employer',
      senderName: 'Emma Employer',
      text: 'Can you come tomorrow?',
      kind: 'text',
      createdAtMs: now + 1,
    }),
  );
  await assertFails(
    addDoc(collection(employer, 'chats/chat-open-job/messages'), {
      senderId: 'employer',
      senderName: 'Pat Provider',
      text: 'Spoofed sender',
      kind: 'text',
      createdAtMs: now + 2,
    }),
  );
});

test('incomplete accounts cannot bypass onboarding through chats or messages', async () => {
  await seed();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, 'users/incomplete-employer'),
      privateUser('employer', 'Incomplete Employer', { availability: '' }),
    );
  });

  const incomplete = dbFor('incomplete-employer');
  await assertFails(
    setDoc(doc(incomplete, 'chats/direct-incomplete-provider'), {
      jobId: '',
      jobTitle: 'Direct message',
      participants: ['incomplete-employer', 'provider'],
      participantNames: { 'incomplete-employer': 'Incomplete Employer', provider: 'Pat Provider' },
      lastMessage: '',
      lastMessageAtMs: now,
      lastReadAt: {},
      createdAtMs: now,
    }),
  );
  await assertFails(getDoc(doc(incomplete, 'chats/chat-open-job')));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await updateDoc(doc(db, 'chats/chat-open-job'), {
      participants: ['employer', 'provider', 'incomplete-employer'],
      participantNames: {
        employer: 'Emma Employer',
        provider: 'Pat Provider',
        'incomplete-employer': 'Incomplete Employer',
      },
    });
  });
  await assertFails(getDoc(doc(incomplete, 'chats/chat-open-job')));
  await assertFails(
    addDoc(collection(incomplete, 'chats/chat-open-job/messages'), {
      senderId: 'incomplete-employer',
      senderName: 'Incomplete Employer',
      text: 'Trying to bypass onboarding',
      kind: 'text',
      createdAtMs: now + 3,
    }),
  );
});

test('notifications are job-participant scoped and recipients alone can mark them read', async () => {
  await seed();
  const employer = dbFor('employer');
  const provider = dbFor('provider');
  const other = dbFor('other');
  await assertSucceeds(getDoc(doc(provider, 'notifications/provider-note')));
  await assertFails(getDoc(doc(employer, 'notifications/provider-note')));
  await assertSucceeds(updateDoc(doc(provider, 'notifications/provider-note'), { read: true }));
  await assertFails(updateDoc(doc(other, 'notifications/provider-note'), { read: true }));
  await assertSucceeds(
    addDoc(collection(employer, 'notifications'), {
      userId: 'provider',
      kind: 'job',
      title: 'Job update',
      body: 'Your accepted job has changed.',
      jobId: 'accepted-job',
      read: false,
      createdAtMs: now + 1,
    }),
  );
  await assertFails(
    addDoc(collection(other, 'notifications'), {
      userId: 'employer',
      kind: 'job',
      title: 'Fake update',
      body: 'This user is not part of the job.',
      jobId: 'accepted-job',
      read: false,
      createdAtMs: now + 2,
    }),
  );
});

test('only completed-job participants can submit immutable reviews and reports stay admin-only', async () => {
  await seed();
  const employer = dbFor('employer');
  const other = dbFor('other');
  const admin = dbFor('admin');
  const review = {
    jobId: 'completed-job',
    jobTitle: 'Deep clean a two-bedroom apartment',
    reviewerId: 'employer',
    reviewerName: 'Emma Employer',
    targetUserId: 'provider',
    rating: 5,
    tags: ['Professional'],
    comment: 'Excellent work.',
    createdAtMs: now + 1,
  };
  await assertFails(
    setDoc(doc(employer, 'jobs/completed-job/review/employer'), {
      ...review,
      privateOrUnexpectedPayload: 'x'.repeat(10_000),
    }),
  );
  const reviewBatch = writeBatch(employer);
  reviewBatch.set(doc(employer, 'jobs/completed-job/review/employer'), review);
  reviewBatch.update(doc(employer, 'jobs/completed-job'), { reviewedBy: ['employer'] });
  await assertSucceeds(reviewBatch.commit());
  await assertFails(updateDoc(doc(employer, 'jobs/completed-job'), { reviewedBy: ['employer', 'provider'] }));
  await assertFails(updateDoc(doc(other, 'jobs/completed-job'), { reviewedBy: ['employer', 'other'] }));
  await assertFails(setDoc(doc(other, 'jobs/completed-job/review/other'), { ...review, reviewerId: 'other', reviewerName: 'Other Provider' }));
  await assertSucceeds(
    addDoc(collection(employer, 'reports'), {
      reporterId: 'employer',
      reportedUserId: 'provider',
      reason: 'No-show or cancellation',
      message: 'Test report.',
      createdAtMs: now + 2,
    }),
  );
  await assertFails(getDoc(doc(employer, 'reports/any-report')));
  await assertSucceeds(getDoc(doc(admin, 'reports/any-report')));
});