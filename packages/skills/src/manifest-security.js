import { createVerify } from 'node:crypto';

function canonicalManifest(manifest) {
  const { signature: _signature, ...unsigned } = manifest;
  return JSON.stringify(Object.keys(unsigned).sort().reduce((result, key) => ({ ...result, [key]: unsigned[key] }), {}));
}

export function verifySkillSignature(manifest) {
  if (!manifest.signature || !manifest.publicKey) return false;
  try {
    const verifier = createVerify('SHA256');
    verifier.update(canonicalManifest(manifest));
    verifier.end();
    return verifier.verify(manifest.publicKey, Buffer.from(manifest.signature, 'base64'));
  } catch { return false; }
}

export function classifySkillTrust(manifest, sourceRoot) {
  const builtin = sourceRoot.endsWith('/skills/builtin') || sourceRoot.endsWith('\\skills\\builtin');
  const signed = verifySkillSignature(manifest);
  return {
    trustLevel: builtin ? 'builtin' : signed ? 'signed' : 'untrusted',
    signed,
    activationRequiresApproval: !builtin && !signed
  };
}
