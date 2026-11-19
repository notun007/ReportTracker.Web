import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { apiError } from './dashboard.service';
import { NotificationService } from './notification.service';

export const operationErrorNotifications: HttpInterceptorFn = (request, next) => {
  const notifications = inject(NotificationService);
  return next(request).pipe(catchError(error => {
    const isMutation = request.method !== 'GET' && request.method !== 'HEAD';
    const isUserOperationError = error instanceof HttpErrorResponse && [400, 403, 409, 422].includes(error.status);
    if (isMutation && isUserOperationError && !request.url.includes('/api/auth/')) notifications.error(apiError(error));
    return throwError(() => error);
  }));
};
