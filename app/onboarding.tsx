import images from '@/constants/images';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Onboarding() {
    return (
        <SafeAreaView className="onboarding-safe-area">
            <StatusBar style="light" />

            <View className="onboarding-content">
                <Image
                    source={images.splashPattern}
                    contentFit="contain"
                    className="onboarding-pattern"
                />

                <View className="onboarding-copy">
                    <Text className="onboarding-title">Gain Financial Clarity</Text>
                    <Text className="onboarding-subtitle">
                        Track, analyze and cancel with ease
                    </Text>
                </View>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Get started"
                    className="onboarding-button"
                    onPress={() => router.replace('/(auth)/sign-up')}
                >
                    <Text className="onboarding-button-text">Get Started</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
