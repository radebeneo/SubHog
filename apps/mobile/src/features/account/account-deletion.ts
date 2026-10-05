import { ApiError } from "@subhog/api-client";
import type { IdentityDto } from "@subhog/contracts";

export const ACCOUNT_DELETE_RETRY_MESSAGE =
  "We could not confirm that your SubHog data was deleted. Please try again.";

interface AccountDeletionApi {
  deleteIdentity(): Promise<void>;
  getIdentity(): Promise<IdentityDto>;
}

interface AccountDeletionDependencies {
  api: AccountDeletionApi;
  deleteProviderUser: () => Promise<unknown>;
}

export async function deleteAccount({
  api,
  deleteProviderUser,
}: AccountDeletionDependencies): Promise<void> {
  try {
    await api.deleteIdentity();
  } catch (error) {
    if (!(error instanceof ApiError) || error.kind !== "transport") {
      throw error;
    }

    let identity: IdentityDto;
    try {
      identity = await api.getIdentity();
    } catch {
      throw new Error(ACCOUNT_DELETE_RETRY_MESSAGE);
    }
    if (identity.provisioned) {
      throw new Error(ACCOUNT_DELETE_RETRY_MESSAGE);
    }
  }

  await deleteProviderUser();
}
