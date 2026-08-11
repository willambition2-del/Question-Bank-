jest.mock('../generated/prisma/client', () => ({ Prisma: {} }));
import {
  assertSafeEnvironment,
  assertStrongPassword,
  maskEmail,
  parseOptions,
} from './admin-create-super';

describe('secure super admin bootstrap CLI', () => {
  it('parses explicit activation and dry-run flags', () => {
    expect(
      parseOptions([
        '--email',
        'Owner@Example.Local',
        '--activate',
        '--dry-run',
      ]),
    ).toMatchObject({
      email: 'owner@example.local',
      activate: true,
      dryRun: true,
    });
  });
  it('masks email and rejects unsafe production execution', () => {
    expect(maskEmail('platform.owner@example.local')).toBe(
      'pl***@example.local',
    );
    expect(() => assertSafeEnvironment('production')).toThrow(
      'Production bootstrap requires',
    );
    expect(() =>
      assertSafeEnvironment('production', 'SUPER_ADMIN_BOOTSTRAP_PRODUCTION'),
    ).not.toThrow();
  });
  it('requires a strong bootstrap password', () => {
    expect(() => assertStrongPassword('short')).toThrow();
    expect(() =>
      assertStrongPassword('Strong-Temporary-Password-2026!'),
    ).not.toThrow();
  });
});
