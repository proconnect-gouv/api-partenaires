db = db.getSiblingDB("partners");
db.provider.insertMany([
  {
    active: true,
    attachedEmailDomains: ["moncomptepro.fr", "polyfi.fr"],
    name: "moncomptepro",
    uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
  },
  {
    // absent from oidc_providers.yaml: the API has no record of this UID and must refuse every read and write
    attachedEmailDomains: ["intruder.fr"],
    name: "intruder",
    uid: "e2d5f1c0-0000-4000-8000-000000000000",
  },
  {
    active: true,
    name: "sans-attached-email-domains",
    uid: "b7c1e2a0-0000-4000-8000-000000000000",
  },
  {
    attachedEmailDomains: ["inactive.fr"],
    name: "inactive",
    uid: "1a7c3e9b-0000-4000-8000-000000000000",
  },
]);
