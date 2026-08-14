import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type Role = 'employer' | 'provider';
export type JobStatus = 'open' | 'negotiating' | 'accepted' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type NotificationKind = 'job' | 'quote' | 'payment' | 'review' | 'message' | 'system';
export type MessageKind = 'text' | 'system' | 'quote';

export type QuoteBreakdown = {
  labor: number;
  materials: number;
  expectedHours: number;
  extraFees: number;
};

export type Review = {
  id: string;
  jobId: string;
  jobTitle: string;
  reviewerId: string;
  reviewerName: string;
  targetUserId: string;
  rating: number;
  communication?: number;
  quality?: number;
  punctuality?: number;
  tags: string[];
  comment?: string;
  createdAtMs: number;
};

export type Job = {
  id: string;
  title: string;
  category: string;
  details: string;
  priceOffer: number;
  employerId: string;
  employerName: string;
  employeeId?: string;
  employeeName?: string;
  status: JobStatus;
  scheduledAt: string;
  leaveTimeToEmployee: boolean;
  proposedPrice?: number;
  quoteBreakdown?: QuoteBreakdown;
  quoteBy?: string;
  employerQuoteAccepted?: boolean;
  employeeQuoteAccepted?: boolean;
  agreedPrice?: number;
  platformFee?: number;
  paymentStatus: PaymentStatus;
  reviewedBy: string[];
  createdAtMs: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  kind: MessageKind;
  createdAtMs: number;
};

export type Chat = {
  id: string;
  jobId: string;
  jobTitle: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageAtMs: number;
  lastSenderId?: string;
  lastReadAt: Record<string, number>;
  createdAtMs: number;
  /** Demo mode only: messages held inline. Firebase mode streams a subcollection. */
  messages?: ChatMessage[];
};

export type AppNotification = {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  jobId?: string;
  chatId?: string;
  read: boolean;
  createdAtMs: number;
};

export type PublicProfile = {
  id: string;
  name: string;
  role: Role;
  workArea: string;
  categories: string[];
  priceRange?: string;
  companyInfo?: string;
  bio?: string;
  avatarUrl?: string;
  ratingAvg: number;
  ratingCount: number;
  recentReviews: Review[];
  verified?: boolean;
  createdAtMs: number;
};

export type SessionUser = PublicProfile & {
  email: string;
  savedJobIds: string[];
  blockedUserIds: string[];
  notifyQuotes: boolean;
};

export type Report = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  jobId?: string;
  reason: string;
  message: string;
  createdAtMs: number;
};

export const CATEGORIES = [
  'Cleaning',
  'Plumbing',
  'Electrical',
  'Painting',
  'Landscaping',
  'Moving',
  'Pest Control',
  'Handyman',
  'Carpentry',
  'Other',
] as const;

export const CATEGORY_ICONS: Record<string, IconName> = {
  Cleaning: 'sparkles',
  Plumbing: 'water',
  Electrical: 'flash',
  Painting: 'color-palette',
  Landscaping: 'leaf',
  Moving: 'cube',
  'Pest Control': 'bug',
  Handyman: 'construct',
  Carpentry: 'hammer',
  Other: 'ellipsis-horizontal-circle',
};

export const REVIEW_TAGS = [
  'Professional',
  'On time',
  'Great value',
  'Friendly',
  'Clean work',
  'Clear communication',
  'Would hire again',
  'Went above & beyond',
];

export const REPORT_REASONS = [
  'Inappropriate behavior',
  'No-show or cancellation',
  'Payment issue',
  'Spam or scam',
  'Safety concern',
  'Other',
];

export const PLATFORM_FEE_RATE = 0.05;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const quoteTotal = (b: QuoteBreakdown) => round2(b.labor + b.materials + b.extraFees);

export const chatIdForJob = (jobId: string) => `chat-${jobId}`;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDay(ms);
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatMonthYear(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ---------------------------------------------------------------------------
// Demo mode seed data (used when Firebase env vars are not configured)
// ---------------------------------------------------------------------------

export type DemoUserRecord = SessionUser & { password?: string };

export type DemoDb = {
  users: Record<string, DemoUserRecord>;
  jobs: Job[];
  chats: Chat[];
  notifications: AppNotification[];
  reports: Report[];
  sessionUserId: string | null;
};

export const DEMO_STORAGE_KEY = '@service-app-state-v2';

export function makeSeedDb(): DemoDb {
  const now = Date.now();
  const h = 3_600_000;
  const d = 24 * h;

  const employer1: DemoUserRecord = {
    id: 'employer-1',
    name: 'Alex Morgan',
    email: 'alex@demo.serviceapp',
    password: 'password',
    role: 'employer',
    workArea: 'Austin, TX',
    categories: [],
    companyInfo: 'Morgan Property Group — small residential landlord.',
    bio: 'I manage a handful of rental homes and always pay promptly.',
    ratingAvg: 4.9,
    ratingCount: 12,
    recentReviews: [
      {
        id: 'seed-rev-e1',
        jobId: 'job-old-1',
        jobTitle: 'Gutter cleaning',
        reviewerId: 'provider-1',
        reviewerName: 'Jordan Lee',
        targetUserId: 'employer-1',
        rating: 5,
        tags: ['Clear communication', 'Friendly'],
        comment: 'Clear instructions and quick payment. Great to work with.',
        createdAtMs: now - 12 * d,
      },
    ],
    savedJobIds: [],
    blockedUserIds: [],
    notifyQuotes: true,
    verified: true,
    createdAtMs: now - 220 * d,
  };

  const provider1: DemoUserRecord = {
    id: 'provider-1',
    name: 'Jordan Lee',
    email: 'jordan@demo.serviceapp',
    password: 'password',
    role: 'provider',
    workArea: 'Austin, TX',
    categories: ['Cleaning', 'Handyman', 'Painting'],
    priceRange: '$40–$80 / hour',
    bio: 'Detail-focused handyman and painter with 6 years of experience.',
    ratingAvg: 4.8,
    ratingCount: 38,
    recentReviews: [
      {
        id: 'seed-rev-p1',
        jobId: 'job-old-2',
        jobTitle: 'Bathroom repaint',
        reviewerId: 'employer-2',
        reviewerName: 'Taylor Brooks',
        targetUserId: 'provider-1',
        rating: 5,
        communication: 5,
        quality: 5,
        punctuality: 4,
        tags: ['Clean work', 'Professional'],
        comment: 'Crisp lines, zero mess left behind. Booking again.',
        createdAtMs: now - 9 * d,
      },
    ],
    savedJobIds: ['job-1'],
    blockedUserIds: [],
    notifyQuotes: true,
    verified: true,
    createdAtMs: now - 400 * d,
  };

  const employer2: DemoUserRecord = {
    id: 'employer-2',
    name: 'Taylor Brooks',
    email: 'taylor@demo.serviceapp',
    password: 'password',
    role: 'employer',
    workArea: 'Austin, TX',
    categories: [],
    companyInfo: '',
    bio: '',
    ratingAvg: 4.6,
    ratingCount: 5,
    recentReviews: [],
    savedJobIds: [],
    blockedUserIds: [],
    notifyQuotes: true,
    verified: false,
    createdAtMs: now - 90 * d,
  };

  const jobs: Job[] = [
    {
      id: 'job-1',
      title: 'Deep clean before move-in',
      category: 'Cleaning',
      details:
        'Two bedroom apartment needs a detailed kitchen, bathroom, and floor clean before Friday. Supplies can be provided if needed.',
      priceOffer: 180,
      employerId: 'employer-2',
      employerName: 'Taylor Brooks',
      status: 'open',
      scheduledAt: 'Tomorrow · 10:00 AM',
      leaveTimeToEmployee: false,
      paymentStatus: 'pending',
      reviewedBy: [],
      createdAtMs: now - 5 * h,
    },
    {
      id: 'job-2',
      title: 'Patch and paint living room',
      category: 'Painting',
      details:
        'Repair three small nail holes and apply two coats of warm white paint to one accent wall. Paint already purchased.',
      priceOffer: 260,
      employerId: 'employer-1',
      employerName: 'Alex Morgan',
      status: 'open',
      scheduledAt: 'Sat, Aug 15 · Flexible',
      leaveTimeToEmployee: true,
      paymentStatus: 'pending',
      reviewedBy: [],
      createdAtMs: now - 1 * d,
    },
    {
      id: 'job-3',
      title: 'Install smart doorbell',
      category: 'Handyman',
      details: 'Install and connect a wired smart doorbell. Existing chime and wiring are in place.',
      priceOffer: 125,
      employerId: 'employer-1',
      employerName: 'Alex Morgan',
      employeeId: 'provider-1',
      employeeName: 'Jordan Lee',
      status: 'accepted',
      scheduledAt: 'Tue, Aug 18 · 2:00 PM',
      leaveTimeToEmployee: false,
      proposedPrice: 145,
      quoteBreakdown: { labor: 120, materials: 15, expectedHours: 2, extraFees: 10 },
      quoteBy: 'provider-1',
      employerQuoteAccepted: true,
      employeeQuoteAccepted: true,
      agreedPrice: 145,
      platformFee: 7.25,
      paymentStatus: 'paid',
      reviewedBy: [],
      createdAtMs: now - 6 * d,
    },
  ];

  const chats: Chat[] = [
    {
      id: 'chat-job-3',
      jobId: 'job-3',
      jobTitle: 'Install smart doorbell',
      participants: ['employer-1', 'provider-1'],
      participantNames: { 'employer-1': 'Alex Morgan', 'provider-1': 'Jordan Lee' },
      lastMessage: 'Sounds good. I accepted your quote.',
      lastMessageAtMs: now - 5 * d,
      lastSenderId: 'employer-1',
      lastReadAt: { 'employer-1': now - 5 * d, 'provider-1': now - 5 * d },
      createdAtMs: now - 6 * d,
      messages: [
        {
          id: 'm-0',
          senderId: 'provider-1',
          senderName: 'Jordan Lee',
          text: 'Jordan Lee accepted the job. Discuss details and agree on a quote.',
          kind: 'system',
          createdAtMs: now - 6 * d,
        },
        {
          id: 'm-1',
          senderId: 'employer-1',
          senderName: 'Alex Morgan',
          text: 'Hi Jordan, the existing wiring is ready. Let me know if you need anything else.',
          kind: 'text',
          createdAtMs: now - 5 * d - 2 * h,
        },
        {
          id: 'm-2',
          senderId: 'provider-1',
          senderName: 'Jordan Lee',
          text: 'Perfect. I can bring the mounting plate and have it working in about two hours.',
          kind: 'text',
          createdAtMs: now - 5 * d - 90 * 60_000,
        },
        {
          id: 'm-quote',
          senderId: 'provider-1',
          senderName: 'Jordan Lee',
          text: 'Proposed a quote: $145',
          kind: 'quote',
          createdAtMs: now - 5 * d - 80 * 60_000,
        },
        {
          id: 'm-3',
          senderId: 'employer-1',
          senderName: 'Alex Morgan',
          text: 'Sounds good. I accepted your quote.',
          kind: 'text',
          createdAtMs: now - 5 * d,
        },
      ],
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'n-1',
      userId: 'employer-1',
      kind: 'job',
      title: 'Job confirmed',
      body: 'Install smart doorbell is confirmed with Jordan Lee at $145.',
      jobId: 'job-3',
      chatId: 'chat-job-3',
      read: false,
      createdAtMs: now - 5 * d,
    },
    {
      id: 'n-2',
      userId: 'provider-1',
      kind: 'payment',
      title: 'Payment marked as paid',
      body: 'Alex Morgan marked Install smart doorbell as paid ($145).',
      jobId: 'job-3',
      read: false,
      createdAtMs: now - 4 * d,
    },
  ];

  return {
    users: { 'employer-1': employer1, 'provider-1': provider1, 'employer-2': employer2 },
    jobs,
    chats,
    notifications,
    reports: [],
    sessionUserId: null,
  };
}

export function toPublicProfile(u: SessionUser | DemoUserRecord): PublicProfile {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    workArea: u.workArea,
    categories: u.categories,
    priceRange: u.priceRange,
    companyInfo: u.companyInfo,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    ratingAvg: u.ratingAvg,
    ratingCount: u.ratingCount,
    recentReviews: u.recentReviews,
    verified: u.verified,
    createdAtMs: u.createdAtMs,
  };
}
