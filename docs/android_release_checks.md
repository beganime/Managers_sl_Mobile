# Android Release Checks

## Google Play Recommendations

Current release target after this sprint: `2.3.2`.

### Large Screens And Orientation

Google Play reported:

- `android:screenOrientation="PORTRAIT"` on `MainActivity`.

Mobile app fix:

- `expo.orientation` is now `default`, so Expo prebuild/EAS should no longer generate the portrait-only `screenOrientation` lock.
- App layouts already use responsive React Native containers, `SafeAreaView`, wrapping cards and scrollable screens.

Manual build check after EAS build:

- Inspect generated Android manifest and confirm `MainActivity` has no `android:screenOrientation="portrait"`.
- Test at least one emulator/tablet width and one foldable/tablet-like landscape viewport.

### Android 15 Edge-To-Edge APIs

Google Play reported unsupported/deprecated Android 15 window APIs from React Native, React Native Screens, Material sheets and Expo Image Picker internals.

Mobile app fix:

- Removed the app-level `react-native` `StatusBar` usage that explicitly passed `backgroundColor="transparent"` and `translucent`.
- App now uses `expo-status-bar` for icon style only.
- No app source calls `setStatusBarColor`, `setNavigationBarColor`, `statusBarColor` or `navigationBarColor`.
- `edgeToEdgeEnabled` remains enabled because Android 15+ enforces edge-to-edge for target SDK 35+ and Expo SDK 54 is designed around this mode.

Expected remaining note:

- If Play Console still lists `WindowUtilKt.enableEdgeToEdge`, `StatusBarModule.getTypedExportedConstants`, `react-native-screens` or Material sheet classes, that is coming from native dependencies. Rebuild with the latest Expo SDK/React Native patch when available and re-check.

Manual UI check:

- Android 15/16 device or emulator.
- Login with keyboard open.
- Bottom tabs and screen bottom content with gesture navigation.
- Modal/bottom-sheet screens if used by Expo Image Picker or Document Picker.
- Landscape and tablet-width dashboard, CRM, documents and education screens.
