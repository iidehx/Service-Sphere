import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type Role = 'employer' | 'provider';
export type JobStatus = 'open' | 'negotiating' | 'accepted' | 'completed';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  workArea: string;
  categories: string[];
  rating: number;
  reviews: number;
  verified: boolean;
};

export type QuoteBreakdown = {
  labor: number;
  materials: number;
  expectedHours: number;
  extraFees: number;
};

export type Job = {
  id: string;
  title: string;
  category: string;
  details: string;
  priceOffer: number;
  employerId: string;
  employerName: string;
  employerEmail: string;
  employeeId?: string;
  employeeName?: string;
  status: JobStatus;
  scheduledAt: string;
  leaveTimeToEmployee: boolean;
  saved?: boolean;
  proposedPrice?: number;
  quoteBreakdown?: QuoteBreakdown;
  employerQuoteAccepted?: boolean;
  employeeQuoteAccepted?: boolean;
  agreedPrice?: number;
  platformFee?: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  reviewedBy?: string[];
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export type Chat = {
  id: string;
  jobId: string;
  participantIds: string[];
  messages: ChatMessage[];
};

const employer: AppUser = {
  id: 'employer-1',
  name: 'Alex Morgan',
  email: 'alex@serviceapp.demo',
  role: 'employer',
  workArea: 'Austin, TX',
  categories: [],
  rating: 4.9,
  reviews: 12,
  verified: true,
};

const provider: AppUser = {
  id: 'provider-1',
  name: 'Jordan Lee',
  email: 'jordan@serviceapp.demo',
  role: 'provider',
  workArea: 'Austin, TX',
  categories: ['Cleaning', 'Handyman', 'Painting'],
  rating: 4.8,
  reviews: 38,
  verified: true,
};

const seedJobs: Job[] = [
  {
    id: 'job-1',
    title: 'Deep clean before move-in',
    category: 'Cleaning',
    details: 'Two bedroom apartment needs a detailed kitchen, bathroom, and floor clean before Friday.',
    priceOffer: 180,
    employerId: 'employer-2',
    employerName: 'Taylor Brooks',
    employerEmail: 'taylor@example.com',
    status: 'open',
    scheduledAt: 'Tomorrow · 10:00 AM',
    leaveTimeToEmployee: false,
    paymentStatus: 'pending',
    createdAt: 'Today',
  },
  {
    id: 'job-2',
    title: 'Patch and paint living room',
    category: 'Painting',
    details: 'Repair three small nail holes and apply two coats of warm white paint to one accent wall.',
    priceOffer: 260,
    employerId: 'employer-1',
    employerName: 'Alex Morgan',
    employerEmail: employer.email,
    status: 'open',
    scheduledAt: 'Sat, Aug 15 · Flexible',
    leaveTimeToEmployee: true,
    paymentStatus: 'pending',
    createdAt: 'Yesterday',
  },
  {
    id: 'job-3',
    title: 'Install smart doorbell',
    category: 'Handyman',
    details: 'Install and connect a wired smart doorbell. Existing chime and wiring are in place.',
    priceOffer: 125,
    employerId: 'employer-1',
    employerName: employer.name,
    employerEmail: employer.email,
    employeeId: 'provider-1',
    employeeName: provider.name,
    status: 'accepted',
    scheduledAt: 'Tue, Aug 18 · 2:00 PM',
    leaveTimeToEmployee: false,
    proposedPrice: 145,
    quoteBreakdown: { labor: 120, materials: 15, expectedHours: 2, extraFees: 10 },
    employerQuoteAccepted: true,
    employeeQuoteAccepted: true,
    agreedPrice: 145,
    platformFee: 7.25,
    paymentStatus: 'paid',
    createdAt: 'Aug 4',
  },
];

const seedChats: Chat[] = [
  {
    id: 'chat-job-3',
    jobId: 'job-3',
    participantIds: ['employer-1', 'provider-1'],
    messages: [
      { id: 'm-1', senderId: 'employer-1', text: 'Hi Jordan, the existing wiring is ready. Let me know if you need anything else.', createdAt: '9:14 AM' },
      { id: 'm-2', senderId: 'provider-1', text: 'Perfect. I can bring the mounting plate and have it working in about two hours.', createdAt: '9:18 AM' },
      { id: 'm-3', senderId: 'employer-1', text: 'Sounds good. I accepted your quote.', createdAt: '9:22 AM' },
    ],
  },
];

type ServiceAppContextValue = {
  currentUser: AppUser;
  jobs: Job[];
  chats: Chat[];
  ready: boolean;
  signIn: (role: Role, name?: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  addJob: (job: Pick<Job, 'title' | 'category' | 'details' | 'priceOffer' | 'scheduledAt' | 'leaveTimeToEmployee'>) => void;
  acceptJob: (jobId: string) => void;
  toggleSaved: (jobId: string) => void;
  sendMessage: (chatId: string, text: string) => void;
  proposeQuote: (jobId: string, price: number, breakdown: QuoteBreakdown) => void;
  acceptQuote: (jobId: string) => void;
  updatePayment: (jobId: string, paymentStatus: 'paid' | 'refunded') => void;
  completeJob: (jobId: string) => void;
  leaveReview: (jobId: string, rating: number, comment: string) => void;
};

const ServiceAppContext = createContext<ServiceAppContextValue | null>(null);
const STORAGE_KEY = '@service-app-state-v1';

export function ServiceAppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser>(employer);
  const [jobs, setJobs] = useState<Job[]>(seedJobs);
  const [chats, setChats] = useState<Chat[]>(seedChats);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) {
        try {
          const data = JSON.parse(saved) as { jobs?: Job[]; chats?: Chat[]; currentUser?: AppUser };
          if (data.jobs) setJobs(data.jobs);
          if (data.chats) setChats(data.chats);
          if (data.currentUser) setCurrentUser(data.currentUser);
        } catch {
          // Keep the curated starter state when local storage is malformed.
        }
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ jobs, chats, currentUser }));
  }, [jobs, chats, currentUser, ready]);

  const signIn = async (role: Role, name?: string, email?: string) => {
    const base = role === 'employer' ? employer : provider;
    setCurrentUser({ ...base, name: name?.trim() || base.name, email: email?.trim() || base.email });
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setCurrentUser(employer);
  };

  const switchRole = async (role: Role) => {
    await signIn(role);
  };

  const addJob = (input: Pick<Job, 'title' | 'category' | 'details' | 'priceOffer' | 'scheduledAt' | 'leaveTimeToEmployee'>) => {
    const job: Job = {
      ...input,
      id: `job-${Date.now()}`,
      employerId: currentUser.id,
      employerName: currentUser.name,
      employerEmail: currentUser.email,
      status: 'open',
      paymentStatus: 'pending',
      createdAt: 'Just now',
    };
    setJobs((previous) => [job, ...previous]);
  };

  const acceptJob = (jobId: string) => {
    const chatId = `chat-${jobId}`;
    setJobs((previous) => previous.map((job) => job.id === jobId ? { ...job, employeeId: currentUser.id, employeeName: currentUser.name, status: 'negotiating' } : job));
    setChats((previous) => previous.some((chat) => chat.id === chatId) ? previous : [...previous, { id: chatId, jobId, participantIds: [currentUser.id, 'employer-1'], messages: [{ id: `m-${Date.now()}`, senderId: currentUser.id, text: 'Hi, I would love to help with this job. I can share a quote after a few details.', createdAt: 'Just now' }] }]);
  };

  const toggleSaved = (jobId: string) => setJobs((previous) => previous.map((job) => job.id === jobId ? { ...job, saved: !job.saved } : job));

  const sendMessage = (chatId: string, text: string) => {
    if (!text.trim()) return;
    setChats((previous) => previous.map((chat) => chat.id === chatId ? { ...chat, messages: [...chat.messages, { id: `m-${Date.now()}`, senderId: currentUser.id, text: text.trim(), createdAt: 'Just now' }] } : chat));
  };

  const proposeQuote = (jobId: string, price: number, breakdown: QuoteBreakdown) => setJobs((previous) => previous.map((job) => job.id === jobId ? { ...job, status: 'negotiating', proposedPrice: price, quoteBreakdown: breakdown, employeeQuoteAccepted: false, employerQuoteAccepted: false } : job));

  const acceptQuote = (jobId: string) => setJobs((previous) => previous.map((job) => {
    if (job.id !== jobId) return job;
    const next = currentUser.role === 'provider' ? { ...job, employeeQuoteAccepted: true } : { ...job, employerQuoteAccepted: true };
    if (next.employeeQuoteAccepted && next.employerQuoteAccepted) return { ...next, status: 'accepted', agreedPrice: next.proposedPrice, platformFee: Math.round((next.proposedPrice ?? next.priceOffer) * 0.05 * 100) / 100 };
    return next;
  }));

  const updatePayment = (jobId: string, paymentStatus: 'paid' | 'refunded') => setJobs((previous) => previous.map((job) => job.id === jobId ? { ...job, paymentStatus } : job));
  const completeJob = (jobId: string) => setJobs((previous) => previous.map((job) => job.id === jobId ? { ...job, status: 'completed' } : job));
  const leaveReview = (jobId: string, rating: number, comment: string) => setJobs((previous) => previous.map((job) => job.id === jobId ? { ...job, reviewedBy: [...(job.reviewedBy ?? []), currentUser.id] } : job));

  const value = useMemo(() => ({ currentUser, jobs, chats, ready, signIn, signOut, switchRole, addJob, acceptJob, toggleSaved, sendMessage, proposeQuote, acceptQuote, updatePayment, completeJob, leaveReview }), [currentUser, jobs, chats, ready]);
  return <ServiceAppContext.Provider value={value}>{children}</ServiceAppContext.Provider>;
}

export function useServiceApp() {
  const context = useContext(ServiceAppContext);
  if (!context) throw new Error('useServiceApp must be used inside ServiceAppProvider');
  return context;
}