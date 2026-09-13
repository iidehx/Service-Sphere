export type DemoPasswordCredential = {
  passwordSalt: string;
  passwordVerifier: string;
};

function sha256(value: string): string {
  const maxWord = 2 ** 32;
  const constants: number[] = [];
  const hash: number[] = [];
  const primes: number[] = [];
  let candidate = 2;

  while (primes.length < 64) {
    let isPrime = true;
    for (let factor = 2; factor * factor <= candidate; factor += 1) {
      if (candidate % factor === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) primes.push(candidate);
    candidate += 1;
  }

  for (let index = 0; index < 64; index += 1) {
    if (index < 8) hash[index] = (Math.sqrt(primes[index]) * maxWord) | 0;
    constants[index] = (Math.cbrt(primes[index]) * maxWord) | 0;
  }

  const utf8 = unescape(encodeURIComponent(value));
  const bitLength = utf8.length * 8;
  const words: number[] = [];
  let message = `${utf8}\x80`;
  while (message.length % 64 !== 56) message += '\x00';
  for (let index = 0; index < message.length; index += 1) {
    const code = message.charCodeAt(index);
    words[index >> 2] |= code << ((3 - index) % 4) * 8;
  }
  words.push((bitLength / maxWord) | 0, bitLength);

  for (let offset = 0; offset < words.length; offset += 16) {
    const chunk = words.slice(offset, offset + 16);
    const oldHash = hash.slice();
    const working = hash.slice(0, 8);

    for (let index = 0; index < 64; index += 1) {
      const w15 = chunk[index - 15];
      const w2 = chunk[index - 2];
      const a = working[0];
      const e = working[4];
      const sigma0 =
        index < 16 ? 0 : ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const sigma1 =
        index < 16 ? 0 : ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      chunk[index] = index < 16 ? chunk[index] : (chunk[index - 16] + sigma0 + chunk[index - 7] + sigma1) | 0;
      const choice = (e & working[5]) ^ (~e & working[6]);
      const majority = (a & working[1]) ^ (a & working[2]) ^ (working[1] & working[2]);
      const sum1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const sum0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const temp1 = (working[7] + sum1 + choice + constants[index] + chunk[index]) | 0;
      const temp2 = (sum0 + majority) | 0;

      working.unshift((temp1 + temp2) | 0);
      working[4] = (working[4] + temp1) | 0;
      working.pop();
    }

    for (let index = 0; index < 8; index += 1) hash[index] = (oldHash[index] + working[index]) | 0;
  }

  return hash
    .slice(0, 8)
    .map((word) => (word >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

function makeSalt(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function createDemoPasswordCredential(password: string): DemoPasswordCredential {
  const passwordSalt = makeSalt();
  return {
    passwordSalt,
    passwordVerifier: sha256(`${passwordSalt}:${password}`),
  };
}

export function verifyDemoPassword(
  password: string,
  credential: Partial<DemoPasswordCredential> & { password?: string },
): boolean {
  if (credential.passwordSalt && credential.passwordVerifier) {
    return sha256(`${credential.passwordSalt}:${password}`) === credential.passwordVerifier;
  }

  // Existing seeded/demo records are migrated naturally the next time they are recreated.
  return typeof credential.password === 'string' && credential.password === password;
}