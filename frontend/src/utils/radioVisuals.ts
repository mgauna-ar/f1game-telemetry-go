import { RADIO_PERSONAS } from '../constants/f1';
import type { RadioState } from '../hooks/useRadioAudio';

/** What the radio HUD and the cockpit show: the radio's state, or `off` when it is switched off. */
export type RadioVisualState = RadioState | 'off';

export const getRadioVisualState = (radio: { isRadioEnabled: boolean; radioState: RadioState }): RadioVisualState =>
  radio.isRadioEnabled ? radio.radioState : 'off';

export interface PersonaInfo {
  /** "Bono", for the compact HUD. */
  shortName: string;
  /** Peter "Bono" Bonnington, for the cockpit. */
  fullName: string;
  flag: string;
  role: string;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The pit wall persona's names, flag and role. */
export const getPersonaInfo = (persona: string, effectiveLanguage: string, t: Translate): PersonaInfo => {
  const langFlag = effectiveLanguage === 'es' ? '🇦🇷' : '🇬🇧';
  switch (persona) {
    case RADIO_PERSONAS.COLAPINTO:
      return {
        shortName: 'Colapinto',
        fullName: 'Franco Colapinto',
        flag: langFlag,
        role: t('live.cockpit.roleEngineer'),
      };
    case RADIO_PERSONAS.CUSTOM: {
      const name = t('ai_engineer.personas.custom.name');
      return { shortName: name, fullName: name, flag: '⚙️', role: t('live.cockpit.roleCustom') };
    }
    case RADIO_PERSONAS.BONO:
    default:
      return {
        shortName: 'Bono',
        fullName: 'Peter "Bono" Bonnington',
        flag: langFlag,
        role: t('live.cockpit.roleSenior'),
      };
  }
};
