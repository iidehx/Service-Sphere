export type PasswordRequirementKey = 'length' | 'uppercase' | 'lowercase' | 'number' | 'symbol';

export type PasswordRequirement = {
  key: PasswordRequirementKey;
  label: string;
  met: boolean;
};

export type PasswordValidation = {
  isValid: boolean;
  requirements: PasswordRequirement[];
  unmetRequirements: PasswordRequirement[];
  message: string | null;
};

const PASSWORD_REQUIREMENTS: ReadonlyArray<{
  key: PasswordRequirementKey;
  label: string;
  test: (password: string) => boolean;
}> = [
  { key: 'length', label: 'At least 12 characters', test: (password) => password.length >= 12 },
  { key: 'uppercase', label: 'One uppercase letter', test: (password) => /[A-Z]/.test(password) },
  { key: 'lowercase', label: 'One lowercase letter', test: (password) => /[a-z]/.test(password) },
  { key: 'number', label: 'One number', test: (password) => /[0-9]/.test(password) },
  { key: 'symbol', label: 'One symbol', test: (password) => /[^A-Za-z0-9]/.test(password) },
];

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.';

export function validatePassword(password: string): PasswordValidation {
  const requirements = PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    met: requirement.test(password),
  }));
  const unmetRequirements = requirements.filter((requirement) => !requirement.met);

  return {
    isValid: unmetRequirements.length === 0,
    requirements,
    unmetRequirements,
    message: unmetRequirements.length === 0 ? null : PASSWORD_POLICY_MESSAGE,
  };
}

export function mapPasswordAuthError(error: unknown): string | null {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';

  return code.includes('weak-password') || code.includes('password-does-not-meet-requirements')
    ? PASSWORD_POLICY_MESSAGE
    : null;
}