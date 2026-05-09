import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  doc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Quiz } from './quizService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function createUserProfile(user: any) {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveQuiz(quiz: Quiz) {
  if (!auth.currentUser) throw new Error("Authentication required");
  
  const path = 'quizzes';
  try {
    const quizToSave = {
      ...quiz,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, path), quizToSave);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getUserQuizzes() {
  if (!auth.currentUser) return [];
  
  const path = 'quizzes';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (Quiz & { id: string })[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getQuizById(quizId: string) {
  const path = `quizzes/${quizId}`;
  try {
    const docSnap = await getDoc(doc(db, 'quizzes', quizId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Quiz & { id: string };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function deleteQuiz(quizId: string) {
  const path = `quizzes/${quizId}`;
  try {
    await deleteDoc(doc(db, 'quizzes', quizId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function submitQuizResult(data: {
  quizId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  totalQuestions: number;
}) {
  if (!auth.currentUser) throw new Error("Authentication required");
  
  const path = 'submissions';
  try {
    const submission = {
      ...data,
      studentId: auth.currentUser.uid,
      completedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, path), submission);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function checkExistingSubmission(quizId: string) {
  if (!auth.currentUser) return null;
  
  const path = 'submissions';
  try {
    const q = query(
      collection(db, path),
      where('quizId', '==', quizId),
      where('studentId', '==', auth.currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

export async function getQuizSubmissions(quizId: string) {
  if (!auth.currentUser) return [];
  
  const path = 'submissions';
  try {
    const q = query(
      collection(db, path),
      where('quizId', '==', quizId),
      orderBy('completedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
