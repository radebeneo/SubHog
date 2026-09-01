import images from "@/constants/images";
import "@/global.css";
import { styled } from "nativewind";
import { Image, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";


const SafeAreaView = styled(RNSafeAreaView)
export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-background p-5">

      <View className="home-header">
        <View className="home-user">
          <Image className="home-avatar" source={images.avatar} />
        </View>
      </View>

    </SafeAreaView>
  );
}