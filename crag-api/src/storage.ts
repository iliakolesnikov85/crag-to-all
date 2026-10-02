import { getFirebaseStorage } from '@crag-to-all/shared-firebase';
import type { ImageStorage } from './types';

export function createFirebaseImageStorage(): ImageStorage {
  return {
    async uploadImage(storagePath, data) {
      try {
        await getFirebaseStorage().uploadImage(storagePath, data);
      } catch (error) {
        console.error(`Failed to upload ${storagePath} to Firebase Storage:`, error);
        throw error;
      }
    },
  };
}
