
1. Data Invariants:
   - A UserProfile must belong to the authenticated user (UID match).
   - A Referral must have a referredByUid matching the authenticated user.
   - Referrals are semi-immutable: once created, only outcomes can be updated by the creator or admins.
   - Admin roles are explicitly checked via an 'admins' collection or hardcoded emails for initial setup.

2. The "Dirty Dozen" Payloads:
   - P1: Create a referral with a spoofed `referredByUid`.
   - P2: Update a referral's `patientName` after creation (Immutability check).
   - P3: Read all UserProfiles (Privacy leak).
   - P4: Delete a referral as a non-admin.
   - P5: Create a UserProfile with `role: 'admin'`.
   - P6: Inject a 1MB string into `patientName`.
   - P7: Update `outcome` on a referral owned by another user.
   - P8: Create a referral with a future `timestamp`.
   - P9: Access PII of another user without permission.
   - P10: Skip `isValidId` check on document IDs (Resource poisoning).
   - P11: Write a referral without a valid `urgency` enum value.
   - P12: Update immutable `createdAt` field if it existed.

3. The Test Runner: (Conceptual test logic for rules)
   - verify(create, /referrals/1, {referredByUid: 'hacker'}).denied()
   - verify(update, /referrals/1, {patientName: 'Changed'}).denied()
   - verify(list, /users).denied()
   - verify(delete, /referrals/1).as('user').denied()
