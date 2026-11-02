import DoctorShell from "@/components/DoctorShell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <DoctorShell>{children}</DoctorShell>;
}
