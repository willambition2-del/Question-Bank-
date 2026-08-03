import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { UserRole } from '../../generated/prisma/enums';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

interface ParentGuard {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>;
}

const createContext = (user?: {
  userId: string;
  username: string;
  role: UserRole;
  tokenVersion: number;
}): ExecutionContext =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('bypasses authentication for public routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('delegates protected routes to Passport JWT auth', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as ParentGuard;
    const parentSpy = jest.spyOn(parent, 'canActivate').mockReturnValue(false);

    expect(guard.canActivate(createContext())).toBe(false);
    expect(parentSpy).toHaveBeenCalled();
    parentSpy.mockRestore();
  });
});

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows a user whose role is required', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ]);

    expect(
      guard.canActivate(
        createContext({
          userId: 'admin-1',
          username: 'admin',
          role: UserRole.ADMIN,
          tokenVersion: 0,
        }),
      ),
    ).toBe(true);
  });

  it('denies a user whose role is not required', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(
      guard.canActivate(
        createContext({
          userId: 'student-1',
          username: 'student',
          role: UserRole.STUDENT,
          tokenVersion: 0,
        }),
      ),
    ).toBe(false);
  });
});
