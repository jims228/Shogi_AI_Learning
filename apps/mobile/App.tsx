import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { ProgressProvider } from "./src/state/progress";
import { SettingsProvider } from "./src/state/settings";

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ProgressProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="dark" />
        </ProgressProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
