import { AttributeValue, Currency, Unserved } from './value-help-binding-target'
import { Author } from './value-help-target'

@ui.literalLabel 'open', 'Open'
@ui.literalLabel 'in_progress', 'In progress'
export type TicketStatus = 'open' | 'in_progress' | 'closed'

export interface Ticket {
    @ui.valueHelp AttributeValue, 'value', `attribute = 'color'`
    color: string

    @ui.valueHelp AttributeValue, 'value', `attribute = 'size' and active = true`
    size?: string

    @ui.valueHelp Currency, 'code'
    currency: string

    /// Binding beats the foreign key on the same field
    @db.rel.FK 'a'
    @ui.valueHelp Currency, 'id'
    authorId: Author.id

    /// Target has no controller path: the binding is ignored, the FK walk runs
    @db.rel.FK 'b'
    @ui.valueHelp Unserved, 'code'
    fallbackAuthor: Author.id

    @ui.literalLabel 'closed', 'Done'
    status: TicketStatus

    plainStatus: 'a' | 'b'

    /// A prop label for a literal the referenced type already labels: the prop's wins
    @ui.literalLabel 'open', 'Opened'
    relabelled: TicketStatus

    /// An array of a labelled union: the prop's label wins over the element type's
    @ui.literalLabel 'closed', 'Finished'
    statuses: TicketStatus[]

    plainStatuses: TicketStatus[]
}

export interface TicketExtended extends Ticket {
    note: string
}
