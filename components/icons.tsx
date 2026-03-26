import React from 'react';
import Svg, { Path } from 'react-native-svg';

type IconProps = { color: string; size?: number; active?: boolean };

function Base({ children, size = 24 }: { children: React.ReactNode; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </Base>
  );
}

export function CrmIcon({ color, size = 24 }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M7.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19.5c0-2.3 2.3-4 5-4s5 1.7 5 4M13.5 19.5c.3-1.8 2.3-3.2 4.7-3.2 1.2 0 2.4.3 3.3 1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function TrophyIcon({ color, size = 24 }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M8 4h8v3a4 4 0 0 1-8 0V4ZM6 5H4v1a4 4 0 0 0 4 4M18 5h2v1a4 4 0 0 1-4 4M12 11v4M9 20h6M10 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function LibraryIcon({ color, size = 24 }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v15H7.5A2.5 2.5 0 0 0 5 21V6.5Zm0 0V20" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function UserIcon({ color, size = 24 }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 1 1 14 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}
