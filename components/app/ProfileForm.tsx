'use client';
import { ChoiceRow, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { AGE_RANGES, MEET_STYLE_LABEL } from '@/lib/format';
import { normalizeSocialUrl } from '@/lib/server/validation';
import type { AgeRange, MeetStyle, UsState } from '@/lib/types';
import { US_STATES } from '@/lib/types';
import { STATE_NAMES } from '@/lib/us';

// 04 Profile. State and city are two inputs in one row (the API stores them separately).
export interface ProfileDraft {
  displayName: string;
  state: UsState | '';
  city: string;
  ageRange: AgeRange | null;
  meetStyle: MeetStyle | null;
  socialUrl: string;
  bio: string;
}

export const EMPTY_PROFILE: ProfileDraft = { displayName: '', state: '', city: '', ageRange: null, meetStyle: null, socialUrl: '', bio: '' };

export function profileValid(p: ProfileDraft): boolean {
  return (
    p.displayName.trim().length >= 2 &&
    p.displayName.trim().length <= 30 &&
    p.state !== '' &&
    p.city.trim().length >= 2 &&
    p.city.trim().length <= 50 &&
    p.ageRange !== null &&
    p.meetStyle !== null &&
    normalizeSocialUrl(p.socialUrl) !== null &&
    p.bio.length <= 160
  );
}

const MEET_OPTIONS = (Object.keys(MEET_STYLE_LABEL) as MeetStyle[]).map((v) => ({ value: v, label: MEET_STYLE_LABEL[v] }));
const AGE_OPTIONS = AGE_RANGES.map((v) => ({ value: v, label: v }));

export function ProfileForm({
  value,
  onChange,
  errors = {},
}: {
  value: ProfileDraft;
  onChange: (v: ProfileDraft) => void;
  errors?: Record<string, string>;
}) {
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => onChange({ ...value, [k]: v });
  const socialTouched = value.socialUrl.length > 0;
  const socialBad = socialTouched && normalizeSocialUrl(value.socialUrl) === null;

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      <Field label="Name" htmlFor="displayName" error={errors['profile.displayName']}>
        <Input
          id="displayName"
          data-testid="profile-displayName"
          autoComplete="nickname"
          maxLength={30}
          placeholder="Sarah"
          value={value.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          aria-invalid={!!errors['profile.displayName']}
        />
      </Field>

      <Field label="State · City" htmlFor="state" error={errors['profile.state'] ?? errors['profile.city']}>
        <div className="grid grid-cols-[112px_1fr] gap-2">
          <Select id="state" data-testid="profile-state" value={value.state} onChange={(e) => set('state', e.target.value as UsState)} aria-label="State">
            <option value="" disabled>
              TX
            </option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s} · {STATE_NAMES[s]}
              </option>
            ))}
          </Select>
          <Input
            id="city"
            data-testid="profile-city"
            autoComplete="address-level2"
            maxLength={50}
            placeholder="Austin"
            value={value.city}
            onChange={(e) => set('city', e.target.value)}
            aria-label="City"
          />
        </div>
      </Field>

      <Field label="Age range" error={errors['profile.ageRange']}>
        <ChoiceRow options={AGE_OPTIONS} value={value.ageRange} onChange={(v) => set('ageRange', v)} testId={(v) => `profile-ageRange-${v}`} />
        <input type="hidden" data-testid="profile-ageRange" value={value.ageRange ?? ''} readOnly />
      </Field>

      <Field label="Who do you meet with" error={errors['profile.meetStyle']}>
        <ChoiceRow options={MEET_OPTIONS} value={value.meetStyle} onChange={(v) => set('meetStyle', v)} testId={(v) => `profile-meetStyle-${v}`} />
        <input type="hidden" data-testid="profile-meetStyle" value={value.meetStyle ?? ''} readOnly />
      </Field>

      <Field
        label="Social link (required)"
        htmlFor="socialUrl"
        className="md:col-span-2"
        hint="LinkedIn, Instagram or X profile link"
        error={errors['profile.socialUrl'] ?? (socialBad ? 'Use a linkedin.com, instagram.com or x.com profile link' : null)}
      >
        <Input
          id="socialUrl"
          data-testid="profile-socialUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="linkedin.com/in/sarah-k"
          value={value.socialUrl}
          onChange={(e) => set('socialUrl', e.target.value)}
          aria-invalid={socialBad || !!errors['profile.socialUrl']}
        />
      </Field>

      <Field label="Bio" htmlFor="bio" className="md:col-span-2" error={errors['profile.bio']} hint={`${value.bio.length}/160`}>
        <Textarea
          id="bio"
          data-testid="profile-bio"
          rows={2}
          maxLength={160}
          placeholder="Moved to Austin 2 years ago. Looking for a running buddy and Spanish practice."
          value={value.bio}
          onChange={(e) => set('bio', e.target.value)}
        />
      </Field>
    </div>
  );
}
