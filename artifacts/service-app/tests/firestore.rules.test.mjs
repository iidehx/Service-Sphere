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
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
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
  priceRange: '',
  companyInfo: '',
  bio: '',
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
  createdAtMs: now,
  ...extra,
});

const publicProfile = (role, name, extra = {}) => ({
  name,
  role,
  workArea: 'Austin, TX',
  categories: role === 'provider' ? ['Cleaning'] : [],
  priceRange: '',
  companyInfo: '',
  bio: '',
  avatarUrl: '',
  ratingAvg: 0,
  ratingCount: 0,
  recentReviews: [],
  verified: false,
  availableForWork: true,
  createdAtMs: now,
  ...extra,
});

const job = (overrides = {}) => ({
  title: 'Deep clean a two-bedroom apartment',
  category: 'Cleaning',
  details: 'Clean the kitchen, bathrooms, floors, and inside the cabinets.',
  priceOffer: 180,
  scheduledAt: '2026-09-01T10:00:00.000Z',
  leaveTimeToEmployee: false,
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
      setDoc(doc(db, 'publicProfiles/employer'), publicProfile('employer', 'Emma Employer')),
      setDoc(doc(db, 'publicProfiles/provider'), publicProfile('provider', 'Pat Provider')),
      setDoc(doc(db, 'publicProfiles/other'), publicProfile('provider', 'Other Provider')),
      setDoc(doc(db, 'publicProfiles/disabled'), publicProfile('employer', 'Disabled Employer')),
      setDoc(doc(db, 'admins/admin'), { enabled: true }),
      setDoc(doc(db, 'jobs/open-job'), job()),
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

test('unverified accounts can provision profiles but cannot write marketplace data', async () => {
  await seed();
  const unverified = dbFor('unverified', { email_verified: false });
  const accountSetup = writeBatch(unverified);
  accountSetup.set(doc(unverified, 'users/unverified'), privateUser('employer', 'Unverified Employer'));
  accountSetup.set(doc(unverified, 'publicProfiles/unverified'), publicProfile('employer', 'Unverified Employer'));
  await assertSucceeds(accountSetup.commit());

  await assertFails(setDoc(doc(unverified, 'jobs/unverified-job'), job({
    employerId: 'unverified',
    employerName: 'Unverified Employer',
  })));
  await assertFails(updateDoc(doc(unverified, 'users/unverified'), { blockedUserIds: ['provider'] }));

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

  await assertFails(getDocs(collection(unverified, 'jobs')));
  await assertFails(getDoc(doc(unverified, 'publicProfiles/provider')));
  await assertFails(getDoc(doc(unverified, 'chats/unverified-chat')));
  await assertFails(getDocs(collection(unverified, 'chats/unverified-chat/messages')));
  await assertFails(updateDoc(doc(unverified, 'notifications/unverified-note'), { read: true }));
  await assertFails(deleteDoc(doc(unverified, 'notifications/unverified-note')));
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

  const browseResults = await getDocs(query(collection(provider, 'jobs'), orderBy('createdAtMs', 'desc'), limit(200)));
  assert.ok(browseResults.docs.some((result) => result.id === 'new-calendar-job'));
  await assertSucceeds(
    updateDoc(doc(provider, 'jobs/new-calendar-job'), {
      employeeId: 'new-provider',
      employeeName: 'New Provider',
      status: 'negotiating',
    }),
  );
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