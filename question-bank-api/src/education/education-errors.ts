import {
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

interface PrismaErrorShape {
  code?: unknown;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as PrismaErrorShape).code === 'P2002'
  );
}

export function educationNotFound(code: string, message: string) {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    code,
    message,
  });
}

export function educationConflict(code: string, message: string) {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    code,
    message,
  });
}
