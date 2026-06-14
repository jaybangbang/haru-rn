import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

export const HomeIcon = ({ size = 22, color = 'currentColor', filled = false }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" fill={filled ? color : 'none'} fillOpacity={filled ? 0.12 : 0} />
  </Svg>
);

export const PenIcon = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 4l6 6-11 11H3v-6L14 4z" />
    <Path d="M13 5l6 6" />
  </Svg>
);

export const ChartIcon = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 19V5" />
    <Path d="M4 19h16" />
    <Path d="M7 15c2-3 4-3 5-1s3 2 5-3" />
  </Svg>
);

export const SearchIcon = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-3.5-3.5" />
  </Svg>
);

export const CloseIcon = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
    <Path d="M6 6l12 12M6 18L18 6" />
  </Svg>
);

export const ChevronLeftIcon = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const SparkleIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2l1.6 5.6L19 9.2l-5.4 1.6L12 16l-1.6-5.2L5 9.2l5.4-1.6z" opacity={0.95} />
    <Circle cx={19} cy={18} r={1.2} opacity={0.6} />
    <Circle cx={4} cy={17} r={0.8} opacity={0.5} />
  </Svg>
);

export const MagnifyIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={11} cy={11} r={6} />
    <Path d="M19 19l-4-4" />
  </Svg>
);

export const BoltIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M13 2L4 14h7l-1 8 9-12h-7z" />
  </Svg>
);

export const CompassIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M15.5 8.5L13 13l-4.5 2.5L11 11z" fill={color} fillOpacity={0.3} />
  </Svg>
);

export const CommentIcon = ({ size = 14, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2z" opacity={0.85} />
  </Svg>
);

export const ArrowRightIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const FlameIcon = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2c0 4-5 5-5 11a7 7 0 0 0 14 0c0-3-2-5-3.5-6 0 2-1.5 3-3 3 .5-3-1-6-2.5-8z" opacity={0.95} />
    <Path d="M12 12c-1 1.5-2 2.8-2 4.5a3.5 3.5 0 0 0 7 0c0-1.7-1.2-2.5-2-3 0 1-.8 1.5-1.5 1.5.2-1.2-.5-2-1.5-3z" fill="#fff" opacity={0.4} />
  </Svg>
);

export const MicIcon = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={9} y={3} width={6} height={12} rx={3} />
    <Path d="M5 11a7 7 0 0 0 14 0M12 19v3" />
  </Svg>
);

export const HeartIcon = ({ size = 13, color = 'currentColor', filled = false }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </Svg>
);

export const CheckIcon = ({ size = 14, color = 'currentColor' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12l4 4 10-10" />
  </Svg>
);

export const BellIcon = ({ size = 22, color = 'currentColor', filled = false }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill={filled ? color : 'none'} fillOpacity={filled ? 0.15 : 0} />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);
