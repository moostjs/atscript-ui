/// Target interface that exercises the @ui.dict.* capability annotations.
/// Uses prop-level filterable/sortable/searchable + interface-level searchable.

@db.http.path '/dict-caps'
@ui.dict.searchable
export interface DictCaps {
    @meta.id
    id: number

    @ui.dict.label
    @ui.dict.searchable
    @ui.dict.filterable
    @ui.dict.sortable
    name: string

    @ui.dict.descr
    @ui.dict.filterable
    description: string

    @ui.dict.sortable
    weight: number
}
