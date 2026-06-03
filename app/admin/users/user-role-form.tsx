"use client";

import { useActionState, useRef } from "react";
import { changeUserRole } from "@/lib/actions/users-admin";

type State = { ok: boolean; error?: string } | null;

interface Props {
  userId: string;
  currentRole: string;
  isSelf: boolean;
}

export function UserRoleForm({ userId, currentRole, isSelf }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<State, FormData>(
    (prev, fd) => changeUserRole(userId, prev, fd),
    null
  );

  return (
    <form ref={formRef} action={formAction} className="urole-form">
      <select
        name="role"
        defaultValue={currentRole}
        disabled={isSelf || isPending}
        onChange={() => formRef.current?.requestSubmit()}
        className={`urole-select ${isSelf ? "urole-select--self" : state?.ok === false ? "urole-select--err" : ""}`}
        title={isSelf ? "You cannot change your own role" : undefined}
      >
        <option value="USER">Member</option>
        <option value="ADMIN">Admin</option>
        <option value="SUPER_ADMIN">Super Admin</option>
      </select>
      {isPending && <span className="urole-pending" />}
      {state?.error && (
        <span className="urole-error" title={state.error}>!</span>
      )}
    </form>
  );
}
