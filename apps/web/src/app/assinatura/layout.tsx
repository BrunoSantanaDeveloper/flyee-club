import AppShell from "@/components/layout/app-shell";

/** The focused checkout: built on MUI like the member area, without its header and menu. */
export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
