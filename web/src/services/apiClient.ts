import { auth } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export const checkWordWithAPI = async (word: string, usedSyllables: string[]) => {
  const user = auth.currentUser;
  let token = '';
  if (user) {
    token = await user.getIdToken();
  }

  const res = await fetch(`${API_BASE_URL}/api/check-word`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ word, usedSyllables })
  });

  if (!res.ok) {
    throw new Error('API Error');
  }

  return res.json();
};

export const judgeWordWithAPI = async (previousWord: string, word: string) => {
  const user = auth.currentUser;
  let token = '';
  if (user) {
    token = await user.getIdToken();
  }

  const res = await fetch(`${API_BASE_URL}/api/ai-judge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ previousWord, word })
  });

  if (!res.ok) return { pass: true, reason: 'Error' };
  return res.json();
};
