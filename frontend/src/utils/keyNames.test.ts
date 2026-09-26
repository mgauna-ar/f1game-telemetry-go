import { describe, it, expect } from 'vitest';
import { isKeyboardEventForKey, normalizeKeyName } from './keyNames';

describe('normalizeKeyName', () => {
  it.each([
    ['Caps Lock', 'capslock'],
    ['CapsLock', 'capslock'],
    ['CAPSLOCK', 'capslock'],
    ['KeyT', 't'],
    ['T', 't'],
    ['Digit1', '1'],
    ['1', '1'],
    [' ', 'space'],
    ['Spacebar', 'space'],
    ['Keyboard', 'keyboard'],
  ])('normalizes %j to %j', (name, expected) => {
    expect(normalizeKeyName(name)).toBe(expected);
  });
});

describe('isKeyboardEventForKey', () => {
  const event = (code: string, key: string) => ({ code, key });

  it.each([
    ['Caps Lock', event('CapsLock', 'CapsLock')],
    ['CAPSLOCK', event('CapsLock', 'CapsLock')],
    ['KeyT', event('KeyT', 't')],
    ['T', event('KeyT', 't')],
    ['1', event('Digit1', '1')],
    ['Space', event('Space', ' ')],
    ['SHIFT', event('ShiftLeft', 'Shift')],
    ['ARROWUP', event('ArrowUp', 'ArrowUp')],
  ])('matches the %j key', (mappedKey, e) => {
    expect(isKeyboardEventForKey(mappedKey, e)).toBe(true);
  });

  it.each([
    ['Caps Lock', event('KeyC', 'c')],
    ['T', event('KeyR', 'r')],
    ['None', event('Space', ' ')],
    ['', event('Space', ' ')],
    ['Mouse 4', event('Digit4', '4')],
  ])('does not match %j', (mappedKey, e) => {
    expect(isKeyboardEventForKey(mappedKey, e)).toBe(false);
  });
});
