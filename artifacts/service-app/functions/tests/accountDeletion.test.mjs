import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteAccountResources } from "../lib/accountDeletion.js";

test("keeps the Auth identity when marking deletion fails", async () => {
  let identityDeleted = false;

  await assert.rejects(
    deleteAccountResources({
      markDeleting: async () => {
        throw new Error("Firestore unavailable");
      },
      deleteIdentity: async () => {
        identityDeleted = true;
      },
      deleteProfiles: async () => {},
    }),
    /Firestore unavailable/,
  );

  assert.equal(identityDeleted, false);
});

test("marks deletion before removing identity and profiles", async () => {
  const steps = [];

  await deleteAccountResources({
    markDeleting: async () => steps.push("marked"),
    deleteIdentity: async () => steps.push("identity"),
    deleteProfiles: async () => steps.push("profiles"),
  });

  assert.deepEqual(steps, ["marked", "identity", "profiles"]);
});

test("cleanup can continue after an interrupted identity deletion response", async () => {
  let profileDeletes = 0;
  let identityDeletes = 0;

  const attempt = () => deleteAccountResources({
    markDeleting: async () => {},
    deleteProfiles: async () => {
      profileDeletes += 1;
      if (profileDeletes === 1) throw new Error("Profile cleanup interrupted");
    },
    deleteIdentity: async () => {
      identityDeletes += 1;
    },
  });

  await assert.rejects(attempt(), /Profile cleanup interrupted/);
  await assert.doesNotReject(attempt());
  assert.equal(profileDeletes, 2);
  assert.equal(identityDeletes, 2);
});