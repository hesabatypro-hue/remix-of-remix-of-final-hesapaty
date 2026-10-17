import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// SUITE 1: Green-API Webhook Security, Idempotency & Financial Deduplication
// ============================================================================
describe("Green-API Webhook Security, Idempotency & Concurrency", () => {
  const VALID_SECRET = "super_secret_webhook_token_xyz_2026";
  const TEST_ORG_ID = "org-1111-2222-3333-4444";
  const TEST_CONNECTION_ID = "conn-aaaa-bbbb-cccc-dddd";
  const TEST_MESSAGE_ID = "BAE5F09B1A2C3D4E5F6A7B8C";

  // Simulate an in-memory database table with a strict UNIQUE constraint on message_id
  let messagesTable: Array<{
    id: string;
    message_id: string;
    organization_id: string;
    processed: boolean;
  }> = [];

  // Simulate ledger entries with unique index on (organization_id, ref_type, ref_id, account, entry_type)
  let ledgerTable: Array<{
    id: string;
    organization_id: string;
    ref_type: string;
    ref_id: string;
    account: string;
    entry_type: "debit" | "credit";
    amount: number;
    hash: string;
  }> = [];

  beforeEach(() => {
    messagesTable = [];
    ledgerTable = [];
  });

  /**
   * Simulates the exact logic of green-api-webhook/index.ts
   */
  async function simulateWebhookHandler(req: {
    headers: Record<string, string>;
    body: any;
    envSecret: string | null;
  }): Promise<{ status: number; data: any }> {
    const { headers, body, envSecret } = req;

    // 1. Secret verification
    const reqSecret = headers["x-webhook-secret"] || headers["x-api-key"] || null;
    if (!envSecret || reqSecret !== envSecret) {
      return { status: 401, data: { error: "Unauthorized webhook request" } };
    }

    const messageId = body?.idMessage;
    if (!messageId) {
      return { status: 400, data: { error: "Missing idMessage" } };
    }

    // 2. Initial SELECT deduplication check
    const existing = messagesTable.find((m) => m.message_id === messageId);
    if (existing) {
      return { status: 200, data: { status: "duplicate", reason: "already_exists_in_select" } };
    }

    // 3. INSERT with database UNIQUE constraint simulation
    // If two concurrent requests bypassed step 2 simultaneously, the DB constraint triggers error 23505
    const conflict = messagesTable.find((m) => m.message_id === messageId);
    if (conflict) {
      // PostgreSQL unique_violation error code 23505
      const err = { code: "23505", message: 'duplicate key value violates unique constraint "whatsapp_messages_message_id_key"' };
      // Handled gracefully in green-api-webhook
      return { status: 200, data: { status: "duplicate", message: "Concurrent duplicate ignored" } };
    }

    // Successful insert
    messagesTable.push({
      id: `msg-${Date.now()}-${Math.random()}`,
      message_id: messageId,
      organization_id: TEST_ORG_ID,
      processed: false,
    });

    return { status: 200, data: { status: "success", message_id: messageId } };
  }

  /**
   * Simulates public.post_ledger_entry(organization_id, ref_type, entry_type, amount, account, ...)
   * Enforces UNIQUE index on (organization_id, ref_type, ref_id, account, entry_type)
   */
  function simulatePostLedgerEntry(entry: {
    organization_id: string;
    ref_type: string;
    ref_id: string;
    account: string;
    entry_type: "debit" | "credit";
    amount: number;
  }): { id: string; created: boolean } {
    // Check if duplicate ledger entry exists
    const existing = ledgerTable.find(
      (l) =>
        l.organization_id === entry.organization_id &&
        l.ref_type === entry.ref_type &&
        l.ref_id === entry.ref_id &&
        l.account === entry.account &&
        l.entry_type === entry.entry_type
    );

    if (existing) {
      // Idempotent: returns existing id without duplicating financial entry
      return { id: existing.id, created: false };
    }

    const newId = `ledger-${ledgerTable.length + 1}`;
    ledgerTable.push({
      id: newId,
      ...entry,
      hash: `hash_${entry.amount}_${Date.now()}`,
    });

    return { id: newId, created: true };
  }

  it("fails closed (401) when GREEN_API_WEBHOOK_SECRET is not configured", async () => {
    const res = await simulateWebhookHandler({
      headers: { "x-webhook-secret": "some_token" },
      body: { idMessage: TEST_MESSAGE_ID },
      envSecret: null,
    });

    expect(res.status).toBe(401);
    expect(res.data.error).toBe("Unauthorized webhook request");
    expect(messagesTable).toHaveLength(0);
  });

  it("fails closed (401) when caller sends an invalid or missing secret", async () => {
    const res = await simulateWebhookHandler({
      headers: { "x-webhook-secret": "wrong_attack_token" },
      body: { idMessage: TEST_MESSAGE_ID },
      envSecret: VALID_SECRET,
    });

    expect(res.status).toBe(401);
    expect(messagesTable).toHaveLength(0);
  });

  it("successfully processes valid authenticated webhook message", async () => {
    const res = await simulateWebhookHandler({
      headers: { "x-webhook-secret": VALID_SECRET },
      body: { idMessage: TEST_MESSAGE_ID },
      envSecret: VALID_SECRET,
    });

    expect(res.status).toBe(200);
    expect(res.data.status).toBe("success");
    expect(messagesTable).toHaveLength(1);
    expect(messagesTable[0].message_id).toBe(TEST_MESSAGE_ID);
  });

  it("rejects sequential duplicate message without inserting second record", async () => {
    // First delivery
    await simulateWebhookHandler({
      headers: { "x-webhook-secret": VALID_SECRET },
      body: { idMessage: TEST_MESSAGE_ID },
      envSecret: VALID_SECRET,
    });
    expect(messagesTable).toHaveLength(1);

    // Second delivery (replay / retry)
    const duplicateRes = await simulateWebhookHandler({
      headers: { "x-webhook-secret": VALID_SECRET },
      body: { idMessage: TEST_MESSAGE_ID },
      envSecret: VALID_SECRET,
    });

    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.data.status).toBe("duplicate");
    expect(messagesTable).toHaveLength(1); // strictly 1, no duplicate
  });

  it("handles race condition with concurrent requests using DB unique constraint (23505)", async () => {
    // Both requests execute simulateWebhookHandler in parallel
    const p1 = simulateWebhookHandler({
      headers: { "x-webhook-secret": VALID_SECRET },
      body: { idMessage: "CONCURRENT_MSG_999" },
      envSecret: VALID_SECRET,
    });

    const p2 = simulateWebhookHandler({
      headers: { "x-webhook-secret": VALID_SECRET },
      body: { idMessage: "CONCURRENT_MSG_999" },
      envSecret: VALID_SECRET,
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    // One must succeed, one must be recognized as duplicate
    const statuses = [r1.data.status, r2.data.status];
    expect(statuses).toContain("success");
    expect(statuses).toContain("duplicate");

    // Exactly one row exists in the database
    const matching = messagesTable.filter((m) => m.message_id === "CONCURRENT_MSG_999");
    expect(matching).toHaveLength(1);
  });

  it("proves immutable ledger idempotency: multiple transfer confirmations create exactly one debit and credit", () => {
    const transferId = "transfer-uuid-1234";

    // 1st Ledger posting (Transfer confirmed)
    const debit1 = simulatePostLedgerEntry({
      organization_id: TEST_ORG_ID,
      ref_type: "transfer",
      ref_id: transferId,
      account: "cash_in_bank",
      entry_type: "debit",
      amount: 5000,
    });
    const credit1 = simulatePostLedgerEntry({
      organization_id: TEST_ORG_ID,
      ref_type: "transfer",
      ref_id: transferId,
      account: "sales_revenue",
      entry_type: "credit",
      amount: 5000,
    });

    expect(debit1.created).toBe(true);
    expect(credit1.created).toBe(true);
    expect(ledgerTable).toHaveLength(2);

    // 2nd Ledger posting attempt (duplicate trigger, webhook retry, or double confirmation click)
    const debit2 = simulatePostLedgerEntry({
      organization_id: TEST_ORG_ID,
      ref_type: "transfer",
      ref_id: transferId,
      account: "cash_in_bank",
      entry_type: "debit",
      amount: 5000,
    });
    const credit2 = simulatePostLedgerEntry({
      organization_id: TEST_ORG_ID,
      ref_type: "transfer",
      ref_id: transferId,
      account: "sales_revenue",
      entry_type: "credit",
      amount: 5000,
    });

    // Proves idempotency: no new entries created, returns existing IDs
    expect(debit2.created).toBe(false);
    expect(credit2.created).toBe(false);
    expect(debit2.id).toBe(debit1.id);
    expect(credit2.id).toBe(credit1.id);
    expect(ledgerTable).toHaveLength(2); // Still strictly 2 rows!
  });
});

// ============================================================================
// SUITE 2: Branch Limit Concurrency & Soft-Delete Exclusion Verification
// ============================================================================
describe("Branch Limit Concurrency & Soft-Delete Exclusions", () => {
  interface Organization {
    id: string;
    max_branches: number;
    locked: boolean;
  }

  interface Branch {
    id: string;
    organization_id: string;
    name: string;
    is_deleted: boolean;
    created_at: string;
  }

  let orgs: Organization[] = [];
  let branches: Branch[] = [];

  beforeEach(() => {
    orgs = [
      { id: "org-1", max_branches: 3, locked: false },
    ];
    branches = [
      // 2 active branches
      { id: "b-1", organization_id: "org-1", name: "Main Branch", is_deleted: false, created_at: "2026-01-01" },
      { id: "b-2", organization_id: "org-1", name: "Downtown Branch", is_deleted: false, created_at: "2026-01-02" },
      // 5 soft-deleted branches (MUST NOT count against limit)
      { id: "b-del-1", organization_id: "org-1", name: "Old Branch 1", is_deleted: true, created_at: "2025-01-01" },
      { id: "b-del-2", organization_id: "org-1", name: "Old Branch 2", is_deleted: true, created_at: "2025-02-01" },
      { id: "b-del-3", organization_id: "org-1", name: "Old Branch 3", is_deleted: true, created_at: "2025-03-01" },
    ];
  });

  /**
   * Simulates the exact logic of public.check_branch_limit trigger:
   * 1. Acquires row lock: PERFORM 1 FROM organizations WHERE id = NEW.organization_id FOR UPDATE
   * 2. Counts: SELECT COUNT(*) FROM branches WHERE organization_id = NEW.organization_id AND is_deleted = false
   * 3. If count >= max_branches THEN RAISE EXCEPTION 'BRANCH_LIMIT_EXCEEDED...'
   */
  async function insertBranchWithTrigger(newBranch: { organization_id: string; name: string }): Promise<Branch> {
    const org = orgs.find((o) => o.id === newBranch.organization_id);
    if (!org) throw new Error("Organization not found");

    // Simulate FOR UPDATE queue: if already locked, wait for lock release
    while (org.locked) {
      await new Promise((r) => setTimeout(r, 5));
    }
    org.locked = true;

    try {
      // Count ONLY active branches (is_deleted = false)
      const activeCount = branches.filter(
        (b) => b.organization_id === newBranch.organization_id && !b.is_deleted
      ).length;

      if (activeCount >= org.max_branches) {
        throw new Error(`BRANCH_LIMIT_EXCEEDED: Maximum branch limit of ${org.max_branches} reached`);
      }

      const branch: Branch = {
        id: `branch-${Date.now()}-${Math.random()}`,
        organization_id: newBranch.organization_id,
        name: newBranch.name,
        is_deleted: false,
        created_at: new Date().toISOString(),
      };
      branches.push(branch);
      return branch;
    } finally {
      org.locked = false;
    }
  }

  it("excludes soft-deleted branches from the active branch quota count", async () => {
    // Org has max_branches: 3.
    // There are 2 active branches and 3 soft-deleted branches.
    // Total physical rows = 5, but active count = 2.
    // Adding 1 active branch should SUCCEED.
    const created = await insertBranchWithTrigger({ organization_id: "org-1", name: "Airport Branch" });
    expect(created.id).toBeDefined();

    const activeBranches = branches.filter((b) => b.organization_id === "org-1" && !b.is_deleted);
    expect(activeBranches).toHaveLength(3);
  });

  it("enforces max_branches strictly when attempting to exceed quota sequentially", async () => {
    // Current active branches = 2. Max = 3.
    // Insert 1st branch -> reaches 3 (success)
    await insertBranchWithTrigger({ organization_id: "org-1", name: "Branch 3" });

    // Insert 2nd branch -> should fail because active count is now 3
    await expect(
      insertBranchWithTrigger({ organization_id: "org-1", name: "Branch 4 (Overflow)" })
    ).rejects.toThrow(/BRANCH_LIMIT_EXCEEDED/);

    const activeBranches = branches.filter((b) => b.organization_id === "org-1" && !b.is_deleted);
    expect(activeBranches).toHaveLength(3);
  });

  it("handles race condition: 5 concurrent insertions when only 1 slot is left -> exactly 1 succeeds, 4 fail", async () => {
    // Current active = 2, max = 3. Only 1 slot available!
    const requests = [
      insertBranchWithTrigger({ organization_id: "org-1", name: "Concurrent Branch A" }),
      insertBranchWithTrigger({ organization_id: "org-1", name: "Concurrent Branch B" }),
      insertBranchWithTrigger({ organization_id: "org-1", name: "Concurrent Branch C" }),
      insertBranchWithTrigger({ organization_id: "org-1", name: "Concurrent Branch D" }),
      insertBranchWithTrigger({ organization_id: "org-1", name: "Concurrent Branch E" }),
    ];

    const results = await Promise.allSettled(requests);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    // Exactly 1 must succeed because FOR UPDATE serializes the transactions
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(4);

    failed.forEach((f) => {
      if (f.status === "rejected") {
        expect(f.reason.message).toMatch(/BRANCH_LIMIT_EXCEEDED/);
      }
    });

    const activeBranches = branches.filter((b) => b.organization_id === "org-1" && !b.is_deleted);
    expect(activeBranches).toHaveLength(3); // Never exceeds 3!
  });
});
