import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class MongoExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // PRD Requirement 6: Catch MongoDB duplicate key error code 11000 and return HTTP 409 Conflict
    if (exception && (exception.code === 11000 || exception.name === 'MongoServerError' && exception.code === 11000)) {
      return response.status(HttpStatus.CONFLICT).json({
        success: false,
        error: {
          code: 'DUPLICATE_RESOURCE_CONFLICT',
          message: 'A resource with this unique key already exists in the database.',
          details: exception.keyValue || exception.message,
        },
        meta: { requestId: `req_${Date.now()}` },
      });
    }

    // Standard NestJS HttpExceptions
    if (exception.getStatus && typeof exception.getStatus === 'function') {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response.status(status).json(typeof res === 'string' ? { message: res } : res);
    }

    // Fallback internal server error
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal server error occurred.',
      },
    });
  }
}
