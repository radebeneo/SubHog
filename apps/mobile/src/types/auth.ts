export type AuthStatus = "loading" | "signed-out" | "signed-in";

export type AuthUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
};
