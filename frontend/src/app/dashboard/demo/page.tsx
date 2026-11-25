import { redirect } from "next/navigation";

// The live demo used to live here; it is the dashboard now.
export default function DemoRedirect() {
  redirect("/dashboard");
}
