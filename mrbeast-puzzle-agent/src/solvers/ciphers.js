/**
 * Cipher and decode engines for the MrBeast puzzle hunt.
 * Implements all known cipher types referenced in the puzzle.
 */

// Phone keypad mapping (T9)
const PHONE_KEYPAD = {
  '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL',
  '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ'
};

const REVERSE_KEYPAD = {};
for (const [digit, letters] of Object.entries(PHONE_KEYPAD)) {
  for (const letter of letters) {
    REVERSE_KEYPAD[letter] = digit;
  }
}

/**
 * Decode a phone keypad number sequence.
 * E.g. 3634826 -> possible words using T9 mapping
 */
export function phoneKeypadDecode(digits) {
  const results = [];
  const digitStr = String(digits);

  // Simple mapping: each digit = one letter, try all combos
  function backtrack(index, current) {
    if (index === digitStr.length) {
      results.push(current);
      return;
    }
    const d = digitStr[index];
    const letters = PHONE_KEYPAD[d];
    if (!letters) return;
    for (const letter of letters) {
      backtrack(index + 1, current + letter);
    }
  }

  backtrack(0, '');
  return results;
}

/**
 * Caesar cipher shift
 */
export function caesarShift(text, shift) {
  return text.split('').map(char => {
    if (/[a-zA-Z]/.test(char)) {
      const base = char === char.toUpperCase() ? 65 : 97;
      return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
    }
    return char;
  }).join('');
}

/**
 * Try all 25 Caesar shifts
 */
export function caesarBruteForce(text) {
  const results = [];
  for (let shift = 1; shift <= 25; shift++) {
    results.push({ shift, result: caesarShift(text, shift) });
  }
  return results;
}

/**
 * ROT13 decode
 */
export function rot13(text) {
  return caesarShift(text, 13);
}

/**
 * Atbash cipher (A=Z, B=Y, etc.)
 */
export function atbash(text) {
  return text.split('').map(char => {
    if (/[a-z]/.test(char)) return String.fromCharCode(219 - char.charCodeAt(0));
    if (/[A-Z]/.test(char)) return String.fromCharCode(155 - char.charCodeAt(0));
    return char;
  }).join('');
}

/**
 * Vigenere cipher decode
 */
export function vigenereDecode(ciphertext, key) {
  let keyIndex = 0;
  return ciphertext.split('').map(char => {
    if (/[a-zA-Z]/.test(char)) {
      const base = char === char.toUpperCase() ? 65 : 97;
      const keyChar = key[keyIndex % key.length].toUpperCase();
      const shift = keyChar.charCodeAt(0) - 65;
      keyIndex++;
      return String.fromCharCode(((char.charCodeAt(0) - base - shift) % 26 + 26) % 26 + base);
    }
    return char;
  }).join('');
}

/**
 * A1Z26 cipher: numbers to letters (1=A, 2=B, etc.)
 */
export function a1z26Decode(numbers) {
  return numbers.map(n => {
    if (n >= 1 && n <= 26) return String.fromCharCode(64 + n);
    return '?';
  }).join('');
}

/**
 * Binary to text
 */
export function binaryToText(binary) {
  const cleaned = binary.replace(/[^01]/g, '');
  const bytes = cleaned.match(/.{8}/g);
  if (!bytes) return '';
  return bytes.map(b => String.fromCharCode(parseInt(b, 2))).join('');
}

/**
 * Morse code decode
 */
export function morseDecode(morse) {
  const MORSE_MAP = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
    '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
    '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
    '--..': 'Z', '-----': '0', '.----': '1', '..---': '2', '...--': '3',
    '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8',
    '----.': '9'
  };
  return morse.trim().split(/\s{3,}/).map(word =>
    word.split(/\s+/).map(code => MORSE_MAP[code] || '?').join('')
  ).join(' ');
}

/**
 * Index extraction: given a text and positions, extract letters at those positions
 */
export function indexExtract(text, positions) {
  const cleanText = text.replace(/[^a-zA-Z]/g, '');
  return positions.map(p => {
    const idx = p - 1; // 1-indexed to 0-indexed
    return idx >= 0 && idx < cleanText.length ? cleanText[idx] : '?';
  }).join('');
}

/**
 * Acrostic extraction: take first letter of each line/word
 */
export function acrosticExtract(lines) {
  return lines.map(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 ? trimmed[0] : '';
  }).join('');
}

/**
 * Semaphore decode (simplified: position pairs to letters)
 */
export function semaphoreDecode(positions) {
  const SEMAPHORE = {
    '17': 'A', '16': 'B', '15': 'C', '14': 'D', '13': 'E', '12': 'F', '11': 'G',
    '27': 'H', '26': 'I', '46': 'J', '37': 'K', '36': 'L', '35': 'M', '34': 'N',
    '23': 'O', '28': 'P', '38': 'Q', '48': 'R', '58': 'S', '68': 'T',
    '78': 'U', '57': 'V', '56': 'W', '45': 'X', '47': 'Y', '67': 'Z'
  };
  return positions.map(p => SEMAPHORE[p] || SEMAPHORE[p.split('').reverse().join('')] || '?').join('');
}

/**
 * Braille pattern decode (simplified dot positions)
 */
export function brailleDecode(patterns) {
  const BRAILLE = {
    '1': 'A', '12': 'B', '14': 'C', '145': 'D', '15': 'E', '124': 'F',
    '1245': 'G', '125': 'H', '24': 'I', '245': 'J', '13': 'K', '123': 'L',
    '134': 'M', '1345': 'N', '135': 'O', '1234': 'P', '12345': 'Q', '1235': 'R',
    '234': 'S', '2345': 'T', '136': 'U', '1236': 'V', '2456': 'W', '1346': 'X',
    '13456': 'Y', '1356': 'Z'
  };
  return patterns.map(p => {
    const sorted = p.split('').sort().join('');
    return BRAILLE[sorted] || '?';
  }).join('');
}

/**
 * GPS coordinate decode
 */
export function decodeGpsFromNumber(num) {
  const str = String(num);
  // Try common formats like 3634826 -> 36.34826
  const results = [];
  for (let i = 1; i < str.length; i++) {
    const lat = parseFloat(str.slice(0, i) + '.' + str.slice(i));
    if (lat >= -90 && lat <= 90) {
      results.push({ lat, interpretation: `${str.slice(0, i)}.${str.slice(i)}°N` });
    }
  }
  return results;
}

/**
 * Lost numbers analysis (4-8-15-16-23-42)
 */
export function analyzeLostNumbers() {
  const numbers = [4, 8, 15, 16, 23, 42];
  const sum = numbers.reduce((a, b) => a + b, 0); // 108
  const letters = numbers.map(n => n <= 26 ? String.fromCharCode(64 + n) : '?');
  return {
    numbers,
    sum,
    letters: letters.join(''), // D-H-O-P-W-?
    differences: numbers.slice(1).map((n, i) => n - numbers[i]),
    modulo26: numbers.map(n => n % 26),
  };
}

/**
 * Apply all cipher methods to input text and return results
 */
export function bruteForceAll(input) {
  const results = [];

  // Caesar
  for (const { shift, result } of caesarBruteForce(input)) {
    results.push({ method: `Caesar shift ${shift}`, result });
  }

  // ROT13
  results.push({ method: 'ROT13', result: rot13(input) });

  // Atbash
  results.push({ method: 'Atbash', result: atbash(input) });

  // Reverse
  results.push({ method: 'Reverse', result: input.split('').reverse().join('') });

  // A1Z26 if numeric
  if (/^[\d\s,.-]+$/.test(input)) {
    const nums = input.match(/\d+/g)?.map(Number);
    if (nums) {
      results.push({ method: 'A1Z26', result: a1z26Decode(nums) });
    }
  }

  // Phone keypad if numeric
  if (/^\d+$/.test(input) && input.length <= 10) {
    const decoded = phoneKeypadDecode(input);
    if (decoded.length <= 100) {
      results.push({ method: 'Phone Keypad (all combos)', result: decoded.slice(0, 20).join(', ') + (decoded.length > 20 ? '...' : '') });
    }
  }

  // Binary
  if (/^[01\s]+$/.test(input) && input.replace(/\s/g, '').length % 8 === 0) {
    results.push({ method: 'Binary', result: binaryToText(input) });
  }

  // Morse
  if (/^[.\-\s/]+$/.test(input)) {
    results.push({ method: 'Morse', result: morseDecode(input) });
  }

  return results;
}
