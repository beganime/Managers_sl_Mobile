import React from 'react';
import Svg, { Path } from 'react-native-svg';

type Name = 'home' | 'crm' | 'rank' | 'catalog' | 'profile';

interface Props {
  name: Name;
  color: string;
  focused?: boolean;
  size?: number;
}

export default function AppTabIcon({ name, color, focused = false, size = 24 }: Props) {
  const strokeWidth = focused ? 2.2 : 1.9;

  const icons: Record<Name, React.ReactNode> = {
    home: (
      <>
        <Path d="M5 11.5L12 5l7 6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7.5 10.5V18h9v-7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    crm: (
      <>
        <Path d="M8 11a3 3 0 100-6 3 3 0 000 6zm8 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3.5 18c.6-2.4 2.6-4 4.5-4s3.9 1.6 4.5 4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M13.5 18c.35-1.6 1.6-2.8 3.5-2.8 1.6 0 2.9 1 3.5 2.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    rank: (
      <>
        <Path d="M6 6h12l-2 5H8L6 6z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 11v3.2c0 1.8 1.4 3.3 3 3.3s3-1.5 3-3.3V11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9.5 19h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      </>
    ),
    catalog: (
      <>
        <Path d="M6.5 6.5h11a1.5 1.5 0 011.5 1.5v8.8a1.2 1.2 0 01-1.2 1.2H8a2 2 0 00-2 2V8a1.5 1.5 0 011.5-1.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 10h6M9 13h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      </>
    ),
    profile: (
      <>
        <Path d="M12 11a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M5.5 19c.8-3 3.3-4.8 6.5-4.8s5.7 1.8 6.5 4.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {icons[name]}
    </Svg>
  );
}