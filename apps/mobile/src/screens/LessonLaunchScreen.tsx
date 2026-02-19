import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { PawnLessonRemakeScreen } from "./PawnLessonRemakeScreen";

type Props = NativeStackScreenProps<RootStackParamList, "LessonLaunch">;

/**
 * 全レッスンを Duolingo スタイルレイアウト (PawnLessonRemakeScreen) で開く。
 * Web 側の各レッスンページは embed=1 対応済み。
 */
export function LessonLaunchScreen(props: Props) {
  return <PawnLessonRemakeScreen {...props} />;
}
