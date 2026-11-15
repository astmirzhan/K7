'use client';
import { useState } from 'react';
import { Coin } from '@/components/scene/Coin';
import { ArrowIcon, CameraIcon, CheckIcon, CrossIcon, FlagIcon, LockIcon, PeopleIcon, PlusIcon } from '@/components/scene/Icons';
import { AvatarTile, Ninja } from '@/components/scene/Ninja';
import { Scene } from '@/components/scene/Scene';
import { Button } from '@/components/ui/Button';
import { Chip, Tag } from '@/components/ui/Chip';
import { CoinBurst } from '@/components/ui/CoinBurst';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { ChoiceRow, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Divider, Panel } from '@/components/ui/Panel';
import { Sign } from '@/components/ui/Sign';
import { EmptyState, ErrorState, PanelSkeleton, Skeleton } from '@/components/ui/States';
import { toast } from '@/lib/toast';
import { AVATAR_PRESETS, type Avatar } from '@/lib/types';
import { Toaster } from '@/components/ui/Toaster';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="k7-label text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function UiGallery() {
  const [modal, setModal] = useState(false);
  const [burst, setBurst] = useState(false);
  const [style, setStyle] = useState<'solo' | 'couple' | 'family'>('solo');
  const custom: Avatar = { kind: 'custom', suit: '#d84b6a', band: '#ffc803', accessory: 'katana' };

  return (
    <Scene variant="app">
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-8 px-4 pb-48 pt-6">
        <h1 className="k7-title text-[56px]">ui kit</h1>

        <Block title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button>primary</Button>
            <Button variant="secondary">secondary</Button>
            <Button variant="ink">ink</Button>
            <Button variant="danger">danger</Button>
            <Button variant="ghost">ghost</Button>
            <Button pending>pending</Button>
            <Button size="sm">small</Button>
          </div>
        </Block>

        <Block title="Chips, tags, badges">
          <div className="flex flex-wrap gap-2">
            <Chip active>active</Chip>
            <Chip>idle</Chip>
            <Chip size="sm">small</Chip>
            <Tag>ink</Tag>
            <Tag tone="grass">same city</Tag>
            <Tag tone="yellow">pro</Tag>
            <Tag tone="lilac">private</Tag>
            <DifficultyBadge difficulty={1} />
            <DifficultyBadge difficulty={3} />
            <DifficultyBadge difficulty={5} tone="white" />
          </div>
        </Block>

        <Block title="Avatars">
          <div className="flex flex-wrap items-end gap-3">
            {AVATAR_PRESETS.map((p) => (
              <AvatarTile key={p} avatar={{ kind: 'preset', preset: p }} size={56} />
            ))}
            <AvatarTile avatar={custom} size={56} tone="yellow" />
            <Ninja avatar={custom} size={72} />
          </div>
        </Block>

        <Block title="Icons and coin">
          <div className="flex flex-wrap items-center gap-3">
            <LockIcon /> <FlagIcon /> <CameraIcon /> <CheckIcon /> <PeopleIcon /> <PlusIcon size={16} /> <CrossIcon /> <ArrowIcon />
            <Coin size={24} />
          </div>
        </Block>

        <Block title="Form fields">
          <Panel className="flex flex-col gap-4 p-5">
            <Field label="Name" htmlFor="g-name" hint="2–30 characters">
              <Input id="g-name" placeholder="Sarah" />
            </Field>
            <Field label="State" htmlFor="g-state" error="Pick your state">
              <Select id="g-state" defaultValue="" aria-invalid>
                <option value="" disabled>State</option>
                <option value="TX">TX · Texas</option>
              </Select>
            </Field>
            <Field label="Bio" htmlFor="g-bio">
              <Textarea id="g-bio" rows={2} placeholder="160 characters" />
            </Field>
            <Field label="Who do you meet with">
              <ChoiceRow
                options={[{ value: 'solo', label: 'Solo' }, { value: 'couple', label: 'Couple' }, { value: 'family', label: 'Family-friendly' }]}
                value={style}
                onChange={setStyle}
              />
            </Field>
          </Panel>
        </Block>

        <Block title="Panels">
          <Panel className="p-5">white panel</Panel>
          <Panel tone="mist" shadow="md" className="p-5">mist panel</Panel>
          <Panel tone="yellow" shadow="sm" className="p-5">yellow panel</Panel>
          <Divider />
          <Sign>
            <p className="font-display text-[40px] leading-none text-yellow">+6</p>
            <p className="k7-label text-[10px] text-white">coins earned</p>
          </Sign>
        </Block>

        <Block title="States">
          <Skeleton className="h-6 w-2/3" />
          <PanelSkeleton lines={2} />
          <EmptyState title="Nobody here yet" text="Try another state." action={{ label: 'open the map', href: '#' }} />
          <ErrorState message="The server did not answer." onRetry={() => toast('retrying…')} />
        </Block>

        <Block title="Overlays">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModal(true)}>open sheet</Button>
            <Button size="sm" variant="secondary" onClick={() => toast('Saved', { tone: 'success' })}>toast</Button>
            <Button size="sm" variant="secondary" onClick={() => toast('Something went wrong. Try again.', { tone: 'error' })}>error toast</Button>
            <Button size="sm" variant="ink" onClick={() => setBurst(true)}>coin burst</Button>
          </div>
        </Block>
      </main>
      <Modal open={modal} onClose={() => setModal(false)} label="Example sheet">
        <div className="flex flex-col gap-3 pr-8">
          <h2 className="font-display text-[32px] leading-none">bottom sheet</h2>
          <p className="text-[14px]">Centered on desktop, a bottom sheet on phones. Escape or the backdrop closes it.</p>
        </div>
      </Modal>
      {burst ? <CoinBurst amount={3} onDone={() => setBurst(false)} /> : null}
      <Toaster />
    </Scene>
  );
}
