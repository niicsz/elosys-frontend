import { Component, inject, input } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-dialog-frame',
  template: `
    <div class="modal__header">
      <span class="mono-label">{{ title() }}</span>
      <button type="button" class="modal__close" (click)="ref.close()" aria-label="fechar">×</button>
    </div>
    <div class="modal__body"><ng-content /></div>
  `,
})
export class DialogFrameComponent {
  readonly title = input.required<string>();
  protected readonly ref = inject(MatDialogRef);
}
