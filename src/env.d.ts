/// <reference types="astro/client" />

type AccountRole = 'ADMIN' | 'WORKER';

type SessionAccount = {
  id: string;
  role: AccountRole;
  workerId: string | null;
  email: string;
};

declare global {
  namespace App {
    interface Locals {
      account: SessionAccount | null;
    }
  }
}

export {};

