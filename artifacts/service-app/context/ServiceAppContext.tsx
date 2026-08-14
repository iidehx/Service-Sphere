import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as updateAuthProfile,
} from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';
import {
  AppNotification,
  Chat,
  ChatMessage,
  DemoDb,
  DEMO_STORAGE_KEY,
  Job,
  makeSeedDb,
  NotificationKind,
  PLATFORM_FEE_RATE,
  PublicProfile,
  QuoteBreakdown,
  quoteTotal,
  Review,
  Role,
  round2,
  SessionUser,
  chatIdForJob,
  toPublicProfile,
} from './types';

export * from './types';

export type AppMode = 'firebase' | 'demo';
export type GoogleIntent = 'login' | 'register';

export type ProfilePatch = Partial<
  Pick<
    SessionUser,
    'name' | 'workArea' | 'bio' | 'categories' | 'priceRange' | 'companyInfo' | 'avatarUrl' | 'notifyQuotes'
  >
>;

export type NewJobInput = Pick<
  Job,
  'title' | 'category' | 'details' | 'priceOffer' | 'scheduledAt' | 'leaveTimeToEmployee'
>;

export type ReviewInput = {
  rating: number;
  communication?: number;
  quality?: number;
  punctuality?: number;
  tags: string[];
  comment?: string;
};

type ServiceAppContextValue = {
  mode: AppMode;
  ready: boolean;
  authBusy: boolean;
  user: SessionUser | null;
  needsRole: boolean;
  jobs: Job[];
  chats: Chat[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  unreadMessageCount: number;
  // Auth
  registerWithEmail: (name: string, email: string, password: string, role: Role) => Promise<string | null>;
  loginWithEmail: (email: string, password: string) => Promise<string | null>;
  loginWithGoogleIdToken: (idToken: string, intent: GoogleIntent) => Promise<string | null>;
  completeRoleSelection: (role: Role) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOutUser: () => Promise<void>;
  demoSignIn: (role: Role) => Promise<void>;
  // Jobs
  addJob: (input: NewJobInput) => Promise<string | null>;
  acceptJob: (jobId: string) => Promise<{ chatId?: string; error?: string }>;
  toggleSaved: (jobId: string) => Promise<void>;
  proposeQuote: (jobId: string, breakdown: QuoteBreakdown) => Promise<string | null>;
  acceptQuote: (jobId: string) => Promise<string | null>;
  declineQuote: (jobId: string) => Promise<string | null>;
  updatePayment: (jobId: string, status: 'paid' | 'refunded') => Promise<string | null>;
  completeJob: (jobId: string) => Promise<string | null>;
  submitReview: (jobId: string, input: ReviewInput) => Promise<string | null>;
  // Chat
  sendMessage: (chatId: string, text: string) => Promise<void>;
  markChatRead: (chatId: string) => void;
  // People
  getUserProfile: (userId: string) => Promise<PublicProfile | null>;
  searchProviders: (params: { name?: string; category?: string; workArea?: string }) => Promise<PublicProfile[]>;
  startDirectChat: (providerId: string) => Promise<{ chatId?: string; error?: string }>;
  reportUser: (input: { userId: string; jobId?: string; reason: string; message: string }) => Promise<string | null>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  // Notifications & profile
  markNotificationsRead: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<string | null>;
  saveAvatar: (localUri: string) => Promise<string | null>;
};

const ServiceAppContext = createContext<ServiceAppContextValue | null>(null);

// ---------------------------------------------------------------------------
// Firestore document mappers (defensive defaults so partial docs never crash)
// ---------------------------------------------------------------------------

function mapUser(id: string, d: any): SessionUser {
  return {
    id,
    name: d?.name ?? 'User',
    email: d?.email ?? '',
    role: d?.role === 'provider' ? 'provider' : 'employer',
    workArea: d?.workArea ?? '',
    categories: Array.isArray(d?.categories) ? d.categories : [],
    priceRange: d?.priceRange ?? '',
    companyInfo: d?.companyInfo ?? '',
    bio: d?.bio ?? '',
    avatarUrl: d?.avatarUrl ?? '',
    ratingAvg: typeof d?.ratingAvg === 'number' ? d.ratingAvg : 0,
    ratingCount: typeof d?.ratingCount === 'number' ? d.ratingCount : 0,
    recentReviews: Array.isArray(d?.recentReviews) ? d.recentReviews : [],
    savedJobIds: Array.isArray(d?.savedJobIds) ? d.savedJobIds : [],
    blockedUserIds: Array.isArray(d?.blockedUserIds) ? d.blockedUserIds : [],
    notifyQuotes: d?.notifyQuotes !== false,
    verified: Boolean(d?.verified),
    createdAtMs: typeof d?.createdAtMs === 'number' ? d.createdAtMs : Date.now(),
  };
}

function mapJob(id: string, d: any): Job {
  return {
    id,
    title: d?.title ?? 'Untitled job',
    category: d?.category ?? 'Other',
    details: d?.details ?? '',
    priceOffer: typeof d?.priceOffer === 'number' ? d.priceOffer : 0,
    employerId: d?.employerId ?? '',
    employerName: d?.employerName ?? 'Employer',
    employeeId: d?.employeeId ?? undefined,
    employeeName: d?.employeeName ?? undefined,
    status: ['open', 'negotiating', 'accepted', 'completed'].includes(d?.status) ? d.status : 'open',
    scheduledAt: d?.scheduledAt ?? '',
    leaveTimeToEmployee: Boolean(d?.leaveTimeToEmployee),
    proposedPrice: typeof d?.proposedPrice === 'number' ? d.proposedPrice : undefined,
    quoteBreakdown: d?.quoteBreakdown ?? undefined,
    quoteBy: d?.quoteBy ?? undefined,
    employerQuoteAccepted: Boolean(d?.employerQuoteAccepted),
    employeeQuoteAccepted: Boolean(d?.employeeQuoteAccepted),
    agreedPrice: typeof d?.agreedPrice === 'number' ? d.agreedPrice : undefined,
    platformFee: typeof d?.platformFee === 'number' ? d.platformFee : undefined,
    paymentStatus: ['pending', 'paid', 'refunded'].includes(d?.paymentStatus) ? d.paymentStatus : 'pending',
    reviewedBy: Array.isArray(d?.reviewedBy) ? d.reviewedBy : [],
    createdAtMs: typeof d?.createdAtMs === 'number' ? d.createdAtMs : Date.now(),
  };
}

function mapChat(id: string, d: any): Chat {
  return {
    id,
    jobId: d?.jobId ?? '',
    jobTitle: d?.jobTitle ?? 'Job',
    participants: Array.isArray(d?.participants) ? d.participants : [],
    participantNames: d?.participantNames ?? {},
    lastMessage: d?.lastMessage ?? '',
    lastMessageAtMs: typeof d?.lastMessageAtMs === 'number' ? d.lastMessageAtMs : 0,
    lastSenderId: d?.lastSenderId ?? undefined,
    lastReadAt: d?.lastReadAt ?? {},
    createdAtMs: typeof d?.createdAtMs === 'number' ? d.createdAtMs : Date.now(),
  };
}

function mapNotif(id: string, d: any): AppNotification {
  return {
    id,
    userId: d?.userId ?? '',
    kind: d?.kind ?? 'system',
    title: d?.title ?? '',
    body: d?.body ?? '',
    jobId: d?.jobId ?? undefined,
    chatId: d?.chatId ?? undefined,
    read: Boolean(d?.read),
    createdAtMs: typeof d?.createdAtMs === 'number' ? d.createdAtMs : Date.now(),
  };
}

function mapMessage(id: string, d: any): ChatMessage {
  return {
    id,
    senderId: d?.senderId ?? '',
    senderName: d?.senderName ?? '',
    text: d?.text ?? '',
    kind: ['text', 'system', 'quote'].includes(d?.kind) ? d.kind : 'text',
    createdAtMs: typeof d?.createdAtMs === 'number' ? d.createdAtMs : Date.now(),
  };
}

function friendlyError(e: any): string {
  const code: string = e?.code ?? '';
  if (code.includes('email-already-in-use')) return 'An account with this email already exists.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Incorrect email or password.';
  if (code.includes('invalid-email')) return 'That email address looks invalid.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (code.includes('network-request-failed')) return 'Network error. Check your connection and try again.';
  if (code.includes('permission-denied')) return 'Permission denied. Make sure the Firestore security rules are published.';
  if (code.includes('unavailable')) return 'The service is temporarily unreachable. Try again shortly.';
  const message = typeof e?.message === 'string' ? e.message.replace(/^Firebase:\s*/, '') : '';
  return message || 'Something went wrong. Please try again.';
}

function newUserDoc(name: string, email: string, role: Role) {
  return {
    name: name.trim() || 'New user',
    email: email.trim().toLowerCase(),
    role,
    workArea: '',
    categories: [],
    priceRange: '',
    companyInfo: '',
    bio: '',
    avatarUrl: '',
    ratingAvg: 0,
    ratingCount: 0,
    recentReviews: [],
    savedJobIds: [],
    blockedUserIds: [],
    notifyQuotes: true,
    verified: false,
    createdAtMs: Date.now(),
  };
}

const rid = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ServiceAppProvider({ children }: { children: ReactNode }) {
  const mode: AppMode = isFirebaseConfigured ? 'firebase' : 'demo';

  // Demo-mode local database
  const [demoDb, setDemoDb] = useState<DemoDb | null>(null);

  // Firebase-mode state
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [fbUser, setFbUser] = useState<SessionUser | null>(null);
  const [fbJobs, setFbJobs] = useState<Job[]>([]);
  const [fbChats, setFbChats] = useState<Chat[]>([]);
  const [fbNotifs, setFbNotifs] = useState<AppNotification[]>([]);

  const [needsRole, setNeedsRole] = useState(false);
  const [ready, setReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const googleIntent = useRef<GoogleIntent | null>(null);
  const docWriteInFlight = useRef(false);

  // ---- Demo boot & persistence -------------------------------------------
  useEffect(() => {
    if (mode !== 'demo') return;
    AsyncStorage.getItem(DEMO_STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as DemoDb;
            if (parsed && parsed.users && Array.isArray(parsed.jobs)) {
              setDemoDb(parsed);
              return;
            }
          } catch {
            // fall through to fresh seed
          }
        }
        setDemoDb(makeSeedDb());
      })
      .finally(() => setReady(true));
  }, [mode]);

  useEffect(() => {
    if (mode === 'demo' && ready && demoDb) {
      AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoDb)).catch(() => undefined);
    }
  }, [mode, ready, demoDb]);

  // ---- Firebase auth listener ---------------------------------------------
  useEffect(() => {
    if (mode !== 'firebase') return;
    const { auth } = getFirebase();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setAuthUid(u.uid);
      } else {
        setAuthUid(null);
        setFbUser(null);
        setFbJobs([]);
        setFbChats([]);
        setFbNotifs([]);
        setNeedsRole(false);
        googleIntent.current = null;
        setReady(true);
      }
    });
    return unsub;
  }, [mode]);

  // ---- Firebase user document subscription --------------------------------
  useEffect(() => {
    if (mode !== 'firebase' || !authUid) return;
    const { db, auth } = getFirebase();
    const unsub = onSnapshot(
      doc(db, 'users', authUid),
      async (snap) => {
        if (snap.exists()) {
          setFbUser(mapUser(snap.id, snap.data()));
          setNeedsRole(false);
          googleIntent.current = null;
          setReady(true);
        } else if (!docWriteInFlight.current) {
          if (googleIntent.current === 'register') {
            // First Google sign-up: ask which role they want before creating the doc.
            setNeedsRole(true);
            setReady(true);
          } else {
            // Google login (or restored session) without a profile: default Employee doc.
            docWriteInFlight.current = true;
            try {
              const u = auth.currentUser;
              await setDoc(doc(db, 'users', authUid), newUserDoc(u?.displayName ?? 'New user', u?.email ?? '', 'employer'));
            } catch {
              setReady(true);
            } finally {
              docWriteInFlight.current = false;
            }
          }
        }
      },
      () => setReady(true),
    );
    return unsub;
  }, [mode, authUid]);

  // ---- Firebase collection subscriptions ----------------------------------
  useEffect(() => {
    if (mode !== 'firebase' || !authUid) return;
    const { db } = getFirebase();
    const unsubJobs = onSnapshot(
      query(collection(db, 'jobs'), orderBy('createdAtMs', 'desc'), limit(200)),
      (snap) => setFbJobs(snap.docs.map((d) => mapJob(d.id, d.data()))),
      () => undefined,
    );
    const unsubChats = onSnapshot(
      query(collection(db, 'chats'), where('participants', 'array-contains', authUid)),
      (snap) => setFbChats(snap.docs.map((d) => mapChat(d.id, d.data()))),
      () => undefined,
    );
    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', authUid), limit(100)),
      (snap) => setFbNotifs(snap.docs.map((d) => mapNotif(d.id, d.data()))),
      () => undefined,
    );
    return () => {
      unsubJobs();
      unsubChats();
      unsubNotifs();
    };
  }, [mode, authUid]);

  // ---- Derived state -------------------------------------------------------
  const user: SessionUser | null = useMemo(() => {
    if (mode === 'firebase') return fbUser;
    if (!demoDb?.sessionUserId) return null;
    const record = demoDb.users[demoDb.sessionUserId];
    if (!record) return null;
    const { password: _pw, ...rest } = record;
    return rest;
  }, [mode, fbUser, demoDb]);

  const jobs: Job[] = useMemo(() => {
    const list = mode === 'firebase' ? fbJobs : demoDb?.jobs ?? [];
    return [...list].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [mode, fbJobs, demoDb]);

  const chats: Chat[] = useMemo(() => {
    const list = mode === 'firebase' ? fbChats : user ? (demoDb?.chats ?? []).filter((c) => c.participants.includes(user.id)) : [];
    return [...list].sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
  }, [mode, fbChats, demoDb, user]);

  const notifications: AppNotification[] = useMemo(() => {
    const list = mode === 'firebase' ? fbNotifs : user ? (demoDb?.notifications ?? []).filter((n) => n.userId === user.id) : [];
    const filtered = user && !user.notifyQuotes ? list.filter((n) => n.kind !== 'quote') : list;
    return [...filtered].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [mode, fbNotifs, demoDb, user]);

  const unreadNotificationCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const unreadMessageCount = useMemo(() => {
    if (!user) return 0;
    return chats.filter(
      (c) => c.lastMessageAtMs > (c.lastReadAt[user.id] ?? 0) && c.lastSenderId !== user.id && c.lastSenderId,
    ).length;
  }, [chats, user]);

  const updateDemo = (fn: (d: DemoDb) => DemoDb) => setDemoDb((prev) => (prev ? fn(prev) : prev));

  const demoNotify = (
    d: DemoDb,
    userId: string,
    kind: NotificationKind,
    title: string,
    body: string,
    jobId?: string,
    chatId?: string,
  ): DemoDb => ({
    ...d,
    notifications: [
      { id: rid('n'), userId, kind, title, body, jobId, chatId, read: false, createdAtMs: Date.now() },
      ...d.notifications,
    ],
  });

  const fbNotify = async (
    userId: string,
    kind: NotificationKind,
    title: string,
    body: string,
    jobId?: string,
    chatId?: string,
  ) => {
    try {
      const { db } = getFirebase();
      await addDoc(collection(db, 'notifications'), {
        userId,
        kind,
        title,
        body,
        ...(jobId ? { jobId } : {}),
        ...(chatId ? { chatId } : {}),
        read: false,
        createdAtMs: Date.now(),
      });
    } catch {
      // Notifications are best-effort; never block the main action.
    }
  };

  // ---- Auth operations ------------------------------------------------------
  const registerWithEmail = async (name: string, email: string, password: string, role: Role) => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) return 'Please enter your full name (at least 2 characters).';
    if (password.length < 6) return 'Password must be at least 6 characters.';

    if (mode === 'demo') {
      const exists = Object.values(demoDb?.users ?? {}).some((u) => u.email.toLowerCase() === cleanEmail);
      if (exists) return 'An account with this email already exists.';
      const id = rid('user');
      updateDemo((d) => ({
        ...d,
        users: {
          ...d.users,
          [id]: {
            ...newUserDoc(cleanName, cleanEmail, role),
            id,
            password,
          },
        },
        sessionUserId: id,
      }));
      return null;
    }

    setAuthBusy(true);
    docWriteInFlight.current = true;
    try {
      const { auth, db } = getFirebase();
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      try {
        await updateAuthProfile(cred.user, { displayName: cleanName });
      } catch {
        // Display name is cosmetic; continue.
      }
      await setDoc(doc(db, 'users', cred.user.uid), newUserDoc(cleanName, cleanEmail, role));
      return null;
    } catch (e) {
      return friendlyError(e);
    } finally {
      docWriteInFlight.current = false;
      setAuthBusy(false);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'demo') {
      const record = Object.values(demoDb?.users ?? {}).find((u) => u.email.toLowerCase() === cleanEmail);
      if (!record || (record.password && record.password !== password)) return 'Incorrect email or password.';
      updateDemo((d) => ({ ...d, sessionUserId: record.id }));
      return null;
    }
    setAuthBusy(true);
    try {
      const { auth } = getFirebase();
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      return null;
    } catch (e) {
      return friendlyError(e);
    } finally {
      setAuthBusy(false);
    }
  };

  const loginWithGoogleIdToken = async (idToken: string, intent: GoogleIntent) => {
    if (mode === 'demo') return 'Google sign-in becomes available once Firebase is connected.';
    setAuthBusy(true);
    googleIntent.current = intent;
    try {
      const { auth } = getFirebase();
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      return null;
    } catch (e) {
      googleIntent.current = null;
      return friendlyError(e);
    } finally {
      setAuthBusy(false);
    }
  };

  const completeRoleSelection = async (role: Role) => {
    if (mode === 'demo') return null;
    const { auth, db } = getFirebase();
    const u = auth.currentUser;
    if (!u) return 'Your session expired. Please sign in again.';
    docWriteInFlight.current = true;
    try {
      await setDoc(doc(db, 'users', u.uid), newUserDoc(u.displayName ?? 'New user', u.email ?? '', role));
      googleIntent.current = null;
      setNeedsRole(false);
      return null;
    } catch (e) {
      return friendlyError(e);
    } finally {
      docWriteInFlight.current = false;
    }
  };

  const resetPassword = async (email: string) => {
    if (mode === 'demo') return 'Password reset becomes available once Firebase is connected.';
    try {
      const { auth } = getFirebase();
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const signOutUser = async () => {
    if (mode === 'demo') {
      updateDemo((d) => ({ ...d, sessionUserId: null }));
      return;
    }
    try {
      const { auth } = getFirebase();
      await fbSignOut(auth);
    } catch {
      // onAuthStateChanged clears local state regardless.
    }
  };

  const demoSignIn = async (role: Role) => {
    if (mode !== 'demo') return;
    updateDemo((d) => ({ ...d, sessionUserId: role === 'employer' ? 'employer-1' : 'provider-1' }));
  };

  // ---- Job operations --------------------------------------------------------
  const addJob = async (input: NewJobInput) => {
    if (!user) return 'Please sign in first.';
    if (user.role !== 'employer') return 'Only employers can post jobs.';
    const payload = {
      ...input,
      title: input.title.trim(),
      details: input.details.trim(),
      employerId: user.id,
      employerName: user.name,
      status: 'open' as const,
      paymentStatus: 'pending' as const,
      employerQuoteAccepted: false,
      employeeQuoteAccepted: false,
      reviewedBy: [] as string[],
      createdAtMs: Date.now(),
    };
    if (mode === 'demo') {
      updateDemo((d) => ({ ...d, jobs: [{ ...payload, id: rid('job') }, ...d.jobs] }));
      return null;
    }
    try {
      const { db } = getFirebase();
      await addDoc(collection(db, 'jobs'), payload);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const acceptJob = async (jobId: string) => {
    if (!user) return { error: 'Please sign in first.' };
    if (user.role !== 'provider') return { error: 'Only service providers can accept jobs.' };
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return { error: 'This job no longer exists.' };
    if (job.status !== 'open') return { error: 'This job was already taken by another provider.' };
    if (job.employerId === user.id) return { error: 'You cannot accept your own job.' };

    const chatId = chatIdForJob(jobId);
    const now = Date.now();
    const sysText = `${user.name} accepted the job. Discuss the details and agree on a quote.`;

    if (mode === 'demo') {
      updateDemo((d) => {
        let next: DemoDb = {
          ...d,
          jobs: d.jobs.map((j) =>
            j.id === jobId ? { ...j, employeeId: user.id, employeeName: user.name, status: 'negotiating' as const } : j,
          ),
        };
        if (!next.chats.some((c) => c.id === chatId)) {
          next = {
            ...next,
            chats: [
              {
                id: chatId,
                jobId,
                jobTitle: job.title,
                participants: [job.employerId, user.id],
                participantNames: { [job.employerId]: job.employerName, [user.id]: user.name },
                lastMessage: sysText,
                lastMessageAtMs: now,
                lastSenderId: user.id,
                lastReadAt: { [user.id]: now },
                createdAtMs: now,
                messages: [
                  { id: rid('m'), senderId: user.id, senderName: user.name, text: sysText, kind: 'system', createdAtMs: now },
                ],
              },
              ...next.chats,
            ],
          };
        }
        return demoNotify(next, job.employerId, 'job', 'Provider accepted your job', `${user.name} accepted "${job.title}". Open the chat to agree on a quote.`, jobId, chatId);
      });
      return { chatId };
    }

    try {
      const { db } = getFirebase();
      await setDoc(
        doc(db, 'chats', chatId),
        {
          jobId,
          jobTitle: job.title,
          participants: [job.employerId, user.id],
          participantNames: { [job.employerId]: job.employerName, [user.id]: user.name },
          lastMessage: sysText,
          lastMessageAtMs: now,
          lastSenderId: user.id,
          lastReadAt: { [user.id]: now },
          createdAtMs: now,
        },
        { merge: true },
      );
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.id,
        senderName: user.name,
        text: sysText,
        kind: 'system',
        createdAtMs: now,
      });
      await updateDoc(doc(db, 'jobs', jobId), {
        employeeId: user.id,
        employeeName: user.name,
        status: 'negotiating',
      });
      await fbNotify(job.employerId, 'job', 'Provider accepted your job', `${user.name} accepted "${job.title}". Open the chat to agree on a quote.`, jobId, chatId);
      return { chatId };
    } catch (e) {
      return { error: friendlyError(e) };
    }
  };

  const toggleSaved = async (jobId: string) => {
    if (!user) return;
    const saved = user.savedJobIds.includes(jobId);
    if (mode === 'demo') {
      updateDemo((d) => {
        const record = d.users[user.id];
        if (!record) return d;
        const savedJobIds = saved ? record.savedJobIds.filter((id) => id !== jobId) : [...record.savedJobIds, jobId];
        return { ...d, users: { ...d.users, [user.id]: { ...record, savedJobIds } } };
      });
      return;
    }
    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'users', user.id), {
        savedJobIds: saved ? arrayRemove(jobId) : arrayUnion(jobId),
      });
    } catch {
      // Non-critical.
    }
  };

  const sendChatUpdate = async (chatId: string, message: Omit<ChatMessage, 'id'>) => {
    const { db } = getFirebase();
    await addDoc(collection(db, 'chats', chatId, 'messages'), { ...message });
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: message.text,
      lastMessageAtMs: message.createdAtMs,
      lastSenderId: message.senderId,
      [`lastReadAt.${message.senderId}`]: message.createdAtMs,
    });
  };

  const demoChatUpdate = (d: DemoDb, chatId: string, message: ChatMessage): DemoDb => ({
    ...d,
    chats: d.chats.map((c) =>
      c.id === chatId
        ? {
            ...c,
            messages: [...(c.messages ?? []), message],
            lastMessage: message.text,
            lastMessageAtMs: message.createdAtMs,
            lastSenderId: message.senderId,
            lastReadAt: { ...c.lastReadAt, [message.senderId]: message.createdAtMs },
          }
        : c,
    ),
  });

  const proposeQuote = async (jobId: string, breakdown: QuoteBreakdown) => {
    if (!user) return 'Please sign in first.';
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return 'This job no longer exists.';
    if (job.employerId !== user.id && job.employeeId !== user.id) return 'Only the job participants can send a quote.';
    if (job.status === 'accepted') return 'A quote was already agreed. Decline it first to renegotiate.';
    if (job.status === 'completed') return 'This job is already completed.';
    const total = quoteTotal(breakdown);
    if (total <= 0) return 'The quote total must be greater than zero.';

    const isEmployer = job.employerId === user.id;
    const now = Date.now();
    const chatId = chatIdForJob(jobId);
    const quoteMessage: ChatMessage = {
      id: rid('m'),
      senderId: user.id,
      senderName: user.name,
      text: `Proposed a quote: $${total}`,
      kind: 'quote',
      createdAtMs: now,
    };
    const otherId = isEmployer ? job.employeeId : job.employerId;

    if (mode === 'demo') {
      updateDemo((d) => {
        let next: DemoDb = {
          ...d,
          jobs: d.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'negotiating' as const,
                  proposedPrice: total,
                  quoteBreakdown: breakdown,
                  quoteBy: user.id,
                  employerQuoteAccepted: isEmployer,
                  employeeQuoteAccepted: !isEmployer,
                  agreedPrice: undefined,
                  platformFee: undefined,
                }
              : j,
          ),
        };
        next = demoChatUpdate(next, chatId, quoteMessage);
        if (otherId) {
          next = demoNotify(next, otherId, 'quote', 'New quote received', `${user.name} proposed $${total} for "${job.title}".`, jobId, chatId);
        }
        return next;
      });
      return null;
    }

    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'negotiating',
        proposedPrice: total,
        quoteBreakdown: breakdown,
        quoteBy: user.id,
        employerQuoteAccepted: isEmployer,
        employeeQuoteAccepted: !isEmployer,
        agreedPrice: deleteField(),
        platformFee: deleteField(),
      });
      await sendChatUpdate(chatId, {
        senderId: user.id,
        senderName: user.name,
        text: quoteMessage.text,
        kind: 'quote',
        createdAtMs: now,
      });
      if (otherId) {
        await fbNotify(otherId, 'quote', 'New quote received', `${user.name} proposed $${total} for "${job.title}".`, jobId, chatId);
      }
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const acceptQuote = async (jobId: string) => {
    if (!user) return 'Please sign in first.';
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !job.proposedPrice) return 'There is no quote to accept yet.';
    if (job.employerId !== user.id && job.employeeId !== user.id) return 'Only the job participants can accept a quote.';
    if (job.status === 'completed') return 'This job is already completed.';

    const isEmployer = job.employerId === user.id;
    const employerAccepted = isEmployer ? true : Boolean(job.employerQuoteAccepted);
    const employeeAccepted = isEmployer ? Boolean(job.employeeQuoteAccepted) : true;
    const bothAccepted = employerAccepted && employeeAccepted;
    const agreedPrice = job.proposedPrice;
    const platformFee = round2(agreedPrice * PLATFORM_FEE_RATE);
    const now = Date.now();
    const chatId = chatIdForJob(jobId);
    const otherId = isEmployer ? job.employeeId : job.employerId;
    const sysText = bothAccepted
      ? `Quote accepted by both sides. Job confirmed at $${agreedPrice}.`
      : `${user.name} accepted the quote of $${agreedPrice}. Waiting for the other side to confirm.`;

    if (mode === 'demo') {
      updateDemo((d) => {
        let next: DemoDb = {
          ...d,
          jobs: d.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  employerQuoteAccepted: employerAccepted,
                  employeeQuoteAccepted: employeeAccepted,
                  ...(bothAccepted ? { status: 'accepted' as const, agreedPrice, platformFee } : {}),
                }
              : j,
          ),
        };
        next = demoChatUpdate(next, chatId, {
          id: rid('m'),
          senderId: user.id,
          senderName: user.name,
          text: sysText,
          kind: 'system',
          createdAtMs: now,
        });
        if (otherId) {
          next = demoNotify(
            next,
            otherId,
            bothAccepted ? 'job' : 'quote',
            bothAccepted ? 'Job confirmed' : 'Quote accepted',
            bothAccepted
              ? `"${job.title}" is confirmed at $${agreedPrice}.`
              : `${user.name} accepted the quote for "${job.title}".`,
            jobId,
            chatId,
          );
        }
        return next;
      });
      return null;
    }

    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'jobs', jobId), {
        employerQuoteAccepted: employerAccepted,
        employeeQuoteAccepted: employeeAccepted,
        ...(bothAccepted ? { status: 'accepted', agreedPrice, platformFee } : {}),
      });
      await sendChatUpdate(chatId, {
        senderId: user.id,
        senderName: user.name,
        text: sysText,
        kind: 'system',
        createdAtMs: now,
      });
      if (otherId) {
        await fbNotify(
          otherId,
          bothAccepted ? 'job' : 'quote',
          bothAccepted ? 'Job confirmed' : 'Quote accepted',
          bothAccepted ? `"${job.title}" is confirmed at $${agreedPrice}.` : `${user.name} accepted the quote for "${job.title}".`,
          jobId,
          chatId,
        );
      }
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const declineQuote = async (jobId: string) => {
    if (!user) return 'Please sign in first.';
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !job.proposedPrice) return 'There is no quote to decline.';
    if (job.employerId !== user.id && job.employeeId !== user.id) return 'Only the job participants can decline a quote.';
    if (job.status === 'accepted' || job.status === 'completed') return 'This quote was already agreed.';

    const now = Date.now();
    const chatId = chatIdForJob(jobId);
    const sysText = `${user.name} declined the quote. Discuss and send an updated one.`;
    const otherId = job.employerId === user.id ? job.employeeId : job.employerId;

    if (mode === 'demo') {
      updateDemo((d) => {
        let next: DemoDb = {
          ...d,
          jobs: d.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  proposedPrice: undefined,
                  quoteBreakdown: undefined,
                  quoteBy: undefined,
                  employerQuoteAccepted: false,
                  employeeQuoteAccepted: false,
                }
              : j,
          ),
        };
        next = demoChatUpdate(next, chatId, {
          id: rid('m'),
          senderId: user.id,
          senderName: user.name,
          text: sysText,
          kind: 'system',
          createdAtMs: now,
        });
        if (otherId) next = demoNotify(next, otherId, 'quote', 'Quote declined', `${user.name} declined the quote for "${job.title}".`, jobId, chatId);
        return next;
      });
      return null;
    }

    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'jobs', jobId), {
        proposedPrice: deleteField(),
        quoteBreakdown: deleteField(),
        quoteBy: deleteField(),
        employerQuoteAccepted: false,
        employeeQuoteAccepted: false,
      });
      await sendChatUpdate(chatId, { senderId: user.id, senderName: user.name, text: sysText, kind: 'system', createdAtMs: now });
      if (otherId) await fbNotify(otherId, 'quote', 'Quote declined', `${user.name} declined the quote for "${job.title}".`, jobId, chatId);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const updatePayment = async (jobId: string, status: 'paid' | 'refunded') => {
    if (!user) return 'Please sign in first.';
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return 'This job no longer exists.';
    if (job.employerId !== user.id) return 'Only the employer can update payment.';

    const now = Date.now();
    const chatId = chatIdForJob(jobId);
    const label = status === 'paid' ? 'paid' : 'refunded';
    const sysText = `Payment marked as ${label}${job.agreedPrice ? ` ($${job.agreedPrice})` : ''}.`;

    if (mode === 'demo') {
      updateDemo((d) => {
        let next: DemoDb = { ...d, jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, paymentStatus: status } : j)) };
        if (next.chats.some((c) => c.id === chatId)) {
          next = demoChatUpdate(next, chatId, {
            id: rid('m'),
            senderId: user.id,
            senderName: user.name,
            text: sysText,
            kind: 'system',
            createdAtMs: now,
          });
        }
        if (job.employeeId) next = demoNotify(next, job.employeeId, 'payment', `Payment ${label}`, `${user.name} marked "${job.title}" as ${label}.`, jobId, chatId);
        return next;
      });
      return null;
    }

    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'jobs', jobId), { paymentStatus: status });
      if (chats.some((c) => c.id === chatId)) {
        await sendChatUpdate(chatId, { senderId: user.id, senderName: user.name, text: sysText, kind: 'system', createdAtMs: now });
      }
      if (job.employeeId) await fbNotify(job.employeeId, 'payment', `Payment ${label}`, `${user.name} marked "${job.title}" as ${label}.`, jobId, chatId);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const completeJob = async (jobId: string) => {
    if (!user) return 'Please sign in first.';
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return 'This job no longer exists.';
    if (job.employerId !== user.id) return 'Only the employer can mark a job complete.';
    if (job.status !== 'accepted') return 'A job can be completed only after a quote is agreed.';

    const now = Date.now();
    const chatId = chatIdForJob(jobId);
    const sysText = 'Job marked as completed. Both sides can now leave a review.';

    if (mode === 'demo') {
      updateDemo((d) => {
        let next: DemoDb = { ...d, jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, status: 'completed' as const } : j)) };
        if (next.chats.some((c) => c.id === chatId)) {
          next = demoChatUpdate(next, chatId, {
            id: rid('m'),
            senderId: user.id,
            senderName: user.name,
            text: sysText,
            kind: 'system',
            createdAtMs: now,
          });
        }
        if (job.employeeId) next = demoNotify(next, job.employeeId, 'job', 'Job completed', `${user.name} marked "${job.title}" as completed. Leave a review!`, jobId, chatId);
        return next;
      });
      return null;
    }

    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'jobs', jobId), { status: 'completed' });
      if (chats.some((c) => c.id === chatId)) {
        await sendChatUpdate(chatId, { senderId: user.id, senderName: user.name, text: sysText, kind: 'system', createdAtMs: now });
      }
      if (job.employeeId) await fbNotify(job.employeeId, 'job', 'Job completed', `${user.name} marked "${job.title}" as completed. Leave a review!`, jobId, chatId);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const submitReview = async (jobId: string, input: ReviewInput) => {
    if (!user) return 'Please sign in first.';
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return 'This job no longer exists.';
    if (job.status !== 'completed') return 'Reviews open after the job is completed.';
    if (job.employerId !== user.id && job.employeeId !== user.id) return 'Only the job participants can leave a review.';
    if (job.reviewedBy.includes(user.id)) return 'You already reviewed this job.';
    if (input.rating < 1 || input.rating > 5) return 'Please choose a star rating.';

    const isEmployer = job.employerId === user.id;
    const targetUserId = isEmployer ? job.employeeId : job.employerId;
    if (!targetUserId) return 'There is no one to review on this job yet.';

    const review: Review = {
      id: rid('rev'),
      jobId,
      jobTitle: job.title,
      reviewerId: user.id,
      reviewerName: user.name,
      targetUserId,
      rating: input.rating,
      ...(input.communication ? { communication: input.communication } : {}),
      ...(input.quality ? { quality: input.quality } : {}),
      ...(input.punctuality ? { punctuality: input.punctuality } : {}),
      tags: input.tags,
      comment: input.comment?.trim() || '',
      createdAtMs: Date.now(),
    };

    if (mode === 'demo') {
      updateDemo((d) => {
        const target = d.users[targetUserId];
        let next: DemoDb = {
          ...d,
          jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, reviewedBy: [...j.reviewedBy, user.id] } : j)),
        };
        if (target) {
          const ratingCount = target.ratingCount + 1;
          const ratingAvg = round2((target.ratingAvg * target.ratingCount + review.rating) / ratingCount);
          next = {
            ...next,
            users: {
              ...next.users,
              [targetUserId]: {
                ...target,
                ratingAvg,
                ratingCount,
                recentReviews: [review, ...target.recentReviews].slice(0, 5),
              },
            },
          };
        }
        return demoNotify(next, targetUserId, 'review', 'New review received', `${user.name} rated you ${review.rating}★ on "${job.title}".`, jobId);
      });
      return null;
    }

    try {
      const { db } = getFirebase();
      // Per spec: employer's review of the provider → jobs/{id}/review/{reviewerId};
      // provider's review of the employer → jobs/{id}/employerReview/{reviewerId}.
      const sub = isEmployer ? 'review' : 'employerReview';
      await setDoc(doc(db, 'jobs', jobId, sub, user.id), review);
      await updateDoc(doc(db, 'jobs', jobId), { reviewedBy: arrayUnion(user.id) });
      try {
        const targetSnap = await getDoc(doc(db, 'users', targetUserId));
        if (targetSnap.exists()) {
          const target = mapUser(targetSnap.id, targetSnap.data());
          const ratingCount = target.ratingCount + 1;
          const ratingAvg = round2((target.ratingAvg * target.ratingCount + review.rating) / ratingCount);
          await updateDoc(doc(db, 'users', targetUserId), {
            ratingAvg,
            ratingCount,
            recentReviews: [review, ...target.recentReviews].slice(0, 5),
          });
        }
      } catch {
        // Aggregate update is best-effort; the review itself is stored.
      }
      await fbNotify(targetUserId, 'review', 'New review received', `${user.name} rated you ${review.rating}★ on "${job.title}".`, jobId);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  // ---- Chat operations --------------------------------------------------------
  const sendMessage = async (chatId: string, text: string) => {
    const clean = text.trim();
    if (!clean || !user) return;
    const message: ChatMessage = {
      id: rid('m'),
      senderId: user.id,
      senderName: user.name,
      text: clean,
      kind: 'text',
      createdAtMs: Date.now(),
    };
    if (mode === 'demo') {
      updateDemo((d) => demoChatUpdate(d, chatId, message));
      return;
    }
    try {
      await sendChatUpdate(chatId, {
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        kind: 'text',
        createdAtMs: message.createdAtMs,
      });
    } catch {
      // Surface-level failure is visible (message won't appear).
    }
  };

  const markChatRead = (chatId: string) => {
    if (!user) return;
    const now = Date.now();
    if (mode === 'demo') {
      updateDemo((d) => ({
        ...d,
        chats: d.chats.map((c) => (c.id === chatId ? { ...c, lastReadAt: { ...c.lastReadAt, [user.id]: now } } : c)),
      }));
      return;
    }
    const { db } = getFirebase();
    updateDoc(doc(db, 'chats', chatId), { [`lastReadAt.${user.id}`]: now }).catch(() => undefined);
  };

  // ---- People -------------------------------------------------------------------
  const getUserProfile = async (userId: string): Promise<PublicProfile | null> => {
    if (mode === 'demo') {
      const record = demoDb?.users[userId];
      return record ? toPublicProfile(record) : null;
    }
    try {
      const { db } = getFirebase();
      const snap = await getDoc(doc(db, 'users', userId));
      return snap.exists() ? toPublicProfile(mapUser(snap.id, snap.data())) : null;
    } catch {
      return null;
    }
  };

  const reportUser = async (input: { userId: string; jobId?: string; reason: string; message: string }) => {
    if (!user) return 'Please sign in first.';
    const payload = {
      reporterId: user.id,
      reportedUserId: input.userId,
      ...(input.jobId ? { jobId: input.jobId } : {}),
      reason: input.reason,
      message: input.message.trim(),
      createdAtMs: Date.now(),
    };
    if (mode === 'demo') {
      updateDemo((d) => ({ ...d, reports: [{ ...payload, id: rid('rep') }, ...d.reports] }));
      return null;
    }
    try {
      const { db } = getFirebase();
      await addDoc(collection(db, 'reports'), payload);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const setBlocked = async (userId: string, blocked: boolean) => {
    if (!user) return;
    if (mode === 'demo') {
      updateDemo((d) => {
        const record = d.users[user.id];
        if (!record) return d;
        const blockedUserIds = blocked
          ? [...new Set([...record.blockedUserIds, userId])]
          : record.blockedUserIds.filter((id) => id !== userId);
        return { ...d, users: { ...d.users, [user.id]: { ...record, blockedUserIds } } };
      });
      return;
    }
    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'users', user.id), {
        blockedUserIds: blocked ? arrayUnion(userId) : arrayRemove(userId),
      });
    } catch {
      // Non-critical.
    }
  };

  const blockUser = (userId: string) => setBlocked(userId, true);
  const unblockUser = (userId: string) => setBlocked(userId, false);

  const searchProviders = async (params: { name?: string; category?: string; workArea?: string }): Promise<PublicProfile[]> => {
    const { name, category, workArea } = params;
    if (mode === 'demo') {
      let results = Object.values(demoDb?.users ?? {}).filter((u) => u.role === 'provider');
      if (name) {
        const q = name.toLowerCase();
        results = results.filter((u) => u.name.toLowerCase().includes(q));
      }
      if (category) results = results.filter((u) => u.categories.includes(category));
      if (workArea) {
        const q = workArea.toLowerCase();
        results = results.filter((u) => u.workArea.toLowerCase().includes(q));
      }
      return results.map(toPublicProfile).sort((a, b) => b.ratingAvg - a.ratingAvg);
    }
    try {
      const { db } = getFirebase();
      // Single-field queries only — no composite index required.
      const q = category
        ? query(collection(db, 'users'), where('role', '==', 'provider'), where('categories', 'array-contains', category), limit(60))
        : query(collection(db, 'users'), where('role', '==', 'provider'), limit(60));
      const snap = await getDocs(q);
      let results = snap.docs.map((d) => toPublicProfile(mapUser(d.id, d.data())));
      if (name) {
        const nq = name.toLowerCase();
        results = results.filter((u) => u.name.toLowerCase().includes(nq));
      }
      if (workArea) {
        const wq = workArea.toLowerCase();
        results = results.filter((u) => u.workArea.toLowerCase().includes(wq));
      }
      return results.sort((a, b) => b.ratingAvg - a.ratingAvg);
    } catch {
      return [];
    }
  };

  const directChatId = (a: string, b: string) => `direct-${[a, b].sort().join('-')}`;

  const startDirectChat = async (providerId: string): Promise<{ chatId?: string; error?: string }> => {
    if (!user) return { error: 'Please sign in first.' };
    // Only employers may initiate direct chats with providers.
    if (user.role !== 'employer') return { error: 'Only employers can message providers directly.' };
    // Prevent self-chat.
    if (providerId === user.id) return { error: 'Cannot start a chat with yourself.' };
    // Respect blocked users.
    if (user.blockedUserIds.includes(providerId)) return { error: 'You have blocked this user.' };

    const chatId = directChatId(user.id, providerId);

    if (mode === 'demo') {
      const providerRecord = demoDb?.users[providerId];
      // Validate target exists and is a provider.
      if (!providerRecord) return { error: 'Provider not found.' };
      if (providerRecord.role !== 'provider') return { error: 'You can only message service providers.' };
      const exists = demoDb?.chats.find((c) => c.id === chatId);
      if (!exists) {
        const providerName = providerRecord.name;
        updateDemo((d) => ({
          ...d,
          chats: [
            ...d.chats,
            {
              id: chatId,
              jobId: '',
              jobTitle: 'Direct message',
              participants: [user.id, providerId],
              participantNames: { [user.id]: user.name, [providerId]: providerName },
              lastMessage: '',
              lastMessageAtMs: Date.now(),
              lastSenderId: undefined,
              lastReadAt: {},
              createdAtMs: Date.now(),
              messages: [],
            },
          ],
        }));
      }
      return { chatId };
    }

    try {
      const { db } = getFirebase();
      // Validate target exists and is a provider before creating the chat.
      const providerSnap = await getDoc(doc(db, 'users', providerId));
      if (!providerSnap.exists()) return { error: 'Provider not found.' };
      const providerData = providerSnap.data();
      if (providerData?.role !== 'provider') return { error: 'You can only message service providers.' };
      const providerName: string = providerData?.name ?? 'Provider';

      const chatRef = doc(db, 'chats', chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        await setDoc(chatRef, {
          jobId: '',
          jobTitle: 'Direct message',
          participants: [user.id, providerId],
          participantNames: { [user.id]: user.name, [providerId]: providerName },
          lastMessage: '',
          lastMessageAtMs: Date.now(),
          lastReadAt: {},
          createdAtMs: Date.now(),
        });
      }
      return { chatId };
    } catch (e) {
      return { error: friendlyError(e) };
    }
  };

  // ---- Notifications & profile -----------------------------------------------
  const markNotificationsRead = async () => {
    if (!user) return;
    if (mode === 'demo') {
      updateDemo((d) => ({
        ...d,
        notifications: d.notifications.map((n) => (n.userId === user.id ? { ...n, read: true } : n)),
      }));
      return;
    }
    try {
      const { db } = getFirebase();
      const unread = fbNotifs.filter((n) => !n.read);
      if (unread.length === 0) return;
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch {
      // Non-critical.
    }
  };

  const updateProfile = async (patch: ProfilePatch) => {
    if (!user) return 'Please sign in first.';
    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name.length < 2) return 'Name must be at least 2 characters.';
      clean.name = name;
    }
    if (patch.workArea !== undefined) clean.workArea = patch.workArea.trim();
    if (patch.bio !== undefined) clean.bio = patch.bio.trim();
    if (patch.categories !== undefined) clean.categories = patch.categories;
    if (patch.priceRange !== undefined) clean.priceRange = patch.priceRange.trim();
    if (patch.companyInfo !== undefined) clean.companyInfo = patch.companyInfo.trim();
    if (patch.avatarUrl !== undefined) clean.avatarUrl = patch.avatarUrl;
    if (patch.notifyQuotes !== undefined) clean.notifyQuotes = patch.notifyQuotes;
    if (Object.keys(clean).length === 0) return null;

    if (mode === 'demo') {
      updateDemo((d) => {
        const record = d.users[user.id];
        if (!record) return d;
        return { ...d, users: { ...d.users, [user.id]: { ...record, ...clean } } };
      });
      return null;
    }
    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'users', user.id), clean);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const saveAvatar = async (localUri: string) => {
    if (!user) return 'Please sign in first.';
    if (mode === 'demo') {
      return updateProfile({ avatarUrl: localUri });
    }
    try {
      const { storage } = getFirebase();
      const response = await fetch(localUri);
      const blob = await response.blob();
      const fileRef = storageRef(storage, `avatars/${user.id}-${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);
      return updateProfile({ avatarUrl: url });
    } catch (e) {
      return friendlyError(e);
    }
  };

  const value = useMemo<ServiceAppContextValue>(
    () => ({
      mode,
      ready,
      authBusy,
      user,
      needsRole,
      jobs,
      chats,
      notifications,
      unreadNotificationCount,
      unreadMessageCount,
      registerWithEmail,
      loginWithEmail,
      loginWithGoogleIdToken,
      completeRoleSelection,
      resetPassword,
      signOutUser,
      demoSignIn,
      addJob,
      acceptJob,
      toggleSaved,
      proposeQuote,
      acceptQuote,
      declineQuote,
      updatePayment,
      completeJob,
      submitReview,
      sendMessage,
      markChatRead,
      getUserProfile,
      searchProviders,
      startDirectChat,
      reportUser,
      blockUser,
      unblockUser,
      markNotificationsRead,
      updateProfile,
      saveAvatar,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, ready, authBusy, user, needsRole, jobs, chats, notifications, unreadNotificationCount, unreadMessageCount, demoDb, fbNotifs],
  );

  return <ServiceAppContext.Provider value={value}>{children}</ServiceAppContext.Provider>;
}

export function useServiceApp() {
  const context = useContext(ServiceAppContext);
  if (!context) throw new Error('useServiceApp must be used inside ServiceAppProvider');
  return context;
}

/**
 * Live messages for one chat. In Firebase mode this subscribes to the
 * messages subcollection; in demo mode it reads from local state.
 */
export function useChatMessages(chatId: string | undefined) {
  const { mode, chats } = useServiceApp();
  const [remote, setRemote] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(mode === 'firebase');

  useEffect(() => {
    if (mode !== 'firebase' || !chatId) return;
    const { db } = getFirebase();
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAtMs', 'asc'), limit(500));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRemote(snap.docs.map((d) => mapMessage(d.id, d.data())));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [mode, chatId]);

  if (mode === 'demo') {
    const chat = chats.find((c) => c.id === chatId);
    return { messages: chat?.messages ?? [], loading: false };
  }
  return { messages: remote, loading };
}
