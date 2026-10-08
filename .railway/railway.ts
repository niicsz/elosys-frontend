import { defineRailway, github, project, service } from "railway/iac";

export const partial = "elosys-frontend";

export default defineRailway(() => {
  const elosys_frontend = service("elosys-frontend", {
    source: github("niicsz/elosys-frontend", { branch: "main" }),
    builder: "DOCKERFILE",
    dockerfilePath: "Dockerfile",
    healthcheck: "/",
    healthcheckTimeout: 120,
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 5,
    variables: {
      PORT: "8080",
      API_BASE: "https://elosys-backend-production.up.railway.app",
    },
  });
  return project("elosys", {
    resources: [elosys_frontend],
  });
});
