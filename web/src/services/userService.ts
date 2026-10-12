import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';
import { useGameStore } from '../store/gameStore';

export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
  return null;
};

export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>) => {
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      ...profile,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving user profile to Firestore:', error);
  }
};

export const updateCurrentProfile = async (name: string, photoURL?: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  // 1. Update Firebase Auth Profile
  await updateProfile(currentUser, {
    displayName: name,
    photoURL: photoURL || currentUser.photoURL || ''
  });

  // 2. Save to Firestore users collection
  await saveUserProfile(currentUser.uid, {
    name,
    photoURL: photoURL || '',
    email: currentUser.email || ''
  });

  // 3. Update Zustand Store
  useGameStore.getState().setMyName(name);
  if (photoURL) {
    useGameStore.getState().setMyPhotoURL(photoURL);
  }
};
