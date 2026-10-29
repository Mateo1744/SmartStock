/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Paleta visual compartida de SmartStock. Las pantallas usan estos mismos tonos
// para mantener la identidad verde del inicio en toda la aplicación.
export const SmartStockColors = {
  primary: '#13795B',
  primaryDark: '#126B52',
  heading: '#173B32',
  text: '#35574D',
  textMuted: '#647D75',
  background: '#F4F7F5',
  surface: '#FFFFFF',
  surfaceMint: '#EAF8F2',
  border: '#DCE7E2',
  borderStrong: '#91BEAF',
  success: '#1E6B42',
  warning: '#F59E0B',
  danger: '#B42318',
} as const;

export const Colors = {
  light: {
    text: SmartStockColors.heading,
    background: SmartStockColors.background,
    backgroundElement: SmartStockColors.surface,
    backgroundSelected: SmartStockColors.surfaceMint,
    textSecondary: SmartStockColors.textMuted,
  },
  dark: {
    text: '#F4FBF8',
    background: '#071F1A',
    backgroundElement: '#0B4338',
    backgroundSelected: '#19594D',
    textSecondary: '#B9D8CF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
