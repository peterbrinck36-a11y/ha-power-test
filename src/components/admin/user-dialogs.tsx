"use client";

import { useActionState, useEffect, useState } from "react";

import { createUser, deleteUser, updateUser } from "@/app/admin/users/actions";
import { Dialog } from "@/components/ui/dialog";
import { initialFormState } from "@/lib/forms";

export type UserRow = {
  id: number;
  email: string;
  username: string;
  role: "admin" | "owner";
  active: boolean;
};

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const primaryButtonClasses =
  "rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60";
const secondaryButtonClasses =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50";

function UserDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
}) {
  const isEdit = user !== null;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateUser : createUser,
    initialFormState,
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit user — ${user.username}` : "New user"}
    >
      <form action={formAction} className="space-y-4">
        {isEdit ? <input type="hidden" name="id" value={user.id} /> : null}

        <div>
          <label htmlFor="user-email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="user-email"
            name="email"
            type="email"
            required
            defaultValue={user?.email ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="user-username" className="block text-sm font-medium text-slate-700">
            Username
          </label>
          <input
            id="user-username"
            name="username"
            type="text"
            required
            defaultValue={user?.username ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="user-role" className="block text-sm font-medium text-slate-700">
            Role
          </label>
          <select
            id="user-role"
            name="role"
            defaultValue={user?.role ?? "owner"}
            className={inputClasses}
          >
            <option value="owner">Boat owner</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {isEdit ? (
          <div className="flex items-center gap-2">
            <input
              id="user-active"
              name="active"
              type="checkbox"
              defaultChecked={user.active}
              className="h-4 w-4"
            />
            <label htmlFor="user-active" className="text-sm text-slate-700">
              Account active
            </label>
          </div>
        ) : null}

        <div>
          <label htmlFor="user-password" className="block text-sm font-medium text-slate-700">
            {isEdit ? "New password (leave blank to keep current)" : "Password"}
          </label>
          <input
            id="user-password"
            name="password"
            type="password"
            required={!isEdit}
            minLength={8}
            autoComplete="new-password"
            className={inputClasses}
          />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClasses}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryButtonClasses}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create user"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClasses}>
        New user
      </button>
      <UserDialog open={open} onClose={() => setOpen(false)} user={null} />
    </>
  );
}

export function UserRowActions({ user }: { user: UserRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteUser,
    initialFormState,
  );

  return (
    <div className="flex items-center justify-end gap-1">
      <UserDialog open={editOpen} onClose={() => setEditOpen(false)} user={user} />

      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="rounded-lg px-2 py-1 text-sm text-sky-700 hover:bg-sky-50"
      >
        Edit
      </button>
      <form action={deleteFormAction}>
        <input type="hidden" name="id" value={user.id} />
        <button
          type="submit"
          disabled={deletePending}
          onClick={(event) => {
            if (!confirm(`Delete ${user.username}? Any assigned meter becomes unassigned.`)) {
              event.preventDefault();
            }
          }}
          className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </form>

      {deleteState.error ? (
        <span role="alert" className="text-xs text-red-600">
          {deleteState.error}
        </span>
      ) : null}
    </div>
  );
}
