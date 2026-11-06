export const membershipDeclarationVersion = '2026-11-07';

export function hasSignupDeclaration(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ageOver14' in value &&
    value.ageOver14 === true &&
    'termsAccepted' in value &&
    value.termsAccepted === true
  );
}
