import { useTheme } from '../context/ThemeContext';

export function useAppTheme() {
  return useTheme().appTheme;
}
