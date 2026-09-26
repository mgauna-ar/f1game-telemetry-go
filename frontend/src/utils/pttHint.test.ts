import { describe, it, expect } from 'vitest';
import { getPttHint } from './pttHint';
import { getTranslation } from '../locales';
import { makePTTMapping } from '../test/wireFactories';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

describe('getPttHint', () => {
  it('uses the keyboard key when one is mapped', () => {
    expect(getPttHint({ mappedKey: 'Space' }, t)).toEqual({
      badge: 'Space',
      text: 'Hold Space or mapped wheel button to talk',
    });
  });

  it('uses the native wheel button when no keyboard key is mapped', () => {
    const hint = getPttHint(
      {
        mappedKey: 'None',
        globalMapping: makePTTMapping({ device_type: 'joystick', device_index: 0, button_index: 4 }),
        mappedGamepadButton: { gamepadIndex: 0, buttonIndex: 1 },
      },
      t
    );
    expect(hint).toEqual({ badge: 'B5', text: 'Hold Button 5 to talk' });
  });

  it('falls back to the browser gamepad button', () => {
    const hint = getPttHint({ mappedKey: 'None', mappedGamepadButton: { gamepadIndex: 0, buttonIndex: 2 } }, t);
    expect(hint).toEqual({ badge: 'B3', text: 'Hold Button 3 to talk' });
  });

  it('uses a native keyboard mapping', () => {
    const hint = getPttHint({ mappedKey: 'None', globalMapping: makePTTMapping({ device_type: 'keyboard', key_name: 'CapsLock' }) }, t);
    expect(hint).toEqual({ badge: 'CapsLock', text: 'Hold CapsLock or mapped wheel button to talk' });
  });

  it('says no button is set up instead of "Hold None"', () => {
    const hint = getPttHint({ mappedKey: 'None', mappedGamepadButton: null, globalMapping: makePTTMapping({ device_type: 'none' }) }, t);
    expect(hint).toEqual({ badge: null, text: 'No push-to-talk button set' });
  });
});
