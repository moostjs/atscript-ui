@expect.maxLength 64
@expect.minLength 3
type PresetId = string

@expect.maxLength 256
@expect.minLength 1
type FieldPath = string

type PresetAspect = 'columns' | 'filters' | 'filterOps' | 'sorters' | 'itemsPerPage'

@db.table 'as_presets'
export interface AsPresetEntry {
    @meta.id
    @db.default.uuid
    @expect.maxLength 256
    @expect.minLength 3
    id: string

    @db.index.plain 'preset_scope_idx'
    type: 'preset' | 'userConf' | 'appConf'

    @db.index.plain 'preset_scope_idx'
    @db.index.unique 'preset_public_label_idx'
    @expect.maxLength 128
    @expect.minLength 1
    app: string

    /**
     * Required for `type='preset'` and `type='userConf'` (those rows are
     * scoped per-table). Absent for `type='appConf'` rows, which carry
     * app-wide prefs and exist once per `(user, app)`.
     */
    @db.index.plain 'preset_scope_idx'
    @db.index.unique 'preset_public_label_idx'
    @expect.maxLength 64
    @expect.minLength 1
    tableKey?: string

    @db.index.plain 'preset_scope_idx'
    @db.index.plain 'preset_user_idx'
    @expect.maxLength 128
    @expect.minLength 1
    user: string

    @expect.maxLength 128
    @expect.minLength 1
    userLabel?: string

    @db.index.plain 'preset_public_idx'
    public?: boolean

    /**
     * Top-level mirror of `data.label`, stamped by the controller on every
     * `type='preset'` write. Indexed so the public-name uniqueness scan runs
     * as an O(log n) lookup instead of loading every public preset's full
     * snapshot blob and walking it in JS. Always absent for `type='userConf'`
     * and `type='appConf'` rows.
     */
    @db.index.plain 'preset_label_idx'
    @expect.maxLength 128
    @expect.minLength 1
    label?: string

    /**
     * Race-safe public-name uniqueness: stamped equal to `label` on every
     * `type='preset' AND public=true` write, NULL otherwise. The composite
     * unique index `preset_public_label_idx` over `(app, tableKey, publicLabel)`
     * relies on NULL≠NULL semantics (SQLite/Postgres/MySQL) so private presets,
     * userConf, and appConf rows don't collide while two writers racing the
     * same public name fail at the DB layer instead of slipping through
     * `assertPublicLabelFree`'s read-then-write window.
     */
    @db.index.unique 'preset_public_label_idx'
    @expect.maxLength 128
    @expect.minLength 1
    publicLabel?: string

    /**
     * Aspects this preset claims — derived by the controller from `data.content`
     * keys on every preset write. Top-level (outside `data`) so the picker can
     * project the field without loading the snapshot blob, then render an icon
     * per aspect to signal what the user will see when they apply the preset.
     * Always absent / empty for `type='userConf'` rows.
     */
    @expect.array.uniqueItems
    aspects?: PresetAspect[]

    @db.json
    data: {
        @expect.maxLength 128
        @expect.minLength 1
        label: string

        content?: {
            columns?: {
                columnNames: FieldPath[]
                columnWidths?: {
                    field: FieldPath

                    @expect.maxLength 32
                    @expect.minLength 1
                    width: string
                }[]
            }
            filters?: FieldPath[]
            filterOps?: {
                field: FieldPath
                conditions: {
                    type: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'starts' | 'ends' | 'bw' | 'null' | 'notNull' | 'regex'
                    value: (string | number | boolean)[]
                }[]
            }[]
            sorters?: {
                field: FieldPath
                direction: 'asc' | 'desc'
            }[]
            itemsPerPage?: number
        }
    } | {
        // type='userConf' — per-table, references presets in this scope.
        defaultPresetId?: PresetId

        favPresetIds?: PresetId[]
    } | {
        // type='appConf' — app-wide user prefs, one row per (user, app).
        appearance?: 'system' | 'light' | 'dark'

        @expect.maxLength 5
        @expect.minLength 2
        language?: string

        @expect.maxLength 64
        @expect.minLength 3
        timezone?: string

        density?: 'compact' | 'cozy' | 'comfortable'

        dateFormat?: 'iso' | 'us' | 'eu'

        firstDayOfWeek?: 0 | 1 | 6

        @expect.maxLength 1024
        customJson?: string
    }

    @db.default.now
    createdAt: number

    @db.default.now
    updatedAt: number
}
