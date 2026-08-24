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

const dbFor = (uid) => testEnv.authenticatedContext(uid).firestore();

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
  await assertFails(updateDoc(doc(provider, 'users/employer'), { blockedUserIds: ['other'] }));
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