import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

interface PrismaErrorShape {
  code?: unknown;
}

export function contentBadRequest(code: string, message: string) {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    code,
    message,
  });
}

export function contentConflict(code: string, message: string) {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    code,
    message,
  });
}

export function contentNotFound(code: string, message: string) {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    code,
    message,
  });
}

export function mapContentPrismaError(
  error: unknown,
  fallbackCode: string,
): never {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as PrismaErrorShape).code
      : undefined;
  if (code === 'P2002') {
    throw contentConflict(fallbackCode, 'A conflicting content record exists');
  }
  if (code === 'P2003') {
    throw contentBadRequest(
      'QUESTION_HIERARCHY_INVALID',
      'A related content record is invalid',
    );
  }
  if (code === 'P2025') {
    throw contentNotFound(fallbackCode, 'Content record not found');
  }
  throw error;
}
