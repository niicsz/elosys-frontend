import { HttpInterceptorFn } from '@angular/common/http';

export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  const apiBase = window.__env?.apiBase ?? '';
  if (apiBase && req.url.startsWith('/api')) {
    return next(req.clone({ url: apiBase.replace(/\/$/, '') + req.url }));
  }
  return next(req);
};
