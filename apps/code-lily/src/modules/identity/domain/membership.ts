export const membershipDeclarationVersion = '2026-11-05';

/** A self-declaration, not proof of age. Never use this input to grant a role. */
export function hasAgeDeclaration(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && 'ageOver14' in value && value.ageOver14 === true
  );
}
