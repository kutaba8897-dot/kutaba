# Security Specification - EduTransform AI

## Data Invariants
1. A **Quiz** must have a non-empty title, at least one question, and be owned by a registered user.
2. A **Submission** must reference a valid `quizId`, and the score cannot exceed the `totalQuestions`.
3. Users can only delete their own quizzes.
4. Users can only list their own quizzes.
5. All writes must include server-generated timestamps.

## The "Dirty Dozen" Payloads (Expected to be REJECTED)

1. **Identity Spoofing (Quiz)**: Creating a quiz with someone else's `userId`.
2. **Identity Spoofing (Submission)**: Creating a submission with someone else's `studentId`.
3. **Ghost Field (Quiz)**: Adding an unvalidated field `isVerified: true` during creation.
4. **State Shortcutting (Submission)**: Submitting a score of 100 on a quiz with only 5 questions.
5. **PII Blanket Leak**: Attempting to list all `users` as a regular signed-in user.
6. **Resource Poisoning (Quiz ID)**: Using a 2KB string as a `quizId`.
7. **Bypassing Server Timestamps (Quiz)**: Providing a client-side `createdAt` date instead of `request.time`.
8. **Unauthorized Deletion**: User B attempting to delete User A's quiz.
9. **Invalid Question Format**: Creating a quiz where `questions` is a string instead of a list.
10. **Shadow Update (User Profile)**: Attempting to update `email` field in user profile after creation.
11. **Orphaned Submission**: Creating a submission for a non-existent `quizId`.
12. **Teacher Impersonation**: Attempting to list submissions for a quiz not owned by the current user.

## Terminal State Locking
- Submissions are immutable after creation. Once a student submits their quiz, the result cannot be altered.

## The Test Runner
A `firestore.rules.test.ts` will be implemented to verify these denials.
