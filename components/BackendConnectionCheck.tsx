import { convexConfig } from "@/context/AppBackendProvider";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/expo";
import { useConvexAuth, useConvexConnectionState, useQuery } from "convex/react";
import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export function BackendConnectionCheck() {
  if (!__DEV__) return null;

  return (
    <View className="mt-6 rounded-2xl bg-card p-4">
      <Text className="text-lg font-sans-bold text-primary">
        Backend connection (development)
      </Text>
      <Text className="mt-2 text-sm font-sans-medium text-muted-foreground">
        Unit 1 checks identity only. Subscriptions still reset on restart.
      </Text>
      {convexConfig.status === "unconfigured" ? (
        <StatusText>
          Not configured. Follow docs/convex-setup.md, then restart Expo.
        </StatusText>
      ) : convexConfig.status === "invalid" ? (
        <StatusText>{convexConfig.message}</StatusText>
      ) : (
        <ConnectionErrorBoundary>
          <IdentityCheck />
        </ConnectionErrorBoundary>
      )}
    </View>
  );
}

function StatusText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityLiveRegion="polite" className="mt-3 text-sm font-sans-medium text-primary">
      {children}
    </Text>
  );
}

function IdentityCheck() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth();
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const identity = useQuery(
    api.identity.current,
    isLoaded && isSignedIn && isAuthenticated ? {} : "skip",
  );

  if (!isLoaded) return <StatusText>Loading Clerk session...</StatusText>;
  if (!isSignedIn) return <StatusText>Sign in to check the connection.</StatusText>;
  if (!isWebSocketConnected) {
    return (
      <StatusText>
        {hasEverConnected
          ? "Connection lost. Waiting to reconnect to Convex..."
          : "Connecting to Convex. Check your connection and deployment URL if this persists."}
      </StatusText>
    );
  }
  if (isLoading) {
    return <StatusText>Authenticating with Convex. If this persists, check your connection and deployment setup.</StatusText>;
  }
  if (!isAuthenticated) {
    return <StatusText>Convex authentication failed. Check the Clerk integration and issuer, then sign out and sign in again.</StatusText>;
  }
  if (isRefreshing) return <StatusText>Refreshing Convex authentication...</StatusText>;
  if (identity === undefined) return <StatusText>Loading verified identity...</StatusText>;
  if (identity.subject !== userId) {
    return <StatusText>Identity mismatch. Sign out and check the development configuration.</StatusText>;
  }

  return <StatusText>Connected. Convex verified your current Clerk account.</StatusText>;
}

class ConnectionErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View>
        <StatusText>
          Identity check failed. Check your development deployment and sync its functions.
        </StatusText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry backend identity check"
          className="mt-3 rounded-2xl bg-muted px-4 py-3"
          onPress={() => this.setState({ failed: false })}
        >
          <Text className="text-center font-sans-bold text-primary">Retry check</Text>
        </Pressable>
      </View>
    );
  }
}
