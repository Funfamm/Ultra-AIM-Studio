"use client";

import { useRef } from "react";

interface Props {
  q: string;
  role: string;
  via: string;
  sort: string;
  status: string;
}

export function UsersFilters({ q, role, via, sort, status }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function submit() {
    formRef.current?.requestSubmit();
  }

  function debouncedSubmit() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(submit, 420);
  }

  return (
    <form
      ref={formRef}
      method="get"
      action="/admin/users"
      className="ufilters"
    >
      <input
        name="q"
        type="search"
        defaultValue={q}
        onChange={debouncedSubmit}
        placeholder="Search name or email…"
        className="ufilter-search"
        autoComplete="off"
      />
      <select name="role" defaultValue={role} onChange={submit} className="ufilter-select">
        <option value="">All Roles</option>
        <option value="ADMIN">Admin</option>
        <option value="USER">Member</option>
      </select>
      <select name="via" defaultValue={via} onChange={submit} className="ufilter-select">
        <option value="">All Methods</option>
        <option value="google">Google</option>
        <option value="email">Email / Password</option>
        <option value="multi">Multi</option>
      </select>
      <select name="status" defaultValue={status} onChange={submit} className="ufilter-select">
        <option value="">All Statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="SUSPENDED">Suspended</option>
      </select>
      <select name="sort" defaultValue={sort} onChange={submit} className="ufilter-select">
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>
    </form>
  );
}
