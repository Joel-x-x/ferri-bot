import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse } from '../dto/api-response';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        const res = context.switchToHttp().getResponse<Response>();
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
