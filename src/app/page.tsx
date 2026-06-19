import { redirect } from "next/navigation";

// The player experience is the ported v2 app at /play (see docs/v2-migration.md).
// next.config also 307-redirects "/" → "/play"; this keeps the route compiling
// without depending on the retired (game) experience.
export default function Home() {
  redirect("/play");
}
