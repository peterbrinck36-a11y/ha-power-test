"use client";

import { useActionState, useEffect, useState } from "react";

import { createMeter, deleteMeter, updateMeter } from "@/app/admin/meters/actions";
import { SensorPicker } from "@/components/admin/sensor-picker";
import { Dialog } from "@/components/ui/dialog";
import { initialFormState } from "@/lib/forms";

export type MeterRow = {
  id: number;
  name: string;
  ownerId: number | null;
  powerEntityId: string;
  energyEntityId: string;
  kwhOffset: number;
};

export type OwnerOption = {
  id: number;
  username: string;
  email: string;
  active: boolean;
};

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const primaryButtonClasses =
  "rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60";
const secondaryButtonClasses =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50";

function MeterDialog({
  open,
  onClose,
  meter,
  owners,
}: {
  open: boolean;
  onClose: () => void;
  meter: MeterRow | null;
  owners: OwnerOption[];
}) {
  const isEdit = meter !== null;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateMeter : createMeter,
    initialFormState,
  );
  const [powerEntity, setPowerEntity] = useState("");
  const [energyEntity, setEnergyEntity] = useState("");

  // Reset the controlled entity fields each time the dialog opens.
  useEffect(() => {
    if (open) {
      setPowerEntity(meter?.powerEntityId ?? "");
      setEnergyEntity(meter?.energyEntityId ?? "");
    }
  }, [open, meter]);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit meter — ${meter.name}` : "New meter"}
    >
      <form action={formAction} className="space-y-4">
        {isEdit ? <input type="hidden" name="id" value={meter.id} /> : null}

        <div>
          <label htmlFor="meter-name" className="block text-sm font-medium text-slate-700">
            Name / slip label
          </label>
          <input
            id="meter-name"
            name="name"
            type="text"
            required
            placeholder="Boat #12 — Slip A"
            defaultValue={meter?.name ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="meter-owner" className="block text-sm font-medium text-slate-700">
            Assigned owner
          </label>
          <select
            id="meter-owner"
            name="ownerId"
            defaultValue={meter?.ownerId ?? ""}
            className={inputClasses}
          >
            <option value="">— Unassigned —</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.username} ({owner.email}){owner.active ? "" : " — disabled"}
              </option>
            ))}
          </select>
        </div>

        <SensorPicker
          label="Power sensor (W / kW)"
          name="powerEntityId"
          value={powerEntity}
          onChange={setPowerEntity}
          required
        />

        <SensorPicker
          label="Energy sensor (kWh)"
          name="energyEntityId"
          value={energyEntity}
          onChange={setEnergyEntity}
          required
        />

        <div>
          <label htmlFor="meter-offset" className="block text-sm font-medium text-slate-700">
            kWh offset (zero the total for a new tenant)
          </label>
          {/* Text + inputMode avoids locale-dependent type=number step validation
              (comma-decimal browsers would silently reject "5.239"). The server
              validates the value and surfaces a clear error. */}
          <input
            id="meter-offset"
            name="kwhOffset"
            type="text"
            inputMode="decimal"
            placeholder="0"
            defaultValue={meter?.kwhOffset === 0 ? "0" : String(meter?.kwhOffset ?? 0)}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-slate-500">
            Displayed total = meter reading − offset, never below 0.
          </p>
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
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create meter"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewMeterButton({ owners }: { owners: OwnerOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClasses}>
        New meter
      </button>
      <MeterDialog open={open} onClose={() => setOpen(false)} meter={null} owners={owners} />
    </>
  );
}

export function MeterRowActions({
  meter,
  owners,
}: {
  meter: MeterRow;
  owners: OwnerOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteMeter,
    initialFormState,
  );

  return (
    <div className="flex items-center justify-end gap-1">
      <MeterDialog open={editOpen} onClose={() => setEditOpen(false)} meter={meter} owners={owners} />

      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="rounded-lg px-2 py-1 text-sm text-sky-700 hover:bg-sky-50"
      >
        Edit
      </button>
      <form action={deleteFormAction}>
        <input type="hidden" name="id" value={meter.id} />
        <button
          type="submit"
          disabled={deletePending}
          onClick={(event) => {
            if (!confirm(`Delete meter "${meter.name}"?`)) {
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
