db = db.getSiblingDB("partners");
db.client.insertOne({
  _id: ObjectId("64b64b64b64b64b64b64b64b"),
  name: "Legacy pcdbapi client",
  collaborators: ["test@example.com"],
  key: "b".repeat(64),
  // ciphertext produced by pcdbapi itself (federation/pcdbapi/test_crypt.py fixture) —
  // proves the ported AES-256-GCM decrypt is byte-for-byte compatible with data
  // already stored in Mongo by pcdbapi, through the real containerized binary
  client_secret:
    "+sqGL4XE6aqzIMOp/DKC1jWB8I+8qE1jW6iz2tUv8lt+ZZzxjyoCBQeuAcJTFZxfLywkn6cAICK5JPLxYM0+8pk/q7CGHUfr/gzr3ZYRroWWE+egEEDxqRYDYe0=",
  claims: ["amr"],
  type: "private",
  scopes: ["openid"],
  createdAt: new Date(),
  updatedAt: new Date(),
  secretUpdatedAt: new Date(),
  updatedBy: "pcdbapi",
});
