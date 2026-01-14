import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { ProgressProvider } from "./src/state/progress";
import { SettingsProvider } from "./src/state/settings";
import { SakuraBurstProvider } from "./src/ui/effects/SakuraBurstProvider";

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ProgressProvider>
          <SakuraBurstProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SakuraBurstProvider>
          <StatusBar style="dark" />
        </ProgressProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
