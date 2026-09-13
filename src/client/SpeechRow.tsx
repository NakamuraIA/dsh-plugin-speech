/**
 * Read-aloud settings row registered into the General section item slot: the
 * service, the voice (language first, then the voices that language offers), the
 * three tuning sliders, the skip-code switch, and a test button that speaks the
 * settings currently on screen — saved or not.
 */
import { useState } from 'react'
import { Button, IconChevronDownOutline14, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SpeechVoice } from '../providers/types.ts'
import { SPEECH_PROVIDERS, type SpeechProviderId } from '../settings.ts'
import type { SpeechOverrides } from './speech-audio.ts'
import type { createSpeechRowStore } from './settings-store.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { Slider } from './Slider.tsx'
import css from './SpeechRow.module.css'

/** Injected business face: the preference writes and the sample playback. */
export interface SpeechRowInjected {
  /** Select the service that synthesizes. */
  setProvider: (provider: SpeechProviderId) => void
  /** Select the voice the service speaks with. */
  setVoice: (voice: string) => void
  /** Change one tuning value. */
  setTuning: (key: 'rate' | 'volume' | 'pitch', value: number) => void
  /** Include or leave out code blocks and tables. */
  setSkipCode: (skipCode: boolean) => void
  /** Speak a short sample through the settings on screen, saved or not. */
  test: (text: string, overrides: SpeechOverrides) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type SpeechRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createSpeechRowStore>>
  & PropsLocale<'speech'> & SpeechRowInjected

/** Tuning bounds, matching the durable schema. */
const TUNING_MIN = -50
const TUNING_MAX = 50

/** Signed unit value, in whatever unit the locale names for this control. */
function signed(value: number, unit: string): string {
  return `${value > 0 ? '+' : ''}${value}${unit}`
}

/** One labelled dropdown: a pill that opens a menu of string options. */
function Picker({ label, options, selected, onSelect }: {
  label: string
  options: readonly { id: string; label: string }[]
  selected: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = options.find(option => option.id === selected)?.label ?? selected
  return (
    <div className={css.field}>
      <div className={css.fieldLabel}>{label}</div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={options}
        selectedId={selected}
        onSelect={(id) => {
          onSelect(id)
          setOpen(false)
        }}
        align="start"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { setOpen(current => !current) }}
          >
            <span className={css.selectorText}>{active}</span>
            <IconChevronDownOutline14 className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}

/**
 * Render the read-aloud settings row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function SpeechRow({
  t, useStore, setProvider, setVoice, setTuning, setSkipCode, test,
}: SpeechRowComponentProps) {
  const provider = useStore(s => s.provider)
  const voice = useStore(s => s.voice)
  const rate = useStore(s => s.rate)
  const volume = useStore(s => s.volume)
  const pitch = useStore(s => s.pitch)
  const skipCode = useStore(s => s.skipCode)
  const voices = useStore(s => s.voices)
  const language = useStore(s => s.language)
  const writeFailed = useStore(s => s.writeFailed)

  const languages = [...new Set(voices.map(entry => entry.language))].sort()
  const offered = voices.filter(entry => entry.language === language)

  return (
    <div className={css.group}>
      <div className={css.rowText}>
        <div className={css.title}>{t('row.title')}</div>
        <div className={css.desc}>{t('row.description')}</div>
        {writeFailed && <div className={css.failure} role="status">{t('row.writeFailed')}</div>}
      </div>
      <Picker
        label={t('row.provider')}
        options={SPEECH_PROVIDERS.map(id => ({ id, label: t(`provider.${id}`) }))}
        selected={provider}
        onSelect={(id) => { setProvider(id as SpeechProviderId) }}
      />
      <Picker
        label={t('row.language')}
        options={languages.map(tag => ({ id: tag, label: tag }))}
        selected={language}
        onSelect={(id) => { setVoice(firstVoiceOf(voices, id)) }}
      />
      <Picker
        label={t('row.voice')}
        options={offered.map(entry => ({ id: entry.id, label: entry.name }))}
        selected={voice}
        onSelect={setVoice}
      />
      <Slider
        label={t('row.rate')}
        value={rate}
        min={TUNING_MIN}
        max={TUNING_MAX}
        display={signed(rate, t('row.percentUnit'))}
        onChange={(value) => { setTuning('rate', value) }}
      />
      <Slider
        label={t('row.volume')}
        value={volume}
        min={TUNING_MIN}
        max={TUNING_MAX}
        display={signed(volume, t('row.percentUnit'))}
        onChange={(value) => { setTuning('volume', value) }}
      />
      <Slider
        label={t('row.pitch')}
        value={pitch}
        min={TUNING_MIN}
        max={TUNING_MAX}
        display={signed(pitch, t('row.pitchUnit'))}
        onChange={(value) => { setTuning('pitch', value) }}
      />
      <div className={css.fieldRow}>
        <div className={css.fieldText}>
          <div className={css.fieldLabel}>{t('row.skipCode')}</div>
          <div className={css.desc}>{t('row.skipCode.description')}</div>
        </div>
        <Switch checked={skipCode} label={t('row.skipCode')} onChange={setSkipCode} />
      </div>
      <div className={css.testRow}>
        <Button
          variant="outline"
          onClick={() => {
            test(t('row.testSample'), {
              provider,
              voice,
              tuning: { rate, volume, pitch },
            })
          }}
        >
          {t('row.test')}
        </Button>
      </div>
      <div className={css.sample}>{t('row.testSample')}</div>
    </div>
  )
}

/**
 * Pick the voice one language selection lands on: its first listed voice, or the
 * current selection when that selection already belongs to the language.
 * @param voices - full catalog.
 * @param language - language the user selected.
 * @returns the voice id to select.
 */
function firstVoiceOf(voices: readonly SpeechVoice[], language: string): string {
  /* v8 ignore next -- every language offered came from this catalog, so a lookup for one always finds a voice */
  return voices.find(entry => entry.language === language)?.id ?? ''
}
