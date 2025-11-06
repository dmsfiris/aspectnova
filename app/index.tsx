// app/index.tsx
import { Redirect } from "expo-router";
import React from "react";

import { AFTER_LOGIN_PATH } from "@/config/routes";

export default function Index(): React.ReactElement {
  // Route groups like (tabs) are not part of the public URL.
  // Redirect to the public path that renders your tabs tree.
  return <Redirect href={AFTER_LOGIN_PATH} />;
}
