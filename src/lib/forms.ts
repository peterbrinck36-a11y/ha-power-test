/** Shared server-action form state. */
export type FormState = {
  error: string | null;
  ok: boolean;
};

export const initialFormState: FormState = { error: null, ok: false };
