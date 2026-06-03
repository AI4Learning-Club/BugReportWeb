import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpStatus,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

function readTarget(exception: Prisma.PrismaClientKnownRequestError) {
  const target = exception.meta?.target;
  if (Array.isArray(target)) {
    return target.join(', ');
  }
  if (typeof target === 'string') {
    return target;
  }
  return null;
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception.code === 'P2002') {
      const target = readTarget(exception);
      const message = target ? `${target} already exists` : 'Resource already exists';
      const conflict = new ConflictException(message);
      response.status(conflict.getStatus()).json(conflict.getResponse());
      return;
    }

    if (exception.code === 'P2003') {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Referenced record does not exist',
        error: 'Bad Request'
      });
      return;
    }

    if (exception.code === 'P2025') {
      const notFound = new NotFoundException('Record not found');
      response.status(notFound.getStatus()).json(notFound.getResponse());
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
}
