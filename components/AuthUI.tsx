import images from "@/constants/images";
import { colors } from "@/constants/theme";
import clsx from "clsx";
import { Image } from "expo-image";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthScreenProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

type AuthFieldProps = TextInputProps & {
  label: string;
  error?: string;
  isPassword?: boolean;
  isPasswordVisible?: boolean;
  onTogglePassword?: () => void;
};

type AuthButtonProps = {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  onPress: () => void;
};

export function AuthScreen({ title, subtitle, children }: AuthScreenProps) {
  return (
    <SafeAreaView className="auth-safe-area">
      <KeyboardAvoidingView
        className="auth-screen"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="auth-scroll"
          contentContainerClassName="auth-content"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="auth-brand-block">
            <Image
              source={images.logo}
              contentFit="contain"
              className="auth-brand-logo"
              accessibilityLabel="SubHog"
            />
            <Text className="auth-title">{title}</Text>
            <Text className="auth-subtitle">{subtitle}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthField({
  label,
  error,
  isPassword,
  isPasswordVisible,
  onTogglePassword,
  ...inputProps
}: AuthFieldProps) {
  return (
    <View className="auth-field">
      <Text className="auth-label">{label}</Text>
      <View className="auth-input-wrap">
        <TextInput
          {...inputProps}
          className={clsx(
            "auth-input",
            isPassword && "auth-input-password",
            error && "auth-input-error",
          )}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={isPassword && !isPasswordVisible}
          accessibilityLabel={label}
        />
        {isPassword ? (
          <Pressable
            className="auth-password-toggle"
            onPress={onTogglePassword}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
          >
            <Text className="auth-password-toggle-text">
              {isPasswordVisible ? "Hide" : "Show"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="auth-error">{error}</Text> : null}
    </View>
  );
}

export function AuthButton({
  label,
  loading,
  disabled,
  secondary,
  onPress,
}: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={clsx(
        secondary ? "auth-secondary-button" : "auth-button",
        isDisabled && "auth-button-disabled",
      )}
      disabled={isDisabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text
          className={secondary ? "auth-secondary-button-text" : "auth-button-text"}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <View className="auth-notice" accessibilityRole="alert">
      <Text className="auth-notice-text">{children}</Text>
    </View>
  );
}
