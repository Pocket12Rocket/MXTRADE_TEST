import Link from 'next/link';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

/**
 * Why: Keeps mobile navigation focused and predictable by placing the shared
 * route list in an accessible MUI Drawer instead of expanding the header and
 * pushing page content down.
 * @param {Object} props - Mobile navigation state and links.
 * @param {boolean} props.open - Whether the drawer is visible.
 * @param {() => void} props.onClose - Closes the drawer.
 * @param {Array<{href: string, label: string}>} props.items - Primary navigation links.
 * @param {boolean} props.isSignedIn - Whether signed-in-only actions are available.
 * @param {number} props.pendingApprovalCount - Admin badge count.
 * @param {() => void} props.onLogout - Signs the user out.
 * @returns {JSX.Element} A left-side navigation drawer for compact screens.
 * @example
 * <MobileNavigationDrawer open={open} onClose={close} items={items} isSignedIn={false} pendingApprovalCount={0} onLogout={logout} />
 */
export default function MobileNavigationDrawer({ open, onClose, items, isSignedIn, pendingApprovalCount, onLogout }) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { className: 'w-[min(88vw,360px)] bg-[#e5e7eb]' } }}
      sx={{ zIndex: 50 }}
    >
      <div className="px-4 py-5">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Navigation</p>
        <List disablePadding className="mt-3 space-y-1">
          {items.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              onClick={onClose}
              sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}
            >
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              />
              {item.href === '/admin/dashboard' && pendingApprovalCount > 0 ? (
                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                </span>
              ) : null}
            </ListItemButton>
          ))}
          <ListItemButton component={Link} href="/profile/orders" onClick={onClose} sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}>
            <ListItemText primary="Orders" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }} />
          </ListItemButton>
          <ListItemButton component={Link} href="/profile" onClick={onClose} sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}>
            <ListItemText primary="Profile" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }} />
          </ListItemButton>
          <ListItemButton component={Link} href="/seller/submissions" onClick={onClose} sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#334155' }}>
            <ListItemText primary="Seller dashboard" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }} />
          </ListItemButton>
          {isSignedIn ? (
            <ListItemButton onClick={onLogout} sx={{ borderRadius: '12px', px: 1.5, py: 1.25, color: '#b91c1c' }}>
              <ListItemText primary="Log out" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }} />
            </ListItemButton>
          ) : null}
        </List>
      </div>
    </Drawer>
  );
}
