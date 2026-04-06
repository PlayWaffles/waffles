const TICKET_CLOSE_BUFFER_MS = 5 * 60 * 1000;

export function getTicketCloseTime(endsAt: Date): Date {
  return new Date(endsAt.getTime() - TICKET_CLOSE_BUFFER_MS);
}

export function areTicketsClosedForGame(game: { endsAt: Date }, now = new Date()): boolean {
  return now >= getTicketCloseTime(game.endsAt);
}
