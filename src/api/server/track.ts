import { acting_user_log_fields, type ActingUser } from "#src/api/acting_user";
import { log } from "#src/api/log";

export function track_as(
  acting_user: ActingUser,
  fields: { event: string } & Record<string, unknown>,
) {
  log("info", { ...fields, ...acting_user_log_fields(acting_user) });
}
