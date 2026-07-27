import { redirect } from "next/navigation";

// The activity board lives inside Find a Buddy (browse view) - this route only
// exists so old links don't 404.
export default function ActivitiesRedirect() {
  redirect("/match?mode=activity");
}
