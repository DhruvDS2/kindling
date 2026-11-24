// Kindling base components (DESIGN.md §6). Screens import from here, never from a component file.
import './tokens.css';
import './base.css';

export { AppShell, Nav, TopBar, type NavGroup, type NavItem, type NavProps, type TopBarProps } from './components/AppShell';
export { Button, Kbd, type ButtonProps, type ButtonVariant } from './components/Button';
export { WeekPager, WeekRuler, type RulerBreak, type WeekPagerProps, type WeekRulerProps } from './components/DateControl';
export { Drawer, DrawerSection, type DrawerPager, type DrawerProps } from './components/Drawer';
export { NumberFlow, useCountThrough, type NumberFlowProps } from './components/NumberFlow';
export { PageView, usePageTransition } from './components/PageTransition';
export { PropertyList, type Property } from './components/PropertyList';
export { ScoreMeter, type ScoreMeterProps } from './components/ScoreMeter';
export { SearchField, type SearchFieldProps } from './components/SearchField';
export { Skeleton, type SkeletonProps } from './components/Skeleton';
export { Sparkline, type SparklineProps } from './components/Sparkline';
export { StatBlock, StatRow, type StatBlockProps, type StatRowItem } from './components/StatBlock';
export { EmptyState, ErrorState, type EmptyStateProps, type ErrorStateProps } from './components/States';
export { StatusPill, statusTone, type StatusTone } from './components/StatusPill';
export { Table, revealSeconds, type Column, type RowAction, type SortState, type TableDivider, type TableProps } from './components/Table';
export { SegmentedControl, Tabs, type ChoiceOption } from './components/Tabs';
export { ToastProvider, useToast, type ToastInput } from './components/Toast';
export { Tooltip, TruncatedText } from './components/Tooltip';
export { UpdatingMark } from './components/UpdatingMark';
export * as icons from './components/icons';
export * from './dates';
export { dur, durMs, ease, readToken, risePx, tr, useReduce } from './motion';
