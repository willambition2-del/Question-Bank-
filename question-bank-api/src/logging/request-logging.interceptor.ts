import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

type RequestWithUser = Request & {
  user?: { userId?: string; sub?: string };
  requestId?: string;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = this.requestId(request.headers['x-request-id']);
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    const startedAt = Date.now();
    const details = () => ({
      event: 'http_request',
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      userId: request.user?.userId ?? request.user?.sub ?? null,
    });
    if (this.config.get<string>('NODE_ENV') === 'test') return next.handle();
    return next.handle().pipe(
      tap(() => this.logger.log(details())),
      catchError((error: unknown) => {
        this.logger.error({
          ...details(),
          event: 'http_error',
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Request processing failed',
        });
        return throwError(() => error);
      }),
    );
  }

  private requestId(value: string | string[] | undefined) {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate && /^[A-Za-z0-9._-]{8,128}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}
