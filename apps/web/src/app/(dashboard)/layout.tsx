import AppShell from "@/components/layout/app-shell";
import DashboardChrome from "@/components/layout/dashboard-chrome";

/** The member area and the admin consoles: the app shell, then their chrome. */
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      <DashboardChrome>{children}</DashboardChrome>
    </AppShell>
  );
}
