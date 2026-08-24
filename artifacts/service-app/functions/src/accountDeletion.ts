export type AccountDeletionOperations = {
  markDeleting: () => Promise<void>;
  deleteIdentity: () => Promise<void>;
  deleteProfiles: () => Promise<void>;
};

/**
 * The deletion marker blocks every active client from recreating profiles while
 * the Auth identity and its Firestore documents are removed.
 */
export async function deleteAccountResources({
  markDeleting,
  deleteIdentity,
  deleteProfiles,
}: AccountDeletionOperations): Promise<void> {
  await markDeleting();
  await deleteIdentity();
  await deleteProfiles();
}