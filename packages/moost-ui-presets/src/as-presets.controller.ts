import { AsDbController } from "@atscript/moost-db";
import { Get, Query } from "@moostjs/event-http";
import { Inherit } from "moost";
import type { FilterExpr } from "@uniqu/core";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

import { AsCapabilitiesQuery } from "./as-capabilities-query.as";
import { AsPresetEntry } from "./as-preset-entry.as";
import {
  type PresetHooks,
  type PresetTable,
  type WriteAction,
  buildCapabilities,
  buildReadGate,
  processRemove,
  processWrite,
} from "./preset-rules";
import type { PresetCapabilities } from "./types";

@Inherit()
export abstract class AsPresetsController<
  T extends TAtscriptAnnotatedType = typeof AsPresetEntry,
> extends AsDbController<T> {
  protected maxPresetsPerUser = 10;

  protected abstract getCurrentUser(): Promise<string>;

  /** Override for tiered logic (admin / paid / free). */
  protected async getMaxPresetsPerUser(
    _app: string,
    _tableKey: string,
    _user: string,
  ): Promise<number> {
    return this.maxPresetsPerUser;
  }

  /** Override to scope public-preset creation per app/table/user. */
  protected async canPublishPresets(
    _app: string,
    _tableKey: string,
    _user: string,
  ): Promise<boolean> {
    return true;
  }

  private get hooks(): PresetHooks {
    return {
      getMaxPresetsPerUser: this.getMaxPresetsPerUser.bind(this),
      canPublishPresets: this.canPublishPresets.bind(this),
    };
  }

  private get presetTable(): PresetTable {
    return this.table as unknown as PresetTable;
  }

  @Get("capabilities")
  async capabilities(@Query() query: AsCapabilitiesQuery): Promise<PresetCapabilities> {
    const user = await this.getCurrentUser();
    return buildCapabilities(query.app, query.tableKey, user, this.hooks);
  }

  protected override async transformFilter(filter: FilterExpr): Promise<FilterExpr> {
    const user = await this.getCurrentUser();
    return buildReadGate(user, filter);
  }

  protected override async onWrite(action: WriteAction, data: unknown): Promise<unknown> {
    const user = await this.getCurrentUser();
    return processWrite(this.presetTable, user, action, data, this.hooks);
  }

  protected override async onRemove(id: unknown): Promise<unknown> {
    const user = await this.getCurrentUser();
    return processRemove(this.presetTable, id, user);
  }
}
