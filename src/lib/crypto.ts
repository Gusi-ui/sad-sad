const safeBtoa = (str: string) => {
  if (typeof btoa !== 'undefined') return btoa(str);
  if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer) return (globalThis as any).Buffer.from(str, 'binary').toString('base64');
  return '';
};

const safeAtob = (b64: string) => {
  if (typeof atob !== 'undefined') return atob(b64);
  if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer) return (globalThis as any).Buffer.from(b64, 'base64').toString('binary');
  return '';
};

const textEncoder = new TextEncoder();

export const randomId = () => crypto.randomUUID();

export const hashPassword = async (password: string) => {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 210_000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256
  );

  const hashBytes = new Uint8Array(derivedBits);
  return {
    hashBase64: safeBtoa(String.fromCharCode(...hashBytes)),
    saltBase64: safeBtoa(String.fromCharCode(...saltBytes)),
    iterations
  };
};

export const verifyPassword = async (password: string, params: { hashBase64: string; saltBase64: string; iterations: number }) => {
  const saltBytes = Uint8Array.from(safeAtob(params.saltBase64).split(''), (c: string) => c.charCodeAt(0));
  const expectedHashBytes = Uint8Array.from(safeAtob(params.hashBase64).split(''), (c: string) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: params.iterations },
    keyMaterial,
    256
  );

  const actualHashBytes = new Uint8Array(derivedBits);
  if (actualHashBytes.length !== expectedHashBytes.length) return false;

  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < actualHashBytes.length; i += 1) diff |= actualHashBytes[i] ^ expectedHashBytes[i];
  return diff === 0;
};

