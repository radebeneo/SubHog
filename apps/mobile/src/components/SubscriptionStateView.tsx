import { useSubscriptions } from "@/providers/SubscriptionContext";
import {
  deriveProfileName,
  isValidProfileName,
  normalizeProfileNamePart,
} from "@/features/profile/profile-name";
import { useUser } from "@clerk/expo";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export default function SubscriptionStateView() {
  const { state, provision, retry } = useSubscriptions();
  const profileRecovery =
    state.status === "error" &&
    state.failure.operation === "provision" &&
    state.failure.code === "PROFILE_INCOMPLETE";

  if (
    state.status === "authentication-loading" ||
    state.status === "resolving-identity" ||
    state.status === "loading-subscriptions" ||
    state.status === "provisioning"
  ) {
    const label =
      state.status === "provisioning"
        ? "Setting up your account..."
        : state.status === "loading-subscriptions"
          ? "Loading subscriptions..."
          : state.status === "resolving-identity"
            ? "Resolving your account..."
            : "Checking authentication...";
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-base font-sans-medium text-primary">
          {label}
        </Text>
      </View>
    );
  }

  if (state.status === "unprovisioned") {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-2xl font-sans-bold text-primary">
          Finish account setup
        </Text>
        <Text className="mt-3 text-center text-base font-sans-medium text-muted-foreground">
          Create your SubHog profile before loading owned subscriptions.
        </Text>
        <Pressable className="auth-button mt-6 w-full" onPress={() => void provision()}>
          <Text className="auth-button-text">Create SubHog profile</Text>
        </Pressable>
      </View>
    );
  }

  if (state.status === "error") {
    const provisionFailure = state.failure.operation === "provision";
    if (profileRecovery) {
      return <ProfileRecovery provision={provision} retry={retry} />;
    }
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-2xl font-sans-bold text-primary">
          {state.failure.operation === "configuration"
            ? "API configuration required"
            : "Subscriptions unavailable"}
        </Text>
        <Text className="mt-3 text-center text-base font-sans-medium text-destructive">
          {state.failure.message}
        </Text>
        {state.failure.mutationMayHaveCompleted && (
          <Text className="mt-3 text-center text-sm font-sans-medium text-muted-foreground">
            Account setup may have completed on the server. Recheck before choosing to submit again.
          </Text>
        )}
        {state.failure.operation !== "configuration" && (
          <Pressable className="auth-button mt-6 w-full" onPress={() => void retry()}>
            <Text className="auth-button-text">
              {provisionFailure ? "Recheck account" : "Try again"}
            </Text>
          </Pressable>
        )}
        {provisionFailure && state.failure.retryable && (
          <Pressable
            className="auth-secondary-button mt-3 w-full"
            onPress={() => void provision()}
          >
            <Text className="auth-secondary-button-text">
              Submit setup again
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return null;
}

function ProfileRecovery({
  provision,
  retry,
}: {
  provision: () => Promise<void>;
  retry: () => Promise<void>;
}) {
  const { user } = useUser();

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-base font-sans-medium text-primary">
          Loading your profile...
        </Text>
      </View>
    );
  }

  return (
    <ProfileRecoveryForm
      key={user.id}
      initialFirstName={user.firstName ?? ""}
      initialLastName={user.lastName ?? ""}
      updateProfile={async (firstName, lastName) => {
        await user.update({
          firstName: firstName || null,
          lastName: lastName || null,
        });
      }}
      provision={provision}
      retry={retry}
    />
  );
}

function ProfileRecoveryForm({
  initialFirstName,
  initialLastName,
  updateProfile,
  provision,
  retry,
}: {
  initialFirstName: string;
  initialLastName: string;
  updateProfile: (firstName: string, lastName: string) => Promise<void>;
  provision: () => Promise<void>;
  retry: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const derivedName = deriveProfileName(firstName, lastName);
  const profileNameValid = isValidProfileName(firstName, lastName);

  const saveProfileAndProvision = async () => {
    if (!profileNameValid) {
      setProfileError("Your combined name must be 2 to 20 characters.");
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateProfile(
        normalizeProfileNamePart(firstName),
        normalizeProfileNamePart(lastName),
      );
      await provision();
    } catch {
      setProfileError(
        "Your profile could not be updated. Check your details and try again.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-background p-6">
      <Text className="text-center text-2xl font-sans-bold text-primary">
        Complete your profile
      </Text>
      <Text className="mt-3 text-center text-base font-sans-medium text-muted-foreground">
        Enter a combined name between 2 and 20 characters, then retry account
        setup.
      </Text>
      <View className="auth-card">
        <View className="auth-form">
          <View className="auth-field">
            <Text className="auth-label">First Name</Text>
            <TextInput
              className="auth-input"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              editable={!profileSaving}
            />
          </View>
          <View className="auth-field">
            <Text className="auth-label">Last Name</Text>
            <TextInput
              className="auth-input"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              editable={!profileSaving}
            />
          </View>
          <Text className="auth-helper">
            Profile name: {derivedName || "Not set"}
          </Text>
          {profileError && <Text className="auth-error">{profileError}</Text>}
          <Pressable
            className={`auth-button ${
              (!profileNameValid || profileSaving) && "auth-button-disabled"
            }`}
            disabled={!profileNameValid || profileSaving}
            onPress={() => void saveProfileAndProvision()}
          >
            <Text className="auth-button-text">
              {profileSaving ? "Saving profile..." : "Save and continue"}
            </Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        className="auth-secondary-button mt-3 w-full"
        disabled={profileSaving}
        onPress={() => void retry()}
      >
        <Text className="auth-secondary-button-text">Recheck account</Text>
      </Pressable>
    </View>
  );
}
