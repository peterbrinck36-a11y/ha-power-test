/** Shared server-action form state. */
export type FormState = {
  error: string | null;
  ok: boolean;
  /** Success message that is not an error (e.g. "Settings saved"). */
  notice?: string | null;
  /** One-time temporary password, present only when the invitation email failed. */
  tempPassword?: string | null;
  /** Whether the invitation/test email was sent. */
  emailSent?: boolean;
  emailError?: string | null;
};

export const initialFormState: FormState = { error: null, ok: false };
