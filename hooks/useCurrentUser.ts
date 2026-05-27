import React from 'react';

import { useAuth } from '../src/store/auth';
import { AppUser } from '../src/types';

export type CurrentUser = AppUser;

type ReloadOptions = {
  preferCache?: boolean;
  silent?: boolean;
};

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function useCurrentUser() {
  const auth = useAuth();

  return {
    user: auth.user,
    loading: auth.status === 'loading',
    hydrated: auth.status !== 'loading',
    reload: (_options?: ReloadOptions) => auth.refreshUser(),
    setUser: auth.setUser,
    clearUser: auth.logout,
  };
}
