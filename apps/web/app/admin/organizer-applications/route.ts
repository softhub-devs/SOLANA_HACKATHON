import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, "/admin/organizer-applications");
}
