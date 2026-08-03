import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

export const quizBadRequest = (code: string, message: string) =>
  new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    code,
    message,
  });

export const quizConflict = (code: string, message: string) =>
  new ConflictException({ statusCode: HttpStatus.CONFLICT, code, message });

export const quizNotFound = (message = 'Quiz attempt not found') =>
  new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    code: 'QUIZ_ATTEMPT_NOT_FOUND',
    message,
  });
