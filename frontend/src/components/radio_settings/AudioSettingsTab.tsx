import React, { useId } from 'react';
import { Languages, Sliders, Volume2, VolumeX, Gamepad2, Keyboard, X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import {
  RADIO_LANGUAGES,
  RADIO_SPANISH_VOICES,
  RADIO_ENGLISH_VOICES,
  RADIO_PTT_MODES,
  type RadioLanguage,
  type RadioPTTMode,
} from '../../constants/f1';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';
import { normalizeKeyName } from '../../utils/keyNames';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { Select } from '../ui/Field';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SelectField, SettingSection, ToggleRow } from './SettingControls';
import { ThresholdSlider } from './ThresholdSlider';
import shared from './RadioSettings.module.css';
import styles from './AudioSettingsTab.module.css';

interface AudioSettingsTabProps {
  radio: UseRadioControllerReturn;
}

// Keys offered in the push-to-talk dropdown, as KeyboardEvent.code values, with their label keys.
const PTT_KEY_OPTIONS = [
  { value: 'Space', labelKey: 'ai_engineer.ptt.keySpace' },
  { value: 'KeyT', labelKey: 'ai_engineer.ptt.keyLetter', letter: 'T' },
  { value: 'KeyR', labelKey: 'ai_engineer.ptt.keyLetter', letter: 'R' },
  { value: 'KeyV', labelKey: 'ai_engineer.ptt.keyLetter', letter: 'V' },
  { value: 'CapsLock', labelKey: 'ai_engineer.ptt.keyCapsLock' },
] as const;

const signed = (value: number, unit: string) => `${value > 0 ? '+' : ''}${value}${unit}`;

export const AudioSettingsTab: React.FC<AudioSettingsTabProps> = ({ radio }) => {
  const { t } = useI18n();
  const keySelectId = useId();
  // Keys are saved under several spellings ("CapsLock", "Caps Lock", "CAPSLOCK"); show the one listed.
  const knownKeyOption = PTT_KEY_OPTIONS.find(
    (option) => normalizeKeyName(option.value) === normalizeKeyName(radio.mappedKey)
  );
  const selectedKeyOption = knownKeyOption?.value ?? radio.mappedKey;

  // Settings from Zustand store with fine-grained selectors
  const radioLanguage = useRadioSettingsStore((s) => s.radioLanguage);
  const setRadioLanguage = useRadioSettingsStore((s) => s.setRadioLanguage);
  const neuralVoice = useRadioSettingsStore((s) => s.neuralVoice);
  const setNeuralVoice = useRadioSettingsStore((s) => s.setNeuralVoice);
  const beepsEnabled = useRadioSettingsStore((s) => s.beepsEnabled);
  const setBeepsEnabled = useRadioSettingsStore((s) => s.setBeepsEnabled);
  const filterEnabled = useRadioSettingsStore((s) => s.filterEnabled);
  const setFilterEnabled = useRadioSettingsStore((s) => s.setFilterEnabled);
  const staticFxEnabled = useRadioSettingsStore((s) => s.staticFxEnabled);
  const setStaticFxEnabled = useRadioSettingsStore((s) => s.setStaticFxEnabled);
  const volume = useRadioSettingsStore((s) => s.volume);
  const setVolume = useRadioSettingsStore((s) => s.setVolume);
  const speechRate = useRadioSettingsStore((s) => s.speechRate);
  const setSpeechRate = useRadioSettingsStore((s) => s.setSpeechRate);
  const speechPitch = useRadioSettingsStore((s) => s.speechPitch);
  const setSpeechPitch = useRadioSettingsStore((s) => s.setSpeechPitch);

  const voices = radio.effectiveLanguage === 'es' ? RADIO_SPANISH_VOICES : RADIO_ENGLISH_VOICES;
  const globalMapping = radio.globalMapping;
  const globalKey =
    globalMapping?.key_name || (globalMapping?.button_index !== undefined ? `B${globalMapping.button_index + 1}` : '');

  return (
    <div className={shared.tab}>
      <SettingSection
        icon={<Languages size={14} />}
        title={`${t('ai_engineer.radioLanguage.title')} & ${t('ai_engineer.neuralVoice.title')}`}
      >
        <div className={shared.grid2}>
          <SelectField
            label={t('ai_engineer.radioLanguage.title')}
            value={radioLanguage}
            onChange={(value) => setRadioLanguage(value as RadioLanguage)}
          >
            <option value={RADIO_LANGUAGES.AUTO}>{t('ai_engineer.radioLanguage.auto')}</option>
            <option value={RADIO_LANGUAGES.ES}>{t('ai_engineer.radioLanguage.es')}</option>
            <option value={RADIO_LANGUAGES.EN}>{t('ai_engineer.radioLanguage.en')}</option>
          </SelectField>

          <SelectField label={t('ai_engineer.neuralVoice.title')} value={neuralVoice} onChange={setNeuralVoice}>
            <option value="">{t('ai_engineer.neuralVoice.auto')}</option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {t(`ai_engineer.neuralVoice.${v.translationKey}`)}
              </option>
            ))}
          </SelectField>
        </div>
      </SettingSection>

      <SettingSection icon={<Sliders size={14} />} title={t('ai_engineer.audio.title')}>
        <div className={shared.stack}>
          <ToggleRow label={t('ai_engineer.audio.beeps')} checked={beepsEnabled} onChange={setBeepsEnabled} />
          <ToggleRow label={t('ai_engineer.audio.cockpitFilter')} checked={filterEnabled} onChange={setFilterEnabled} />
          <ToggleRow
            label={t('ai_engineer.audio.staticNoise')}
            checked={staticFxEnabled}
            onChange={setStaticFxEnabled}
          />
        </div>

        <ThresholdSlider
          label={t('ai_engineer.audio.volume')}
          icon={
            volume > 0 ? (
              <Volume2 size={16} className={styles.boxIcon} aria-hidden="true" />
            ) : (
              <VolumeX size={16} aria-hidden="true" />
            )
          }
          value={volume}
          min={0}
          max={1}
          step={0.05}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={setVolume}
        />
        <div className={shared.grid2}>
          {/* Speech rate from -20% to +30%, pitch from -20Hz to +20Hz */}
          <ThresholdSlider
            label={t('ai_engineer.audio.speechRate')}
            value={speechRate}
            min={-20}
            max={30}
            step={5}
            formatValue={(v) => signed(v, '%')}
            onChange={setSpeechRate}
          />
          <ThresholdSlider
            label={t('ai_engineer.audio.speechPitch')}
            value={speechPitch}
            min={-20}
            max={20}
            step={2}
            formatValue={(v) => signed(v, 'Hz')}
            onChange={setSpeechPitch}
          />
        </div>
      </SettingSection>

      <SettingSection icon={<Gamepad2 size={14} />} title={t('ai_engineer.ptt.title')}>
        {/* Hold to talk or press to toggle */}
        <div className={shared.box}>
          <span className={shared.fieldLabel}>{t('ai_engineer.ptt.mode')}</span>
          <SegmentedControl<RadioPTTMode>
            aria-label={t('ai_engineer.ptt.mode')}
            className={styles.modes}
            value={radio.pttMode}
            onChange={radio.setPTTMode}
            options={[
              { value: RADIO_PTT_MODES.HOLD, label: `🔘 ${t('ai_engineer.ptt.modeHold')}` },
              { value: RADIO_PTT_MODES.TOGGLE, label: `🔀 ${t('ai_engineer.ptt.modeToggle')}` },
            ]}
          />
          <p className={shared.hint}>
            {radio.pttMode === RADIO_PTT_MODES.HOLD
              ? t('ai_engineer.ptt.modeHoldDesc')
              : t('ai_engineer.ptt.modeToggleDesc')}
          </p>
        </div>

        {/* Whether the desktop helper hears the PTT button while the game has focus */}
        <div className={styles.globalStatus} data-active={radio.globalActive}>
          <span className={styles.globalLabel}>
            <span className={styles.globalDot} aria-hidden="true" />
            <strong className={styles.globalName}>{t('ai_engineer.ptt.globalSupport')}:</strong>
            <span className={styles.globalState}>
              {radio.globalActive ? t('ai_engineer.ptt.globalActive') : t('ai_engineer.ptt.globalInactive')}
            </span>
          </span>
          {globalMapping && (globalMapping.device_name || globalMapping.key_name) && (
            <Badge tone="accent" size="xs" square>
              {t('ai_engineer.ptt.globalMapped', {
                device: globalMapping.device_name || t('ai_engineer.ptt.deviceFallback'),
                key: globalKey,
              })}
            </Badge>
          )}
        </div>

        <div className={shared.grid2}>
          {/* Wheel or gamepad button */}
          <div className={shared.box}>
            <div className={shared.boxHeader}>
              <span className={shared.boxLabel}>
                <Gamepad2 size={16} className={styles.boxIcon} aria-hidden="true" />
                <span
                  className={styles.gamepadName}
                  data-connected={radio.gamepadConnected}
                  title={radio.gamepadName || undefined}
                >
                  {radio.gamepadConnected
                    ? radio.gamepadName || t('ai_engineer.ptt.gamepadConnected')
                    : t('ai_engineer.ptt.gamepadNotDetected')}
                </span>
              </span>
            </div>

            <div className={styles.mapRow}>
              <Button
                size="sm"
                className={styles.mapButton}
                aria-pressed={radio.isLearning}
                onClick={radio.isLearning ? radio.cancelLearning : radio.startLearning}
              >
                {radio.isLearning
                  ? t('ai_engineer.ptt.learning')
                  : radio.mappedGamepadButton
                    ? t('ai_engineer.ptt.mappedButton', {
                        btn: radio.mappedGamepadButton.buttonIndex,
                        gp: radio.mappedGamepadButton.gamepadIndex,
                      })
                    : t('ai_engineer.ptt.mapGamepadBtn')}
              </Button>

              {radio.mappedGamepadButton && (
                <IconButton
                  size="sm"
                  variant="danger"
                  label={t('ai_engineer.ptt.clearGamepad')}
                  onClick={() => radio.setMappedGamepadButton(null)}
                >
                  <X size={14} />
                </IconButton>
              )}
            </div>
          </div>

          {/* Keyboard key */}
          <div className={shared.box}>
            <div className={shared.boxHeader}>
              <label htmlFor={keySelectId} className={shared.boxLabel}>
                <Keyboard size={16} className={styles.boxIcon} aria-hidden="true" />
                {t('ai_engineer.ptt.keyboardKey')}
              </label>
              <Badge tone="accent" size="xs" square>
                {radio.mappedKey === 'None' ? t('ai_engineer.ptt.unassigned') : radio.mappedKey}
              </Badge>
            </div>
            <Select id={keySelectId} value={selectedKeyOption} onChange={(e) => radio.setMappedKey(e.target.value)}>
              <option value="None">🚫 {t('ai_engineer.ptt.noKey')}</option>
              {PTT_KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey, 'letter' in option ? { key: option.letter } : undefined)}
                </option>
              ))}
              {/* A learned key the list doesn't offer, such as "Mouse 4" */}
              {!knownKeyOption && radio.mappedKey !== 'None' && (
                <option value={radio.mappedKey}>{radio.mappedKey}</option>
              )}
            </Select>
          </div>
        </div>
      </SettingSection>
    </div>
  );
};
