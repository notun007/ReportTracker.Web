import { inject } from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpXsrfTokenExtractor } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';

// Retry only a rejection issued by the API's pre-action antiforgery filter.
// Business validation, authorization, transport errors and an unsuccessful retry are never replayed.
export const sessionXsrfRecovery: HttpInterceptorFn = (request, next) => {
  const backend = inject(HttpBackend);
  const tokens = inject(HttpXsrfTokenExtractor);
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (!request.url.startsWith('/api/') || !isMutation) return next(request);

  return next(request).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 400 || error.error?.code !== 'csrf_token_invalid') {
      return throwError(() => error);
    }
    // Bypass interceptors while refreshing to prevent a circular recovery chain.
    return new HttpClient(backend).get('/api/auth/session').pipe(switchMap(() => {
      const token = tokens.getToken();
      if (!token) return throwError(() => error);
      return next(request.clone({ setHeaders: { 'X-XSRF-TOKEN': token } }));
    }));
  }));
};
