import { useIsDesktop } from '../hooks/useMediaQuery';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';

/**
 * AppShell: Selects completely different layout trees for desktop vs mobile.
 * Desktop uses a sidebar + header pattern.
 * Mobile uses a top header + bottom navigation pattern.
 * They share the same page <Outlet> content but the wrapping layout is 100% different.
 */
export default function AppShell() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopLayout /> : <MobileLayout />;
}
