import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse } from '../dto/api-response';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | undefined> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | undefined> {
    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        const res = context.switchToHttp().getResponse<Response>();
        // HTTP 204 No Content must not have a body (RFC 7230)
        if (res.statusCode === HttpStatus.NO_CONTENT) return undefined;
        return {
          success: true,
          status: res.statusCode,
          timestamp: new Date().toISOString(),
          path: req.path,
          data,
        };
      }),
    );
  }
}
