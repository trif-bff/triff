import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm rise">
        <Link href="/" className="mb-8 flex justify-center"><Logo /></Link>
        {children}
      </div>
    </div>
  );
}
