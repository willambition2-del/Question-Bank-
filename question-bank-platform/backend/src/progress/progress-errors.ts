import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

const response = (code: string, message: string) => ({ code, message });

export const progressBadRequest = (code: string, message: string) =>
  new BadRequestException(response(code, message));

export const progressNotFound = (code: string, message: string) =>
  new NotFoundException(response(code, message));

export const progressConflict = (code: string, message: string) =>
  new ConflictException(response(code, message));
