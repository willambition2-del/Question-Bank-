import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client';
import {
  AdminPrivilegeAuditAction,
  CompanionType,
  UserRole,
} from '../generated/prisma/enums';

export type BootstrapOptions = {
  userId?: string;
  email?: string;
  username?: string;
  name?: string;
  activate: boolean;
  dryRun: boolean;
  passwordEnv?: string;
  confirmProduction?: string;
};

const value = (args: string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const has = (args: string[], name: string) => args.includes(name);

export function parseOptions(args: string[]): BootstrapOptions {
  return {
    userId: value(args, '--user-id'),
    email: value(args, '--email')?.trim().toLowerCase(),
    username: value(args, '--username')?.trim().toLowerCase(),
    name: value(args, '--name')?.trim(),
    activate: has(args, '--activate'),
    dryRun: has(args, '--dry-run'),
    passwordEnv: value(args, '--password-env'),
    confirmProduction: value(args, '--confirm-production'),
  };
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

export function assertSafeEnvironment(
  environment: string,
  confirmation?: string,
) {
  if (
    environment === 'production' &&
    confirmation !== 'SUPER_ADMIN_BOOTSTRAP_PRODUCTION'
  ) {
    throw new Error(
      'Production bootstrap requires --confirm-production SUPER_ADMIN_BOOTSTRAP_PRODUCTION',
    );
  }
}

export function assertStrongPassword(password: string) {
  if (
    password.length < 20 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      'Bootstrap password must be at least 20 characters with upper, lower, number, and symbol',
    );
  }
}

async function bootstrap(prisma: PrismaClient, options: BootstrapOptions) {
  const environment =
    process.env.NODE_ENV?.trim().toLowerCase() || 'development';
  assertSafeEnvironment(environment, options.confirmProduction);
  if (!options.userId && !options.email)
    throw new Error('Provide --user-id or --email');
  if (options.userId && options.email)
    throw new Error('Use only one account selector: --user-id or --email');

  const existing = await prisma.user.findFirst({
    where: options.userId ? { id: options.userId } : { email: options.email },
  });
  if (existing?.deletedAt)
    throw new Error('Refusing to modify a deleted account');
  const creating = !existing;
  if (creating && (!options.email || !options.username || !options.name))
    throw new Error(
      'Creating an account requires --email, --username, and --name',
    );

  if (options.username) {
    const usernameOwner = await prisma.user.findUnique({
      where: { username: options.username },
    });
    if (usernameOwner && usernameOwner.id !== existing?.id)
      throw new Error('Username is already in use');
  }
  if (options.email) {
    const emailOwner = await prisma.user.findUnique({
      where: { email: options.email },
    });
    if (emailOwner && emailOwner.id !== existing?.id)
      throw new Error('Email is already in use');
  }

  const action = creating
    ? AdminPrivilegeAuditAction.CREATED_SUPER_ADMIN
    : AdminPrivilegeAuditAction.PROMOTED_SUPER_ADMIN;
  const activeAfter = options.activate ? true : (existing?.isActive ?? false);
  if (options.dryRun)
    return {
      dryRun: true,
      action,
      userId: existing?.id ?? null,
      email: maskEmail(options.email ?? existing?.email),
      roleBefore: existing?.role ?? null,
      roleAfter: UserRole.SUPER_ADMIN,
      isActiveAfter: activeAfter,
    };

  const password = options.passwordEnv
    ? process.env[options.passwordEnv]
    : undefined;
  if (creating && !password)
    throw new Error('Creating an account requires --password-env NAME');
  if (password) assertStrongPassword(password);
  const passwordHash = password
    ? await argon2.hash(password, { type: argon2.argon2id })
    : undefined;
  const actorLabel = `secure-cli:${process.env.USERNAME || process.env.USER || 'local-operator'}`;

  const result = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            role: UserRole.SUPER_ADMIN,
            isActive: activeAfter,
            name: options.name || undefined,
            username: options.username || undefined,
            email: options.email || undefined,
            passwordHash,
            refreshTokenHash: null,
            tokenVersion: { increment: 1 },
            deletedAt: null,
          },
        })
      : await tx.user.create({
          data: {
            name: options.name!,
            username: options.username!,
            email: options.email!,
            passwordHash: passwordHash!,
            role: UserRole.SUPER_ADMIN,
            companion: CompanionType.MALE,
            isActive: activeAfter,
          },
        });
    const audit = await tx.adminPrivilegeAudit.create({
      data: {
        targetUserId: user.id,
        action,
        previousRole: existing?.role ?? null,
        activated: activeAfter,
        environment,
        actorLabel,
        metadataJson: {
          selector: options.userId ? 'USER_ID' : 'EMAIL',
          passwordSet: Boolean(passwordHash),
          activationExplicit: options.activate,
        },
      },
    });
    return { user, auditId: audit.id };
  });

  return {
    dryRun: false,
    action,
    userId: result.user.id,
    email: maskEmail(result.user.email),
    username: result.user.username,
    role: result.user.role,
    isActive: result.user.isActive,
    auditId: result.auditId,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    console.log(
      JSON.stringify(
        await bootstrap(prisma, parseOptions(process.argv.slice(2))),
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module)
  void main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
