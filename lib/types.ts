// K7 API contract. Shared by the API (app/api) and the UI (app/(site), components).
// Change only together with docs/BACKEND.md and the tests.

// ---------- Enums ----------
export type Plan = 'free' | 'starter' | 'pro' | 'crew';
export type PaidPlan = Exclude<Plan, 'free'>;
export type Difficulty = 1 | 3 | 5; // Easy | Medium | Hard
export type AgeRange = '25-29' | '30-34' | '35-39' | '40-45';
export type MeetStyle = 'solo' | 'couple' | 'family';
export type Visibility = 'public' | 'private';
export type StageKind = 'solo' | 'connect' | 'coop';
export type StageStatus = 'locked' | 'active' | 'waiting_partner' | 'done';
export type InterestCategory =
  | 'fitness' | 'outdoors' | 'languages' | 'music' | 'creative' | 'food' | 'mind' | 'social';

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;
export type UsState = (typeof US_STATES)[number];

export const AVATAR_PRESETS = ['ninja-1', 'ninja-2', 'ninja-3', 'ninja-4'] as const;
export const AVATAR_ACCESSORIES = ['none', 'katana', 'staff', 'shuriken', 'headphones'] as const;
export type Avatar =
  | { kind: 'preset'; preset: (typeof AVATAR_PRESETS)[number] }
  | { kind: 'custom'; suit: string; band: string; accessory: (typeof AVATAR_ACCESSORIES)[number] }; // suit/band = #rrggbb

// ---------- Catalog ----------
export interface Interest {
  slug: string;
  name: string;
  icon: string; // emoji fallback; UI renders a pixel icon by slug
  category: InterestCategory;
}

// ---------- People ----------
export interface PublicUser {
  userId: string;
  displayName: string;
  avatar: Avatar;
  state: UsState;
  city: string;
  ageRange: AgeRange;
  meetStyle: MeetStyle;
  bio: string;
  coins: number;
}
export interface UserMini {
  userId: string;
  displayName: string;
  avatar: Avatar;
}

export interface PlanLimits {
  mapVisible: number | null; // null = unlimited
  connectsPerMonth: number | null;
  connectsUsedThisMonth: number;
  maxDifficulty: Difficulty;
  aiSteps: boolean;
}

export interface NearbyCount {
  interestSlug: string;
  interestName: string;
  state: UsState;
  people: number; // other people in my state with this interest
}

// ---------- Roadmap ----------
export interface StageReport {
  photoUrl: string | null; // signed URL, ~1h
  caption: string;
  visibility: Visibility;
  createdAt: string;
}
export interface Stage {
  id: string;
  interestSlug: string;
  difficulty: Difficulty;
  idx: number;
  kind: StageKind;
  title: string;
  description: string;
  minutes: number;
  requiresPhoto: boolean;
  status: StageStatus;
  coins: number;
  steps: string[] | null; // null when the plan does not include AI steps
  stepsLocked: boolean;   // true = steps exist but need Pro
  source: 'template' | 'ai';
  partner: UserMini | null; // co-op partner once chosen
  report: StageReport | null;
}
export interface Level {
  interest: Interest;
  difficulty: Difficulty;
  lockedByPlan: boolean;
  requiredPlan: PaidPlan | null;
  progress: { done: number; total: number };
  stages: Stage[];
}

export type Me =
  | { onboarded: false; id: string; email: string | null }
  | {
      onboarded: true;
      id: string;
      email: string | null;
      displayName: string;
      avatar: Avatar;
      state: UsState;
      city: string;
      ageRange: AgeRange;
      meetStyle: MeetStyle;
      socialUrl: string;
      bio: string;
      plan: Plan;
      coins: number;
      interests: Array<{ interest: Interest; difficulty: Difficulty }>;
      limits: PlanLimits;
      nearby: NearbyCount[];
      questOfDay: Stage | null;
      pendingIncoming: number;
    };
export type OnboardedMe = Extract<Me, { onboarded: true }>;

// ---------- Map ----------
export interface MapStateCount {
  state: UsState;
  count: number; // full count on every plan
}
export interface SharedInterest {
  slug: string;
  name: string;
  icon: string;
  myDifficulty: Difficulty;
  theirDifficulty: Difficulty;
}
export type ConnectionState = 'none' | 'outgoing_pending' | 'incoming_pending' | 'accepted';
export interface MatchCard {
  user: PublicUser;
  sharedInterests: SharedInterest[];
  score: number;
  sameCity: boolean;
  connection: { id: string | null; state: ConnectionState };
}
export interface MapUsersResponse {
  items: MatchCard[];
  hiddenCount: number; // people in this state hidden by the Free limit
}

export interface PublicStats {
  people: number;   // onboarded profiles
  states: number;   // states with at least one person
  cities: number;
  top: MapStateCount[]; // up to 5 states, most people first
}

// ---------- Connections & meetups ----------
export interface Connection {
  id: string;
  interestSlug: string;         // interest the request was sent for
  status: 'pending' | 'accepted' | 'declined'; // lists never contain declined; PATCH can return it
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  other: UserMini & { city: string; state: UsState; bio: string };
  sharedInterests: string[];    // slugs both people have (co-op partner picker filters by this)
  socialUrl: string | null;     // only when accepted
}
export interface ConnectionsResponse {
  incoming: Connection[];
  outgoing: Connection[];
  accepted: Connection[];
}
export interface Meetup {
  id: string;
  connectionId: string;
  proposedBy: string;
  interestSlug: string;
  startsAt: string;
  place: string;
  status: 'proposed' | 'confirmed' | 'cancelled' | 'done';
}

// ---------- Feed ----------
export interface FeedItem {
  id: string;
  author: UserMini & { city: string; state: UsState };
  interest: Interest;
  stageTitle: string;
  kind: StageKind;
  difficulty: Difficulty;
  photoUrl: string;
  caption: string;
  visibility: Visibility;
  createdAt: string;
  partner: { userId: string; displayName: string } | null;
}

// ---------- Requests / responses ----------
export interface OnboardingRequest {
  avatar: Avatar;
  profile: {
    displayName: string;
    state: UsState;
    city: string;
    ageRange: AgeRange;
    meetStyle: MeetStyle;
    socialUrl: string;
    bio: string;
  };
  interests: Array<{ slug: string; difficulty: Difficulty }>; // exactly 3, difficulties 1, 3, 5
}
export interface OnboardingResponse {
  me: OnboardedMe;
  roadmap: Level[];
}
export interface UploadUrlResponse {
  photoPath: string;
  token: string;    // for supabase.storage.from('stage-photos').uploadToSignedUrl(photoPath, token, file)
  signedUrl: string;
}
export interface CompleteStageRequest {
  photoPath?: string;
  caption?: string;
  visibility?: Visibility;
  partnerId?: string; // required for kind = 'coop'
}
export interface CompleteStageResponse {
  stage: Stage;
  coinsAwarded: number;
  coins: number;
  waitingForPartner: boolean;
  levelCompleted: boolean;
  nextStageId: string | null;
}
export interface CreateConnectionRequest { toUserId: string; interestSlug: string }
export interface RespondConnectionRequest { status: 'accepted' | 'declined' }
export interface CreateMeetupRequest { connectionId: string; startsAt: string; place: string; interestSlug: string }
export interface UpdateMeetupRequest { status: 'confirmed' | 'cancelled' | 'done' }
export interface ReportRequest { targetUserId: string; reason?: string }
export interface BlockRequest { targetUserId: string }
export interface CheckoutRequest { tier: PaidPlan }
export interface CheckoutResponse { url: string }
export interface ConfirmCheckoutRequest { sessionId: string }
export interface ConfirmCheckoutResponse { plan: Plan }
export interface OkResponse { ok: true }

// ---------- Errors ----------
export type ApiErrorCode =
  | 'UNAUTHORIZED' | 'NOT_ONBOARDED' | 'ALREADY_ONBOARDED' | 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN'
  | 'PLAN_LIMIT' | 'STAGE_NOT_ACTIVE' | 'PHOTO_REQUIRED' | 'PARTNER_REQUIRED' | 'PARTNER_INVALID'
  | 'CONNECT_REQUIRED' | 'NO_SHARED_INTEREST' | 'ALREADY_CONNECTED' | 'INVALID_STATE'
  | 'PAYMENT_NOT_COMPLETE' | 'INTERNAL';
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    requiredPlan?: PaidPlan; // set on PLAN_LIMIT so the paywall knows what to offer
    details?: unknown;       // zod issues on VALIDATION
  };
}
