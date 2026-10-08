import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, shareReplay } from 'rxjs';
import { Meta } from '../shared/models/api.models';
import { ElosysApiService } from './elosys-api.service';

@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly api = inject(ElosysApiService);
  readonly meta$ = this.api.meta().pipe(
    catchError(() => of<Meta | null>(null)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
  readonly meta = toSignal(this.meta$, { initialValue: null });
}
