export * from "./result";

export const assert_never = (value: never): never => {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
};
