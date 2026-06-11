import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;

      if (Array.isArray(body.message)) {
        errorCode = 'VALIDATION_ERROR';
        errors = body.message as string[];
        message = 'Validation failed';
      } else {
        message = typeof body.message === 'string' ? body.message : exception.message;
        errorCode = this.statusToCode(status);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`unhandled.exception error=${exception.message}`, exception.stack);
    }

    res.status(status).json({
      success: false,
      status,
      timestamp: new Date().toISOString(),
      path: req.path,
      message,
      errorCode,
      ...(errors && { errors }),
    });
  }

  private statusToCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      502: 'AI_PROVIDER_ERROR',
    };
    return codes[status] ?? 'INTERNAL_ERROR';
  }
}
