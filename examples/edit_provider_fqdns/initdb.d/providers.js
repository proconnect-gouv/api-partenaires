db = db.getSiblingDB("partners");
db.providers.insertMany([
  {
    uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
    name: "moncomptepro",
    fqdns: ["moncomptepro.fr", "polyfi.fr"],
  },
  {
    // absent from partners.yaml: must never be editable through the API
    uid: "e2d5f1c0-0000-4000-8000-000000000000",
    name: "intruder",
    fqdns: ["intruder.fr"],
  },
]);
