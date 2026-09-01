import {
  ID,
  Query,
  getRowOrNull,
  listAllRows,
  ownerPermissions
} from "./appwrite.js";
import { DATABASE_ID, HORIZON_DAYS, TABLES, TIMEZONE } from "./config.js";
import { assertLocalDate, dateRange, localDateAt } from "./domain/dates.js";
import { detectConflictCandidates } from "./domain/conflicts.js";
import { assertInterval } from "./domain/intervals.js";
import { expectedDates, occurrenceData, occurrenceId, validatePattern } from "./domain/materialise.js";

const MUTABLE_FIELDS = Object.freeze({
  children: ["display_name", "age_group", "active"],
  schedule_patterns: ["kind", "child_id", "byweekday", "start_minute", "end_minute", "effective_from", "effective_until", "payload_json", "active"],
  work_commitments: ["date_local", "start_minute", "end_minute", "commitment_type", "location_mode", "remote_possible", "flexibility_level", "priority", "source_label", "span_group", "span_part", "status"],
  care_commitments: ["child_id", "entry_kind", "date_local", "start_minute", "end_minute", "resource_type", "resource_ref", "provider_id", "location_label", "collect_by_minute", "handover_in_ref", "handover_out_ref", "band_state", "source_records", "span_group", "span_part", "status"],
  support_network: ["display_name", "relationship", "available_json", "pickup_possible", "emergency_only", "reliability", "contact_ciphertext", "state"],
  plan_feedback: ["plan_id", "outcome", "confirmed_at", "notes"]
});

const PROFILE_FIELDS = [
  "display_name", "home_area", "work_area", "travel_home_care_min", "travel_care_work_min",
  "travel_home_work_min", "notify_hour", "language", "timezone", "larger_text", "alert_gap",
  "alert_reply", "alert_break", "alert_weekly", "onboarding_completed"
];

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function pick(value, fields) {
  return compact(Object.fromEntries(fields.map((field) => [field, value?.[field]])));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function errorLabel(error) {
  return String(error?.type ?? error?.code ?? error?.message ?? "unknown_error").slice(0, 80);
}

export class EqualPathService {
  constructor({ tables, users, now = () => new Date(), log = () => {}, error = () => {} }) {
    this.tables = tables;
    this.users = users;
    this.now = now;
    this.log = log;
    this.error = error;
  }

  async profileForAuthUser(authUser) {
    if (!authUser?.$id || !authUser?.email) throw new Error("Auth user event is missing $id or email");
    return this.tables.upsertRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.users,
      rowId: authUser.$id,
      data: compact({
        email: authUser.email,
        display_name: authUser.name || undefined,
        timezone: TIMEZONE,
        language: "en",
        notify_hour: 21,
        alert_gap: true,
        alert_reply: false,
        alert_break: false,
        alert_weekly: false,
        onboarding_completed: false
      }),
      permissions: ownerPermissions(authUser.$id, "read")
    });
  }

  async ensureProfile(userId) {
    const profile = await getRowOrNull(this.tables, TABLES.users, userId);
    if (profile) return profile;
    const authUser = await this.users.get({ userId });
    return this.profileForAuthUser(authUser);
  }

  async assertOwned(tableId, rowId, userId) {
    const row = await getRowOrNull(this.tables, tableId, rowId);
    if (!row) throw httpError(404, `${tableId} row was not found`);
    const ownerId = tableId === TABLES.users ? row.$id : row.user_id;
    if (ownerId !== userId) throw httpError(404, `${tableId} row was not found`);
    return row;
  }

  async assertChildOwned(childId, userId) {
    if (!childId) return;
    await this.assertOwned(TABLES.children, childId, userId);
  }

  validateMutableRow(tableId, row) {
    try {
      if (tableId === TABLES.children && !row.age_group) throw new Error("age_group is required");
      if (tableId === TABLES.patterns) {
        validatePattern(row);
        assertLocalDate(row.effective_from);
        if (row.effective_until) assertLocalDate(row.effective_until);
      }
      if ([TABLES.work, TABLES.care].includes(tableId)) {
        assertLocalDate(row.date_local);
        assertInterval({ start: row.start_minute, end: row.end_minute });
      }
      if (tableId === TABLES.care && !["required", "coverage"].includes(row.entry_kind)) {
        throw new Error("care entry_kind must be required or coverage");
      }
    } catch (error) {
      throw httpError(400, error.message);
    }
  }

  async saveUserRow({ userId, tableId, rowId, data }) {
    await this.ensureProfile(userId);
    const fields = Object.hasOwn(MUTABLE_FIELDS, tableId) ? MUTABLE_FIELDS[tableId] : null;
    if (!fields) throw httpError(400, "This table cannot be changed through the client API");
    const id = rowId || ID.unique();
    const existing = await getRowOrNull(this.tables, tableId, id);
    if (existing?.user_id && existing.user_id !== userId) throw httpError(404, `${tableId} row was not found`);
    const mutable = pick(data, fields);
    const merged = { ...existing, ...mutable, $id: id, user_id: userId };

    if ([TABLES.work, TABLES.care].includes(tableId)) {
      mutable.is_override = true;
      if (existing?.pattern_id) mutable.pattern_id = existing.pattern_id;
      merged.is_override = true;
    }
    await this.assertChildOwned(merged.child_id, userId);
    if (tableId === TABLES.feedback) {
      const plan = await this.assertOwned(TABLES.plans, merged.plan_id, userId);
      if (!plan) throw httpError(404, "Plan was not found");
    }
    this.validateMutableRow(tableId, merged);

    const row = await this.tables.upsertRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId: id,
      data: { ...mutable, user_id: userId },
      permissions: ownerPermissions(userId, "read")
    });
    if (tableId === TABLES.patterns) {
      const profile = await this.ensureProfile(userId);
      await this.materialisePattern(row, localDateAt(this.now(), profile.timezone || TIMEZONE));
    }
    if ([TABLES.children, TABLES.patterns, TABLES.work, TABLES.care].includes(tableId)) {
      await this.detectForUser(userId, "client_mutation");
    }
    return row;
  }

  async deleteUserRow({ userId, tableId, rowId }) {
    if (!Object.hasOwn(MUTABLE_FIELDS, tableId)) throw httpError(400, "This table cannot be changed through the client API");
    const row = await this.assertOwned(tableId, rowId, userId);
    const preservedOverrides = tableId === TABLES.patterns ? await this.countPatternOverrides(row) : 0;
    if (tableId === TABLES.patterns) await this.removeGeneratedForPattern(row);
    const datedTable = [TABLES.work, TABLES.care].includes(tableId);
    const targets = datedTable && row.span_group
      ? await listAllRows(this.tables, tableId, [Query.equal("user_id", userId), Query.equal("span_group", row.span_group)])
      : [row];
    for (const target of targets) {
      if (datedTable && target.pattern_id) {
        await this.tables.updateRow({
          databaseId: DATABASE_ID,
          tableId,
          rowId: target.$id,
          data: { status: "cancelled", is_override: true }
        });
      } else {
        await this.tables.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: target.$id });
      }
    }
    if ([TABLES.children, TABLES.patterns, TABLES.work, TABLES.care].includes(tableId)) {
      await this.detectForUser(userId, "client_mutation");
    }
    return { preservedOverrides };
  }

  async countPatternOverrides(pattern) {
    if (!pattern?.$id) return 0;
    const tableId = pattern.kind === "work" ? TABLES.work : TABLES.care;
    const rows = await listAllRows(this.tables, tableId, [Query.equal("pattern_id", pattern.$id)]);
    return rows.filter((row) => row.is_override === true).length;
  }

  async pruneScheduleSpan({ userId, tableId, spanGroup, keepRowIds }) {
    if (![TABLES.work, TABLES.care].includes(tableId) || !spanGroup || !Array.isArray(keepRowIds)) {
      throw httpError(400, "A dated schedule table, span_group and keep_row_ids are required");
    }
    const keep = new Set(keepRowIds);
    const rows = await listAllRows(this.tables, tableId, [
      Query.equal("user_id", userId),
      Query.equal("span_group", spanGroup)
    ]);
    for (const row of rows) {
      if (keep.has(row.$id)) continue;
      if (row.pattern_id) {
        await this.tables.updateRow({
          databaseId: DATABASE_ID,
          tableId,
          rowId: row.$id,
          data: { status: "cancelled", is_override: true }
        });
      } else {
        await this.tables.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id });
      }
    }
    await this.detectForUser(userId, "client_mutation");
  }

  async updateProfile(userId, data) {
    await this.ensureProfile(userId);
    const update = pick(data, PROFILE_FIELDS);
    if (Object.hasOwn(update, "notify_hour") && (!Number.isInteger(update.notify_hour) || update.notify_hour < 0 || update.notify_hour > 23)) {
      throw httpError(400, "notify_hour must be between 0 and 23");
    }
    const row = await this.tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.users,
      rowId: userId,
      data: update
    });
    await this.detectForUser(userId, "profile_update");
    return row;
  }

  async materialisePattern(pattern, horizonStart = localDateAt(this.now(), TIMEZONE)) {
    const tableId = pattern.kind === "work" ? TABLES.work : TABLES.care;
    const expected = new Set(expectedDates(pattern, horizonStart, HORIZON_DAYS));
    const existing = await listAllRows(this.tables, tableId, [Query.equal("pattern_id", pattern.$id)]);

    for (const dateLocal of expected) {
      const rowId = occurrenceId(pattern.$id, dateLocal);
      const current = existing.find((row) => row.$id === rowId);
      if (current?.is_override === true) continue;
      const occurrence = occurrenceData(pattern, dateLocal);
      await this.tables.upsertRow({
        databaseId: DATABASE_ID,
        tableId: occurrence.table,
        rowId,
        data: occurrence.data,
        permissions: ownerPermissions(pattern.user_id, "read")
      });
    }

    for (const row of existing) {
      if (row.is_override === true || expected.has(row.date_local)) continue;
      await this.tables.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id });
    }
  }

  async removeGeneratedForPattern(pattern) {
    const tableIds = pattern?.kind === "work"
      ? [TABLES.work]
      : pattern?.kind
        ? [TABLES.care]
        : [TABLES.work, TABLES.care];
    for (const tableId of tableIds) {
      const rows = await listAllRows(this.tables, tableId, [Query.equal("pattern_id", pattern.$id)]);
      for (const row of rows) {
        if (row.is_override === true) continue;
        await this.tables.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id });
      }
    }
  }

  async materialiseUser(userId) {
    const profile = await this.ensureProfile(userId);
    const horizonStart = localDateAt(this.now(), profile.timezone || TIMEZONE);
    const patterns = await listAllRows(this.tables, TABLES.patterns, [Query.equal("user_id", userId)]);
    for (const pattern of patterns) await this.materialisePattern(pattern, horizonStart);
    return patterns.length;
  }

  async detectForUser(userId, trigger = "manual") {
    const startedAt = this.now();
    const profile = await this.ensureProfile(userId);
    const timezone = profile.timezone || TIMEZONE;
    const windowStart = localDateAt(startedAt, timezone);
    const dates = dateRange(windowStart, HORIZON_DAYS);
    const sweepId = ID.unique();

    await this.tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.sweeps,
      rowId: sweepId,
      data: {
        user_id: userId,
        started_at: startedAt.toISOString(),
        overall: "running",
        trigger,
        window_start: windowStart,
        window_end: dates.at(-1)
      },
      permissions: ownerPermissions(userId, "read")
    });

    const sourceState = { children: "pending", work: "pending", care: "pending", dates: {} };
    try {
      const [children, workRows, careRows, oldConflicts] = await Promise.all([
        listAllRows(this.tables, TABLES.children, [Query.equal("user_id", userId), Query.equal("active", true)]),
        listAllRows(this.tables, TABLES.work, [Query.equal("user_id", userId), Query.between("date_local", dates[0], dates.at(-1))]),
        listAllRows(this.tables, TABLES.care, [Query.equal("user_id", userId), Query.between("date_local", dates[0], dates.at(-1))]),
        listAllRows(this.tables, TABLES.conflicts, [Query.equal("user_id", userId), Query.between("date_local", dates[0], dates.at(-1))])
      ]);
      sourceState.children = "success";
      sourceState.work = "success";
      sourceState.care = "success";

      let candidateCount = 0;
      for (const dateLocal of dates) {
        try {
          const dateWork = workRows.filter((row) => row.date_local === dateLocal && row.status !== "cancelled");
          const dateCare = careRows.filter((row) => row.date_local === dateLocal);
          const candidates = children.flatMap((child) => detectConflictCandidates({
            userId,
            childId: child.$id,
            dateLocal,
            careRows: dateCare,
            workRows: dateWork,
            profile
          }));
          const nowIso = this.now().toISOString();
          const existingForDate = oldConflicts.filter((row) => row.date_local === dateLocal);
          const candidateKeys = new Set(candidates.map((item) => item.deterministic_key));

          for (const item of candidates) {
            const current = existingForDate.find((row) => row.deterministic_key === item.deterministic_key);
            const { rowId, ...rowData } = item;
            await this.tables.upsertRow({
              databaseId: DATABASE_ID,
              tableId: TABLES.conflicts,
              rowId,
              data: {
                ...compact(rowData),
                detected_at: current?.detected_at ?? nowIso,
                last_verified_at: nowIso,
                resolved_at: null
              },
              permissions: ownerPermissions(userId, "read")
            });
          }

          for (const previous of existingForDate) {
            if (previous.status !== "open" || candidateKeys.has(previous.deterministic_key)) continue;
            await this.tables.updateRow({
              databaseId: DATABASE_ID,
              tableId: TABLES.conflicts,
              rowId: previous.$id,
              data: {
                status: "resolved",
                resolved_at: nowIso,
                resolution_reason: ["client_mutation", "pattern_event", "commitment_event", "child_event", "profile_update"].includes(trigger)
                  ? "schedule_change"
                  : trigger,
                last_verified_at: nowIso
              }
            });
          }
          sourceState.dates[dateLocal] = "success";
          candidateCount += candidates.length;
        } catch (error) {
          sourceState.dates[dateLocal] = `failed:${errorLabel(error)}`;
          throw error;
        }
      }

      const finishedAt = this.now().toISOString();
      await this.tables.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.sweeps,
        rowId: sweepId,
        data: {
          finished_at: finishedAt,
          overall: "success",
          per_source_json: JSON.stringify(sourceState)
        }
      });
      await this.tables.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.users,
        rowId: userId,
        data: { last_successful_sweep_at: finishedAt }
      });
      return { sweepId, candidateCount, windowStart, windowEnd: dates.at(-1) };
    } catch (error) {
      await this.tables.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.sweeps,
        rowId: sweepId,
        data: {
          finished_at: this.now().toISOString(),
          overall: "failed",
          per_source_json: JSON.stringify(sourceState),
          error_code: errorLabel(error)
        }
      });
      // Deliberately do not clear any previous conflict after a failed sweep.
      throw error;
    }
  }

  async scheduledRun() {
    const profiles = await listAllRows(this.tables, TABLES.users);
    const results = [];
    for (const profile of profiles) {
      try {
        const patterns = await this.materialiseUser(profile.$id);
        const sweep = await this.detectForUser(profile.$id, "schedule");
        results.push({ userId: profile.$id, patterns, sweep });
      } catch (error) {
        this.error(`Scheduled run failed for ${profile.$id}: ${error?.message ?? error}`);
        results.push({ userId: profile.$id, error: errorLabel(error) });
      }
    }
    return results;
  }
}
