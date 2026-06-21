export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastPayload = {
  title: string;
  message?: string;
  type?: ToastType;
  durationMs?: number;
};

export const showToast = ({ title, message, type = 'info', durationMs }: ToastPayload) => {
  window.dispatchEvent(
    new CustomEvent<ToastPayload>('app-toast', {
      detail: { title, message, type, durationMs },
    })
  );
};
