import { type Email } from "#src/api/email";
import { assert_never } from "#src/utils";
export type HmacActingUser = {
  readonly auth: "hmac";
  readonly email: Email;
};

export type TokenActingUser = {
  readonly auth: "token";
  readonly client_id: string;
  readonly email: Email;
  readonly sub: string;
};

export type ActingUser = HmacActingUser | TokenActingUser;

export function hmac_acting_user(email: Email): HmacActingUser {
  return { auth: "hmac", email };
}

export function token_acting_user({
  client_id,
  email,
  sub,
}: {
  client_id: string;
  email: Email;
  sub: string;
}): TokenActingUser {
  return { auth: "token", client_id, email, sub };
}

export function acting_user_log_fields(acting_user: ActingUser) {
  switch (acting_user.auth) {
    case "hmac":
      return { auth: acting_user.auth, by: acting_user.email };
    case "token":
      return {
        auth: acting_user.auth,
        by: acting_user.email,
        client_id: acting_user.client_id,
        sub: acting_user.sub,
      };
    default:
      return assert_never(acting_user);
  }
}
