const DEFAULT_LICENSES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']);

export function evaluateCandidate(candidate, { allowedLicenses = DEFAULT_LICENSES } = {}) {
  const licenseAllowed = allowedLicenses.has(candidate.license);
  const hasMaintenanceSignal = Boolean(candidate.updatedAt);
  const evidence = {
    license: candidate.license,
    licenseAllowed,
    hasMaintenanceSignal,
    untrustedContent: candidate.untrusted === true
  };
  return { ...candidate, evidence, eligible: licenseAllowed && hasMaintenanceSignal && candidate.untrusted === true };
}
