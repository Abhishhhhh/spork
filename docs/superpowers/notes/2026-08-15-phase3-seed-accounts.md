# Phase 3 Seed Data — Mock Friend Accounts

Created for Phase 3 testing. These are throwaway demo accounts — delete via
Supabase Dashboard → Authentication (deletes the `auth.users` row, cascading
to `users`/`logs`/`friendships` via `on delete cascade`) once no longer needed.

| Email | Username | Name | Role in seed |
|---|---|---|---|
| spork.friend.maya@gmail.com | mayaruns | Maya Chen | Accepted friend, streak 15, 5 logs (4 public, 1 private) |
| spork.friend.dev@gmail.com | devlifts | Dev Patel | Accepted friend, streak 3, 4 logs (3 public, 1 private) |
| spork.friend.sofia@gmail.com | sofiaeats | Sofia Martins | Accepted friend, streak 0, 4 logs (all public) |
| spork.friend.jonas@gmail.com | jonasq | Jonas Weber | Pending incoming friend request |
| spork.friend.priya@gmail.com | priyakitchen | Priya Nair | Not connected — findable via search only |

All 5 connected to the real account **rusty** (`fbc717e3-2e21-4a67-9118-1588979e70d4`).

Seeded via direct Supabase REST API calls (signup + authenticated inserts using each
seed account's own access token) rather than manual UI click-through — same
end effect as the plan's original SQL-Editor approach, just faster to execute.
Verified: streak counts, log counts, and friendship visibility all match expected
values (see Task 1 completion note in the SDD ledger for the verification output).
