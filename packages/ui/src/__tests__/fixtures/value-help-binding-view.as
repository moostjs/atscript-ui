import { Ticket } from './value-help-binding'

/// Chain refs inherit the binding across files
export interface TicketView {
    color: Ticket.color
    size?: Ticket.size
    status: Ticket.status
}
