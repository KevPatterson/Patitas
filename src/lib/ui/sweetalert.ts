import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import '../../styles/sweetalert.css';

/**
 * Capa única de feedback del producto.
 *
 * Sustituye los diálogos nativos (`alert`, `confirm`, `prompt`) por avisos
 * integrados con la identidad visual de Patitas:
 *  - `notify*`: toasts no bloqueantes para éxitos y errores puntuales.
 *  - `confirmDialog`: confirmación explícita antes de acciones destructivas.
 *  - `promptText`: captura de texto (por ejemplo, el motivo de un rechazo).
 *
 * Todo pasa por SweetAlert2, que ya gestiona foco, teclado (Esc/Enter) y
 * lectores de pantalla. Los colores salen de los tokens de `globals.css`, así
 * que el tema claro/oscuro se respeta sin duplicar valores.
 */

type NotifyKind = 'success' | 'error' | 'warning' | 'info';

const ICON_COLORS: Record<NotifyKind, string> = {
  success: '#10b981',
  error: '#dc2626',
  warning: '#f0721f',
  info: '#ff8c42',
};

const TOAST_CLASSES = {
  popup: 'patitas-swal patitas-swal-toast',
  title: 'patitas-swal-toast__title',
  htmlContainer: 'patitas-swal-toast__text',
  icon: 'patitas-swal-toast__icon',
  timerProgressBar: 'patitas-swal-toast__progress',
};

const DIALOG_CLASSES = {
  popup: 'patitas-swal',
  title: 'patitas-swal__title',
  htmlContainer: 'patitas-swal__text',
  actions: 'patitas-swal__actions',
  confirmButton: 'patitas-swal-btn patitas-swal-btn--primary',
  cancelButton: 'patitas-swal-btn patitas-swal-btn--ghost',
  input: 'patitas-swal__input',
  validationMessage: 'patitas-swal__validation',
};

/** Los toasts se pausan al pasar el cursor para dar tiempo a leerlos. */
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  showCloseButton: false,
  timer: 4500,
  timerProgressBar: true,
  heightAuto: false,
  didOpen: (element) => {
    element.onmouseenter = Swal.stopTimer;
    element.onmouseleave = Swal.resumeTimer;
  },
});

function showNotify(kind: NotifyKind, title: string, text?: string): void {
  void toast.fire({
    icon: kind,
    iconColor: ICON_COLORS[kind],
    title,
    text,
    customClass: TOAST_CLASSES,
  });
}

export function notifySuccess(title: string, text?: string): void {
  showNotify('success', title, text);
}

export function notifyError(title: string, text?: string): void {
  showNotify('error', title, text);
}

export function notifyWarning(title: string, text?: string): void {
  showNotify('warning', title, text);
}

export function notifyInfo(title: string, text?: string): void {
  showNotify('info', title, text);
}

export type ConfirmDialogOptions = {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  /** `danger` pinta el botón en rojo y enfoca "Cancelar" por defecto. */
  tone?: 'primary' | 'danger';
};

/** Confirmación modal. Devuelve `true` solo si el usuario acepta. */
export async function confirmDialog({
  title,
  text,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'primary',
}: ConfirmDialogOptions): Promise<boolean> {
  const isDanger = tone === 'danger';
  const result = await Swal.fire({
    title,
    text,
    icon: isDanger ? 'warning' : 'question',
    iconColor: isDanger ? ICON_COLORS.error : ICON_COLORS.info,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: isDanger,
    heightAuto: false,
    buttonsStyling: false,
    customClass: {
      ...DIALOG_CLASSES,
      confirmButton: isDanger
        ? 'patitas-swal-btn patitas-swal-btn--danger'
        : 'patitas-swal-btn patitas-swal-btn--primary',
    },
  });

  return result.isConfirmed;
}

/** Aviso informativo de un solo botón para mensajes que merecen una pausa. */
export async function infoDialog({
  title,
  text,
  confirmText = 'Entendido',
}: {
  title: string;
  text?: string;
  confirmText?: string;
}): Promise<void> {
  await Swal.fire({
    title,
    text,
    icon: 'info',
    iconColor: ICON_COLORS.info,
    confirmButtonText: confirmText,
    heightAuto: false,
    buttonsStyling: false,
    customClass: DIALOG_CLASSES,
  });
}

export type PromptTextOptions = {
  title: string;
  text?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  minLength?: number;
  maxLength?: number;
  input?: 'text' | 'textarea';
  /** `danger` pinta el botón de confirmar en rojo. */
  tone?: 'primary' | 'danger';
};

/**
 * Pide un texto corto. Devuelve `null` si el usuario cancela y el valor ya
 * recortado si confirma; SweetAlert no deja confirmar si no cumple `minLength`.
 */
export async function promptText({
  title,
  text,
  placeholder,
  confirmText = 'Guardar',
  cancelText = 'Cancelar',
  minLength = 1,
  maxLength = 500,
  input = 'textarea',
  tone = 'primary',
}: PromptTextOptions): Promise<string | null> {
  const result = await Swal.fire({
    title,
    text,
    input,
    inputPlaceholder: placeholder,
    inputAttributes: {
      'aria-label': title,
      maxlength: String(maxLength),
    },
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    heightAuto: false,
    buttonsStyling: false,
    inputValidator: (value) => {
      const trimmed = (value ?? '').trim();
      if (trimmed.length === 0) return 'Escribe un motivo para continuar.';
      if (trimmed.length < minLength) {
        return `Escribe al menos ${minLength} caracteres.`;
      }
      return undefined;
    },
    customClass: {
      ...DIALOG_CLASSES,
      confirmButton:
        tone === 'danger'
          ? 'patitas-swal-btn patitas-swal-btn--danger'
          : 'patitas-swal-btn patitas-swal-btn--primary',
    },
  });

  if (!result.isConfirmed) return null;
  return String(result.value ?? '').trim();
}
