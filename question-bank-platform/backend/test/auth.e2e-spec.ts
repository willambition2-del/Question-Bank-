import { INestApplication, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { toPublicUser } from '../src/common/mappers/user.mapper';
import type { PublicUser } from '../src/common/types/public-user.type';
import type { User } from '../src/generated/prisma/client';
import { CompanionType, UserRole } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import type { UpdateProfileDto } from '../src/users/dto/update-profile.dto';
import { CreateStudentInput, UsersService } from '../src/users/users.service';
jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

interface AuthResponseBody {
  user: {
    id: string;
    name: string;
    username: string;
    role: UserRole;
    companion: CompanionType;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: string;
    refreshTokenExpiresIn: string;
  };
}

class InMemoryUsersService {
  private readonly users = new Map<string, User>();

  findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return Promise.resolve(
      user && user.deletedAt === null ? { ...user } : null,
    );
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.findOne((user) => user.username === username.toLowerCase());
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.findOne((user) => user.phone === phone);
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    return this.findOne(
      (user) =>
        user.username === identifier.toLowerCase() || user.phone === identifier,
    );
  }

  createStudent(input: CreateStudentInput): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      name: input.name,
      username: input.username.toLowerCase(),
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      refreshTokenHash: null,
      role: UserRole.STUDENT,
      companion: input.companion,
      schoolName: input.schoolName ?? null,
      isActive: true,
      lastLoginAt: null,
      tokenVersion: 0,
      passwordChangedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.users.set(user.id, user);
    return Promise.resolve({ ...user });
  }

  async updateRefreshTokenHash(
    id: string,
    refreshTokenHash: string,
  ): Promise<User> {
    return this.update(id, { refreshTokenHash });
  }

  async completeLogin(id: string, refreshTokenHash: string): Promise<User> {
    return this.update(id, {
      refreshTokenHash,
      lastLoginAt: new Date(),
    });
  }

  rotateRefreshToken(
    id: string,
    currentHash: string,
    tokenVersion: number,
    nextHash: string,
  ): Promise<boolean> {
    const user = this.users.get(id);
    if (
      !user ||
      !user.isActive ||
      user.deletedAt !== null ||
      user.tokenVersion !== tokenVersion ||
      user.refreshTokenHash !== currentHash
    ) {
      return Promise.resolve(false);
    }

    this.users.set(id, {
      ...user,
      refreshTokenHash: nextHash,
      updatedAt: new Date(),
    });
    return Promise.resolve(true);
  }

  async clearRefreshToken(
    id: string,
    invalidateAccessTokens = false,
  ): Promise<User> {
    const user = await this.requireUser(id);
    return this.update(id, {
      refreshTokenHash: null,
      tokenVersion: invalidateAccessTokens
        ? user.tokenVersion + 1
        : user.tokenVersion,
    });
  }

  async getPublicProfile(id: string): Promise<PublicUser> {
    const user = await this.requireUser(id);
    return toPublicUser(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.requireUser(id);
    const updated = await this.update(id, {
      name: dto.name ?? user.name,
      phone: dto.phone ?? user.phone,
      schoolName: dto.schoolName ?? user.schoolName,
      companion: dto.companion ?? user.companion,
    });
    return toPublicUser(updated);
  }

  async changePassword(id: string, passwordHash: string): Promise<User> {
    const user = await this.requireUser(id);
    return this.update(id, {
      passwordHash,
      passwordChangedAt: new Date(),
      refreshTokenHash: null,
      tokenVersion: user.tokenVersion + 1,
    });
  }

  private findOne(predicate: (user: User) => boolean): Promise<User | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.deletedAt === null && predicate(candidate),
    );
    return Promise.resolve(user ? { ...user } : null);
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }

  private async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.requireUser(id);
    const updated: User = {
      ...user,
      ...data,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return { ...updated };
  }
}

describe('Auth and Users (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let refreshToken: string;
  let oldRefreshToken: string;

  const usersService = new InMemoryUsersService();
  const prismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
  };
  const configService = new ConfigService({
    API_PREFIX: 'api/v1',
    JWT_ACCESS_SECRET: 'e2e-access-secret',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '30d',
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(UsersService)
      .useValue(usersService)
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('POST /auth/register succeeds', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'E2E Student',
        username: 'E2E_STUDENT',
        phone: '+966500000010',
        password: 'Password1',
        schoolName: 'E2E School',
        companion: CompanionType.MALE,
      })
      .expect(201);
    const body = response.body as unknown as AuthResponseBody;

    expect(body.user.username).toBe('e2e_student');
    expect(body.user.role).toBe(UserRole.STUDENT);
    expect(body.user).not.toHaveProperty('passwordHash');
    accessToken = body.tokens.accessToken;
    refreshToken = body.tokens.refreshToken;
  });

  it('rejects a duplicate username with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Another Student',
        username: 'e2e_student',
        password: 'Password1',
        companion: CompanionType.FEMALE,
      })
      .expect(409);
  });

  it('POST /auth/login succeeds', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'E2E_STUDENT',
        password: 'Password1',
      })
      .expect(200);
    const body = response.body as unknown as AuthResponseBody;

    accessToken = body.tokens.accessToken;
    refreshToken = body.tokens.refreshToken;
    expect(body.user.username).toBe('e2e_student');
  });

  it('rejects an invalid login with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'e2e_student',
        password: 'WrongPassword1',
      })
      .expect(401);
  });

  it('rejects GET /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /auth/me returns the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      username: 'e2e_student',
      role: UserRole.STUDENT,
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('POST /auth/refresh rotates the token', async () => {
    oldRefreshToken = refreshToken;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const body = response.body as unknown as AuthResponseBody;

    expect(body.tokens.refreshToken).not.toBe(oldRefreshToken);
    accessToken = body.tokens.accessToken;
    refreshToken = body.tokens.refreshToken;
  });

  it('rejects the old refresh token after rotation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);
  });

  it('PATCH /users/me updates permitted fields', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Updated E2E Student',
        companion: CompanionType.FEMALE,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'Updated E2E Student',
      companion: CompanionType.FEMALE,
    });
  });

  it('POST /auth/logout invalidates the session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({
        message: 'Logged out successfully',
      });
  });

  it('rejects refresh after logout', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('keeps Health public', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body).toMatchObject({
          status: 'ok',
          database: 'connected',
        });
      });
  });

  it('keeps Swagger public and documents Auth and Users', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const body = response.body as unknown as {
      paths: Record<string, unknown>;
      components: {
        securitySchemes: Record<string, unknown>;
      };
    };

    expect(body.paths).toHaveProperty('/api/v1/auth/register');
    expect(body.paths).toHaveProperty('/api/v1/auth/login');
    expect(body.paths).toHaveProperty('/api/v1/auth/refresh');
    expect(body.paths).toHaveProperty('/api/v1/auth/logout');
    expect(body.paths).toHaveProperty('/api/v1/auth/me');
    expect(body.paths).toHaveProperty('/api/v1/auth/change-password');
    expect(body.paths).toHaveProperty('/api/v1/users/me');
    expect(body.components.securitySchemes).toHaveProperty('access-token');
  });

  afterAll(async () => {
    await app.close();
  });
});
