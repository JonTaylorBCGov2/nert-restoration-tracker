import { IAuthState } from 'contexts/authStateContext';
import Keycloak from 'keycloak-js';

const SystemUserAuthState: IAuthState = {
  keycloakWrapper: {
    keycloak: ({
      authenticated: true
    } as unknown) as Keycloak,
    hasLoadedAllUserInfo: true,
    systemRoles: [],
    hasSystemRole: () => false,
    hasProjectRole: () => false,
    hasAccessRequest: false,
    getUserIdentifier: () => 'testusername',
    getIdentitySource: () => 'idir',
    getUserGuid: () => 'aaaa',
    username: 'testusername',
    displayName: 'testdisplayname',
    email: 'test@email.com',
    systemUserId: 1,
    refresh: () => {
      // do nothing
    }
  }
};

// Same effect as `Partial` but applies to all levels of a nested object
type Subset<T> = {
  [P in keyof T]?: T[P] extends Record<any, any> | undefined ? Subset<T[P]> : T[P];
};

export const getMockAuthState = (
  overrides?: Subset<IAuthState>,
  base: IAuthState = SystemUserAuthState
): IAuthState => {
  return ({
    ...base,
    ...overrides,
    keycloakWrapper: {
      ...base.keycloakWrapper,
      ...overrides?.keycloakWrapper,
      Keycloak: {
        ...base.keycloakWrapper?.keycloak,
        ...overrides?.keycloakWrapper?.keycloak
      }
    }
  } as unknown) as IAuthState;
};
