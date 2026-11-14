'use client';
import { Ninja, PRESET_COLORS } from '@/components/scene/Ninja';
import { PlusIcon } from '@/components/scene/Icons';
import { AVATAR_ACCESSORIES, AVATAR_PRESETS, type Avatar } from '@/lib/types';
import { ChoiceRow } from '@/components/ui/Field';

// 02 Choose your ninja: 4 preset tiles + "yours" builder.
const SUITS = ['#3f8f4a', '#2e1b5b', '#3b6fd6', '#8b5ad6', '#d84b6a', '#2f6b45'];
const BANDS = ['#ffc803', '#ff7fb0', '#ffffff', '#9ae04c', '#c9d2f7', '#ff6fa8'];
const TILE_BG: Record<string, string> = { 'ninja-1': 'bg-[#e9f3d5]', 'ninja-2': 'bg-[#efe9ff]', 'ninja-3': 'bg-[#e4edff]', 'ninja-4': 'bg-[#f1e6ff]' };

export function AvatarPicker({ value, onChange }: { value: Avatar | null; onChange: (a: Avatar) => void }) {
  const custom: Extract<Avatar, { kind: 'custom' }> =
    value?.kind === 'custom' ? value : { kind: 'custom', suit: SUITS[4]!, band: BANDS[0]!, accessory: 'none' };
  const isCustom = value?.kind === 'custom';

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-5">
        {AVATAR_PRESETS.map((preset) => {
          const active = value?.kind === 'preset' && value.preset === preset;
          return (
            <div key={preset} className="flex flex-col items-center gap-2">
              <button
                type="button"
                data-testid={`avatar-${preset}`}
                aria-pressed={active}
                onClick={() => onChange({ kind: 'preset', preset })}
                className={`flex h-[132px] w-[132px] items-center justify-center rounded-[14px] border-4 transition-transform hover:-translate-y-0.5 ${TILE_BG[preset]} ${
                  active ? 'border-yellow shadow-[0_0_0_4px_var(--color-ink)] scale-[1.03]' : 'border-ink'
                }`}
              >
                <Ninja avatar={{ kind: 'preset', preset }} size={92} />
              </button>
              <span className={`k7-label rounded-[8px] border-[3px] border-ink px-2.5 py-1 ${active ? 'bg-ink text-yellow' : 'bg-white text-ink'}`}>
                {PRESET_COLORS[preset]!.name}
              </span>
            </div>
          );
        })}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            data-testid="avatar-custom"
            aria-pressed={isCustom}
            onClick={() => onChange(custom)}
            className={`flex h-[132px] w-[132px] items-center justify-center rounded-[14px] border-4 border-dashed bg-mist transition-transform hover:-translate-y-0.5 ${
              isCustom ? 'border-yellow shadow-[0_0_0_4px_var(--color-ink)]' : 'border-ink'
            }`}
          >
            {isCustom ? <Ninja avatar={custom} size={92} /> : <PlusIcon size={34} />}
          </button>
          <span className={`k7-label rounded-[8px] border-[3px] border-ink px-2.5 py-1 ${isCustom ? 'bg-ink text-yellow' : 'bg-white text-ink'}`}>Yours</span>
        </div>
      </div>

      {isCustom ? (
        <div className="k7-outline k7-shadow-sm grid w-full max-w-[640px] gap-4 rounded-[14px] bg-white p-5 sm:grid-cols-3">
          <Swatches label="Suit" colors={SUITS} value={custom.suit} onPick={(suit) => onChange({ ...custom, suit })} />
          <Swatches label="Band" colors={BANDS} value={custom.band} onPick={(band) => onChange({ ...custom, band })} />
          <div className="flex flex-col gap-2">
            <span className="k7-label">Accessory</span>
            <ChoiceRow
              size="sm"
              options={AVATAR_ACCESSORIES.map((a) => ({ value: a, label: a }))}
              value={custom.accessory}
              onChange={(accessory) => onChange({ ...custom, accessory })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="k7-label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            aria-pressed={value === c}
            onClick={() => onPick(c)}
            className={`h-9 w-9 rounded-[8px] border-[3px] ${value === c ? 'border-yellow shadow-[0_0_0_3px_var(--color-ink)]' : 'border-ink'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
