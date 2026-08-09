import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenanceGenerator from "@/components/admin/maintenance-generator";
import Link from "next/link";
import { ChevronLeft, Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MaintenanceGeneratePage() {
  redirect("/admin/dashboard");
}
