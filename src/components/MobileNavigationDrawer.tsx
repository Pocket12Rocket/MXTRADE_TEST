import Link from 'next/link';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import type { SxProps, Theme } from '@mui/material/styles';

// Why: One text style for every drawer row, so the rows can't drift apart.
const NAV_TEXT_SX: SxProps<Theme> = {
  fontSize: '0.875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

/** One primary navigation link. */
export interface NavItem {
  href: string;
  label: string;
}

/** Props of `MobileNavigationDrawer`. */
interface MobileNavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  isSignedIn: boolean;
  onLogout: () => void;
}

/**
 * Why: Keeps mobile navigation focused and predictable by placing the shared
 * route list in an accessible MUI Drawer instead of expanding the header and
 * pushing page content down.
 * @param props - Mobile navigation state and links.
 * @param props.open - Whether the drawer is visible.
 * @param props.onClose - Closes the drawer.
 * @param props.items - Primary navigation links.
 * @param props.isSignedIn - Whether signed-in-only actions are available.
 * @param props.onLogout - Signs the user out.
 * @returns A left-side navigation drawer for compact screens.
 * @example
 * <MobileNavigationDrawer open={open} onClose={close} items={items} isSignedIn={false} onLogout={logout} />
 */
export default function MobileNavigationDrawer({
  open,
  onClose,
  items,
  isSignedIn,
  onLogout,
}: MobileNavigationDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { className: 'w-[min(88vw,360px)] bg-[#e5e7eb]' } }}
      sx={{ zIndex: 50 }}
    >
      <div className="px-4 py-5">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Navigation
        </p>
        <List disablePadding className="mt-3 space-y-1">
          {items.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              onClick={onClose}
              sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}
            >
              <ListItemText primary={item.label} slotProps={{ primary: { sx: NAV_TEXT_SX } }} />
            </ListItemButton>
          ))}
          <ListItemButton
            component={Link}
            href="/profile/orders"
            onClick={onClose}
            sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}
          >
            <ListItemText primary="Orders" slotProps={{ primary: { sx: NAV_TEXT_SX } }} />
          </ListItemButton>
          <ListItemButton
            component={Link}
            href="/profile"
            onClick={onClose}
            sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}
          >
            <ListItemText primary="Profile" slotProps={{ primary: { sx: NAV_TEXT_SX } }} />
          </ListItemButton>
          <ListItemButton
            component={Link}
            href="/seller/submissions"
            onClick={onClose}
            sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}
          >
            <ListItemText primary="Seller dashboard" slotProps={{ primary: { sx: NAV_TEXT_SX } }} />
          </ListItemButton>
          {isSignedIn ? (
            <ListItemButton
              onClick={onLogout}
              sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#b91c1c' }}
            >
              <ListItemText primary="Log out" slotProps={{ primary: { sx: NAV_TEXT_SX } }} />
            </ListItemButton>
          ) : null}
        </List>
      </div>
    </Drawer>
  );
}
